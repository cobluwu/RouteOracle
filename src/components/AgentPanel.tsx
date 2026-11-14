import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Cpu, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { AuditEntry, DisruptionJSON, PlanOption, GateDecision } from '../types';

const GLOBAL_ROUTES_CONTEXT = `
REFERENCE DATA - STANDARD GLOBAL SUPPLY CHAIN ROUTES:
Ocean Freight (Major):
- Transpacific: Shanghai/Shenzhen/Ningbo/Busan/Yokohama -> Los Angeles/Long Beach/Seattle/Oakland/Vancouver
- Asia-Europe: Shanghai/Shenzhen/Singapore/Port Klang/Colombo/Mumbai -> Rotterdam/Hamburg/Antwerp/Felixstowe/Valencia
- Transatlantic: Rotterdam/Antwerp/Hamburg/Le Havre -> New York/Houston/Charleston/Montreal
- Intra-Asia/ME: Shanghai/Shenzhen/Busan -> Singapore/Jebel Ali/Ho Chi Minh

Air Cargo (Major Hubs & Routes):
- Transpacific/Asia-Europe: HKG/PVG/ICN/TPE/NRT/PEK -> MEM/ANC/LAX/FRA/SDF/ORD/LEJ
- Transatlantic/ME: FRA/LHR/CDG/AMS/DXB/DOH -> ORD/JFK/MEM/ATL
- Emerging: HKG->SIN, MIA->BOG/VCP, LGG->HGH, NBO->AMS, ADD->LGG

Ground & Rail (Major Corridors):
- North America: LA->Chicago (Rail/I-15), Laredo->Monterrey, Chicago->NY, Dallas->Atlanta, Windsor->Detroit, Vancouver->Toronto
- Europe: Rotterdam->Ruhr, Antwerp->Paris, Hamburg->Prague, Milan->Munich, Madrid->Paris, Warsaw->Berlin
- Eurasia: Yiwu->Madrid, Chongqing->Duisburg, Chengdu->Lodz (Eurasian Rail)
- Intra-Asia: Shenzhen->HK, Shanghai->Beijing, Mumbai->Delhi, Hanoi->Pingxiang, Bangkok->KL

When formulating rerouting plans or estimating coordinates, use these established corridors. For example, if the Strait of Malacca is blocked for an Ocean route from China to Europe, consider rerouting via the Cape of Good Hope (Ocean), or switching to Eurasian Rail (Chongqing -> Duisburg), or Air Cargo (PVG -> FRA). Ensure your waypoints reflect these realistic geographic paths.`;

import { PipelineStage, ExecutionResult } from '../types';
import { recordAuditEntryInFirestore } from '../lib/firebase';

export default function AgentPanel() {
  const { pipeline, setPipeline, auditLog, setAuditLog, setMapState, fleetState, setFleetState, config, wmsState, setWmsState } = useStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [ingestMode, setIngestMode] = useState<'manual' | 'autonomous'>('manual');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pipeline, auditLog, isProcessing]);

  const extractJSON = (text: string | undefined) => {
    if (!text) return "{}";
    const withoutThinking = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
    const jsonBlock = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlock && jsonBlock[1]) {
      return jsonBlock[1].trim();
    }
    const match = withoutThinking.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return match ? match[0] : withoutThinking;
  };

  const callServerGemini = async (params: {
    model?: string;
    contents: any;
    config?: any;
  }, maxRetries = 5) => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        attempt++;
        const res = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errJson.error || `Server error: ${res.status}`);
        }
        return await res.json();
      } catch (e: any) {
        const errorStr = typeof e === 'string' ? e : (e?.message || JSON.stringify(e));
        const isRateLimit = errorStr.includes('429') || errorStr.toLowerCase().includes('quota') || errorStr.toLowerCase().includes('exhausted') || errorStr.includes('503');
        if (isRateLimit && attempt < maxRetries) {
          let waitTimeMs = attempt * 2000;
          const retryMatch = errorStr.match(/retry in (\d+(?:\.\d+)?)s/i);
          if (retryMatch && retryMatch[1]) {
            waitTimeMs = Math.ceil(parseFloat(retryMatch[1])) * 1000 + 1000;
          } else {
            waitTimeMs = 5000 * attempt;
          }
          console.warn(`Rate limit hit. Retrying in ${waitTimeMs / 1000}s... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        } else {
          throw e;
        }
      }
    }
    throw new Error("Max retries exceeded");
  };

  const handleIngest = async (data: any, isRaw: boolean = false) => {
    setPipeline({ stage: 'ingesting', disruption: null, agentReasoning: '', plans: null, gate: null, execution: null, auditId: null });
    setIsProcessing(true);
    
    let prompt = '';
    if (isRaw) {
      prompt = `Raw Incoming Telemetry/EDI Payload:\n${data}`;
    } else {
      prompt = `User Input:
Origin: "${data.origin}"
Destination: "${data.destination}"
Disruption Location: "${data.disruptionLocation}"
Description: "${data.description}"`;
    }

    const systemInstruction = `You are the SupplyGuard Ingestion Agent. Your responsibility is to extract critical supply chain disruption data from unstructured reports, raw API payloads, or EDI messages, and output it into the exact JSON schema provided.
You must classify the severity on a scale of 1 (Low) to 5 (Critical).
You MUST identify the origin and destination of the shipment from the text.
You MUST output the approximate geographic coordinates [longitude, latitude] for the origin, destination, and the disruption location. Use your internal knowledge to estimate these coordinates accurately based on the provided names.

Few-Shot Examples :
User Input:
Origin: "Shenzhen"
Destination: "Los Angeles"
Disruption Location: "Port of Miami"
Description: "Shipment is delayed because of a massive category 4 hurricane approaching the Port of Miami where it was supposed to transit."
Model Output: {"incident_type": "Extreme Weather", "severity_level": 5, "impacted_node": "Port of Miami", "estimated_delay_hours": 48, "origin_coords": [114.05, 22.54], "dest_coords": [-118.24, 34.05], "disruption_coords": [-80.19, 25.76]}

${GLOBAL_ROUTES_CONTEXT}`;

    try {
      const response = await callServerGemini({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              incident_type: { type: "STRING" },
              severity_level: { type: "INTEGER" },
              impacted_node: { type: "STRING" },
              estimated_delay_hours: { type: "INTEGER" },
              origin_coords: { type: "ARRAY", items: { type: "NUMBER" }, description: "[longitude, latitude] of the shipment origin" },
              dest_coords: { type: "ARRAY", items: { type: "NUMBER" }, description: "[longitude, latitude] of the shipment destination" },
              disruption_coords: { type: "ARRAY", items: { type: "NUMBER" }, description: "[longitude, latitude] of the disruption location" }
            },
            required: ["incident_type", "severity_level", "impacted_node", "estimated_delay_hours", "origin_coords", "dest_coords", "disruption_coords"]
          },
          temperature: 0.2,
        }
      });
      
      const parsed = JSON.parse(response.text);
      
      // Map to the schema expected by the rest of the application
      const disruption = {
        type: parsed.incident_type,
        severity: parsed.severity_level >= 4 ? 'critical' : parsed.severity_level === 3 ? 'high' : 'medium',
        risk_score: parsed.severity_level / 5,
        affected_shipments: ["PO-8821", "PO-9910"],
        estimated_delay_hours: parsed.estimated_delay_hours,
        root_cause: parsed.incident_type,
        confidence: "high",
        time_to_sla_breach_hours: 12,
        description: parsed.impacted_node + " - " + (isRaw ? 'Raw Payload Auto-Parsed' : data.description),
        origin_coords: parsed.origin_coords,
        dest_coords: parsed.dest_coords,
        disruption_coords: parsed.disruption_coords
      };

      // Update Map State immediately with original route and disruption
      const mapStatePending = {
        disruption_coords: parsed.disruption_coords,
        origin_coords: parsed.origin_coords,
        dest_coords: parsed.dest_coords,
        options: []
      };
      setMapState(mapStatePending);
      
      setPipeline(p => ({ ...p, stage: 'detecting', disruption }));
      setIsProcessing(false);
      
      setTimeout(() => handlePlan(disruption), 1000);
    } catch (e: any) {
      console.error("AgentPanel Ingestion Error:", e);
      setIsProcessing(false);
      setPipeline(p => ({ ...p, stage: 'error', error: e.message || "Failed to ingest disruption data" }));
    }
  };

  const handlePlan = async (disruption: any) => {
    setPipeline(p => ({ ...p, stage: 'planning' }));
    setIsProcessing(true);
    setSelectedPlanIndex(0);
    
    const isCritical = disruption.severity === 'critical';
    
    let fleetContext = `\nCURRENT FLEET CAPACITY:\n- Ocean Freight: ${fleetState.ocean.active} active vessels (${fleetState.ocean.status})\n- Air Cargo: ${fleetState.air.active} active flights (${fleetState.air.status})\n- Ground Transport: ${fleetState.ground.active} active trucks (${fleetState.ground.status})\n`;
    
    // Inject Strategic Constraints
    let constraintsContext = `\nSTRATEGIC CONSTRAINTS (MANDATORY):
- Avoid Red Sea: ${config.avoidRedSea ? 'ACTIVE - Do not route any vessels through the Red Sea/Suez.' : 'INACTIVE'}
- Avoid Panama Canal: ${config.avoidPanamaCanal ? 'ACTIVE - Do not route via the Panama Canal.' : 'INACTIVE'}
- Strict Carbon Limits: ${config.strictCarbon ? 'ACTIVE - Heavily penalize Air Freight. Prefer Ocean/Rail even if SLA is breached.' : 'INACTIVE'}
`;

    let systemInstruction = "";
    if (isCritical) {
      systemInstruction = `You are the SupplyGuard Logistics Planner. You receive structured disruption data including the origin, destination, and disruption coordinates.
Your task is to formulate an optimal rerouting plan to bypass the disruption.
Rules:
1. You MUST use the find_nearest_facilities tool to discover actual physical Distribution Centers near the origin or destination.
2. You must use the get_wms_capacity tool to check warehouse availability before finalizing a destination. If the tool returns a capacity > 90%, you CANNOT use that node as a destination or waypoint. You must route to a different facility to prevent cascading bottlenecks.
3. You must use the get_fleet_status tool to ensure transport assets are available. If available_assets is returning 0 or critically low, you MUST force an alternative transport method (e.g., Ocean or Ground instead of Air), regardless of SLA delays.
4. You MUST use your internal geographic knowledge to find accurate coordinates for intermediate transit hubs or safe passages to avoid the disruption zone.
5. Generate three alternative routing options detailing the required asset, the new route, and the estimated cost.
6. For each option, you MUST provide an array of 'waypoints' ([longitude, latitude]) that the new route will take. The first waypoint MUST be the origin, the last MUST be the destination, and intermediate points MUST route around the disruption.
7. MULTI-MODAL LOGIC: If the disruption is located exactly at the Origin or Destination node (e.g., an airport closure or port strike), you CANNOT originate or terminate the main transport leg there. You MUST use the find_nearest_facilities tool to locate an alternative regional hub as a waypoint and assume ground transport connects the original node to this new hub. Let the waypoints array reflect this realistic physical detour.

${constraintsContext}

${GLOBAL_ROUTES_CONTEXT}

Before outputting JSON, you MUST output a <thinking> block detailing your step-by-step reasoning.
Then, you MUST output the final result in JSON matching this schema:
{
  "options": [
    {
      "carrier": "string",
      "route": "string",
      "waypoints": [[0.0, 0.0], [0.0, 0.0]],
      "cost_delta": 0,
      "delay_h": 0,
      "sla_compliant": true,
      "reliability": 0.9
    }
  ]
}`;
    } else {
      systemInstruction = `You are the SupplyGuard Logistics Planner. You receive structured disruption data including the origin, destination, and disruption coordinates.
Your task is to formulate an optimal rerouting plan to bypass the disruption.
Rules:
1. You MUST use the find_nearest_facilities tool to discover actual physical Distribution Centers near the origin or destination.
2. You must use the get_wms_capacity tool to check warehouse availability before finalizing a destination. If the tool returns a capacity > 90%, you CANNOT use that node as a destination or waypoint. You must route to a different facility to prevent cascading bottlenecks.
3. You must use the get_fleet_status tool to ensure transport assets are available. If available_assets is returning 0 or critically low, you MUST force an alternative transport method (e.g., Ocean or Ground instead of Air), regardless of SLA delays.
4. You MUST use your internal geographic knowledge to find accurate coordinates for intermediate transit hubs or safe passages to avoid the disruption zone.
5. Generate EXACTLY ONE optimal routing option detailing the required asset, the new route, and the estimated cost.
6. For each option, you MUST provide an array of 'waypoints' ([longitude, latitude]) that the new route will take. The first waypoint MUST be the origin, the last MUST be the destination, and intermediate points MUST route around the disruption.
7. MULTI-MODAL LOGIC: If the disruption is located exactly at the Origin or Destination node (e.g., an airport closure or port strike), you CANNOT originate or terminate the main transport leg there. You MUST use the find_nearest_facilities tool to locate an alternative regional hub as a waypoint and assume ground transport connects the original node to this new hub. Let the waypoints array reflect this realistic physical detour.

${constraintsContext}

${GLOBAL_ROUTES_CONTEXT}

Before outputting JSON, you MUST output a <thinking> block detailing your step-by-step reasoning.
Then, you MUST output the final result in JSON matching this schema:
{
  "options": [
    {
      "carrier": "string",
      "route": "string",
      "waypoints": [[0.0, 0.0], [0.0, 0.0]],
      "cost_delta": 0,
      "delay_h": 0,
      "sla_compliant": true,
      "reliability": 0.9
    }
  ]
}`;
    }

    const tools: any = [
      {
        functionDeclarations: [
          {
            name: "find_nearest_facilities",
            description: "Find the nearest active WMS distribution centers by geographic coordinates.",
            parameters: {
              type: "OBJECT",
              properties: { 
                lat: { type: "NUMBER" }, 
                lng: { type: "NUMBER" },
                max_radius_miles: { type: "NUMBER" }
              },
              required: ["lat", "lng"]
            }
          },
          {
            name: "get_wms_capacity",
            description: "Check warehouse availability and capacity for a given node ID.",
            parameters: {
              type: "OBJECT",
              properties: { node_id: { type: "STRING" } },
              required: ["node_id"]
            }
          },
          {
            name: "get_fleet_status",
            description: "Check transport asset availability for a given region and transport type.",
            parameters: {
              type: "OBJECT",
              properties: { region: { type: "STRING" }, transport_type: { type: "STRING" } },
              required: ["region", "transport_type"]
            }
          }
        ]
      }
    ];

    const contents: any[] = [
      { role: 'user', parts: [{ text: `Structured Disruption Data:\n${JSON.stringify(disruption)}\n${fleetContext}\nPlease formulate a routing plan.` }] }
    ];

    // Helper for Haversine distance
    const getMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 3958.8; // Radius of earth in miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    try {
      let response = await callServerGemini({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          tools,
          temperature: 0.2,
        }
      });
      
      let callCount = 0;
      while (response.functionCalls && response.functionCalls.length > 0 && callCount < 5) {
        callCount++;
        contents.push(response.candidates?.[0]?.content);
        const functionResponses = response.functionCalls.map((call: any) => {
          if (call.name === 'find_nearest_facilities') {
            const args = call.args as any;
            const wmsNodes = useStore.getState().wmsState;
            const radius = args.max_radius_miles || 1000;
            const nearest = wmsNodes
              .map(n => ({...n, distance: getMiles(args.lat, args.lng, n.lat, n.lng)}))
              .filter(n => n.distance <= radius)
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 3)
              .map(n => ({ id: n.id, name: n.name, distance_miles: Math.round(n.distance), capacity_pct: n.capacity_pct }));
            return { functionResponse: { id: call.id, name: call.name, response: { nearest_facilities: nearest } } };
          } else if (call.name === 'get_wms_capacity') {
            const args = call.args as any;
            const wmsNodes = useStore.getState().wmsState;
            const node = wmsNodes.find(n => n.id === args.node_id || n.region === args.node_id || n.name.includes(args.node_id));
            if (node) {
              return { functionResponse: { id: call.id, name: call.name, response: { capacity: `${node.capacity_pct}%`, status: node.status, active_docks: node.active_docks } } };
            }
            return { functionResponse: { id: call.id, name: call.name, response: { capacity: "unknown", status: "Node not found. Recommend falling back to nearest hub." } } };
          } else if (call.name === 'get_fleet_status') {
             const args = call.args as any;
             const currentFleet = useStore.getState().fleetState;
             let count = 0; let status = "Unknown";
             if (args.transport_type && args.transport_type.toLowerCase().includes('air')) {
               count = currentFleet.air.active; status = currentFleet.air.status;
             } else if (args.transport_type && args.transport_type.toLowerCase().includes('ocean')) {
               count = currentFleet.ocean.active; status = currentFleet.ocean.status;
             } else {
               count = currentFleet.ground.active; status = currentFleet.ground.status;
             }
            return { functionResponse: { id: call.id, name: call.name, response: { available_assets: count > 0 ? Math.max(1, Math.floor(count * 0.05)) : 0, status: status } } };
          }
          return { functionResponse: { id: call.id, name: call.name, response: { error: "Unknown function" } } };
        });
        contents.push({ role: 'user', parts: functionResponses });
        
        response = await callServerGemini({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            tools,
            temperature: 0.2
          }
        });
      }
      
      const rawText = response.text;
      const thinkingMatch = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/);
      const thinkingText = thinkingMatch ? thinkingMatch[1].trim() : "No reasoning provided by model.";
      
      const jsonStr = extractJSON(response.text);
      const parsed = JSON.parse(jsonStr);
      const plans = parsed.options || [];
      
      // Update Map State
      const mapStatePending = {
        disruption_coords: disruption.disruption_coords,
        origin_coords: disruption.origin_coords,
        dest_coords: disruption.dest_coords,
        options: plans
      };
      setMapState(mapStatePending);
      
      setPipeline(p => ({ ...p, stage: 'gating', plans, agentReasoning: isCritical ? thinkingText : '' }));
      setIsProcessing(false);
      
      if (isCritical) {
        setTimeout(() => handleGate(disruption, plans), 1000);
      } else {
        const autoGate: GateDecision = {
          decision: "auto_execute",
          failed_conditions: [],
          reason: "Non-critical scenario. Auto-executing generated plan.",
          urgency: "low"
        };
        setPipeline(p => ({ ...p, gate: autoGate }));
        setTimeout(() => handleExecute(disruption, plans[0], autoGate), 1000);
      }
    } catch (e: any) {
      console.error("AgentPanel Planning Error:", e);
      setIsProcessing(false);
      setPipeline(p => ({ ...p, stage: 'error', error: e.message || "Failed to generate plan" }));
    }
  };

  const handleGate = async (disruption: any, plans: any[]) => {
    setIsProcessing(true);
    
    const systemInstruction = `You are the SupplyGuard Governance Gatekeeper. You must review the primary routing plan proposed by the Logistics Planner.
Compare the proposed plan against the current administrative thresholds: Max Allowed Cost = $${config.maxCost} and Max Allowed Delay = ${config.maxDelay} hours.

If the plan exceeds these thresholds, or if the initial disruption severity is a Level 5 (or 'critical'), you must output a decision of "escalate" and provide a 2-sentence justification for the human operator.
If the plan is within thresholds and severity is below 5 (or not 'critical'), you must output a decision of "auto_execute" and summarize the action.

Return <thinking> block then JSON: {"decision": "auto_execute" | "escalate", "failed_conditions": [], "reason": "...", "urgency": "high" | "medium" | "low"}`;

    const prompt = `Evaluate and Gate this action.
PLAN (rank 1): ${JSON.stringify(plans[0])}
DISRUPTION: ${JSON.stringify(disruption)}`;

    try {
      const response = await callServerGemini({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1
        }
      });
      
      const jsonStr = extractJSON(response.text);
      const gate = JSON.parse(jsonStr);
      
      setPipeline(p => ({ ...p, gate }));
      setIsProcessing(false);
      
      if (gate.decision === 'auto_execute') {
        setTimeout(() => handleExecute(disruption, plans[0], gate), 1500);
      }
    } catch (e: any) {
      console.error("AgentPanel Gating Error:", e);
      setIsProcessing(false);
      setPipeline(p => ({ ...p, stage: 'error', error: e.message || "Failed to evaluate gate decision" }));
    }
  };

  const handleExecute = async (disruption: any, plan: any, gate: any) => {
    if (!plan) {
      plan = { carrier: "Unknown Carrier", route: "Unknown Route", delay_h: 0, cost_delta: 0 };
    }
    setPipeline(p => ({ ...p, stage: 'executing', execution: { status: 'running', steps_completed: [] } }));
    const steps = ["book_carrier","update_tms","write_erp","reserve_wms_dock","notify_customer","write_audit"];
    
    const completed: string[] = [];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 1500));
      completed.push(step);
      setPipeline(p => ({ ...p, execution: { status: 'running', steps_completed: [...completed] } }));
    }
    
    // Mutate Map State to show confirmed route
    useStore.setState(state => {
      if (state.mapState) {
        return { mapState: { ...state.mapState, options: [plan] } };
      }
      return state;
    });

    // Mutate Fleet State
    let generatedAssetId = "UNKNOWN";
    const f = JSON.parse(JSON.stringify(fleetState)); // Deep copy
    const carrierLower = (plan.carrier || "").toLowerCase();
    let type = "GROUND";
    let color = "#00ff41";
    let prefix = "TRK";
    
    if (carrierLower.includes("air") || carrierLower.includes("flight")) {
      type = "AIR"; color = "#ff5500"; prefix = "FLT";
      f.air.active -= 1; // DECREMENT indicating an asset has been consumed
      if (f.air.active < 0) f.air.active = 0;
    } else if (carrierLower.includes("ocean") || carrierLower.includes("sea") || carrierLower.includes("vessel") || carrierLower.includes("ship")) {
      type = "OCEAN"; color = "#00e5ff"; prefix = "VSL";
      f.ocean.active -= 1;
      if (f.ocean.active < 0) f.ocean.active = 0;
    } else {
      f.ground.active -= 1;
      if (f.ground.active < 0) f.ground.active = 0;
    }

    generatedAssetId = `${prefix}-${Math.floor(Math.random() * 9000) + 1000}`;

    const newRoute = {
      id: generatedAssetId,
      type: type,
      origin: disruption.description.split(' ')[0] || "Disruption Zone",
      dest: "Reroute Dest",
      eta: new Date(Date.now() + (plan.delay_h || 24) * 3600000).toISOString().split('.')[0] + "Z",
      status: "REROUTED",
      color: color
    };

    f.activeRoutes.unshift(newRoute);
    setFleetState(f);

    // Mutate WMS State
    const wmsNodes = JSON.parse(JSON.stringify(wmsState)); // Deep copy
    // Find the node that closely matches the new destination (or just grab the one with the lowest capacity to simulate load spreading)
    const targetNode = wmsNodes.sort((a: any, b: any) => a.capacity_pct - b.capacity_pct)[0];
    if (targetNode) {
      const incomingVolume = (disruption.affected_shipments?.length || 1) * 200;
      targetNode.inbound_shipments += incomingVolume;
      targetNode.capacity_pct = Math.min(100, targetNode.capacity_pct + Math.floor(Math.random() * 15) + 10); // CRITICAL: Spike capacity significantly to force constraints on next run
      
      if (targetNode.capacity_pct >= 90) {
        targetNode.status = 'critical';
      } else if (targetNode.capacity_pct >= 80) {
        targetNode.status = 'warning';
      }

      targetNode.last_updated = new Date().toISOString();
    }
    setWmsState(wmsNodes);

    setPipeline(p => ({ ...p, execution: { status: 'complete', steps_completed: completed }, stage: 'auditing' }));
    
    setTimeout(() => handleAudit(disruption, plan, gate, completed, generatedAssetId), 1000);
  };

  const handleAudit = (disruption: any, plan: any, gate: any, steps: string[], asset_id?: string) => {
    const entry: AuditEntry = {
      audit_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      disruption_type: disruption.type || 'unknown',
      disruption_summary: disruption.root_cause || disruption.description || 'Unknown',
      plan_selected: plan.carrier || 'Unknown',
      decision_type: gate.decision || 'unknown',
      cost_delta_usd: plan.cost_delta || 0,
      delay_hours: plan.delay_h || 0,
      sla_preserved: plan.sla_compliant || false,
      steps_completed: steps,
      asset_id: asset_id || 'UNKNOWN'
    };
    
    const newLogs = [entry, ...auditLog];
    setAuditLog(newLogs);
    
    // Asynchronously persist to Firebase Firestore
    recordAuditEntryInFirestore(entry).catch((err) => {
      console.warn('Firestore audit record note:', err);
    });

    setPipeline(p => ({ ...p, stage: 'complete', auditId: entry.audit_id }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto rounded-lg border border-[#e5e1d8] bg-white shadow-xs overflow-hidden">
      {/* Terminal Header */}
      <div className="p-4 border-b border-[#e5e1d8] bg-[#fbfaf7] flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#0f2b48] text-white flex items-center justify-center">
            <TerminalIcon className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div>
            <h3 className="font-display font-bold uppercase tracking-tight text-[#111827] text-sm">
              SupplyGuard Autonomous Agent Terminal
            </h3>
            <div className="text-[11px] font-mono text-[#6b7280]">
              Three-Stage Disruption Pipeline // Gemini Autonomous Engine
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 font-mono text-xs">
          <div className="px-2.5 py-1 rounded bg-[#15803d]/10 text-[#15803d] font-bold border border-[#15803d]/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] animate-pulse" />
            <span>Latency: 1.2ms</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-[#0f2b48]/10 text-[#0f2b48] font-bold border border-[#0f2b48]/20">
            Auto-Exec: {config.autoMode ? 'Armed' : 'Standby'}
          </div>
        </div>
      </div>

      {/* Three-Stage Architecture Validation Strip (Directly Justifying Landing Page Claim) */}
      <div className="px-5 py-3 border-b border-[#e5e1d8] bg-[#fbfaf7]/60 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#0f2b48] text-white flex items-center justify-center text-[10px] font-bold">1</span>
          <span className="font-semibold text-[#111827]">Ingestion:</span>
          <span className="text-[#6b7280]">Dual-Stream EDI & Carrier Feed</span>
        </div>
        <span className="text-[#d1d5db] hidden md:inline">→</span>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#163b61] text-white flex items-center justify-center text-[10px] font-bold">2</span>
          <span className="font-semibold text-[#111827]">Compute:</span>
          <span className="text-[#6b7280]">WMS Nodes + Fleet Sync</span>
        </div>
        <span className="text-[#d1d5db] hidden md:inline">→</span>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#c92a2a] text-white flex items-center justify-center text-[10px] font-bold">3</span>
          <span className="font-semibold text-[#111827]">Dispatch:</span>
          <span className="text-[#6b7280]">Gated Pathfinding (Google Maps)</span>
        </div>
      </div>

      {/* Progress Bar */}
      {pipeline.stage !== 'idle' && (
        <div className="p-4 bg-white border-b border-[#e5e1d8]">
          <StageProgressBar stage={pipeline.stage} />
        </div>
      )}

      {/* Terminal Output */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-6 font-mono text-xs bg-[#fbfaf7]/40">
        {pipeline.stage === 'idle' && auditLog.length > 0 && (
          <div className="space-y-2">
            <div className="text-[#6b7280] font-bold uppercase tracking-wider text-[11px] mb-3">
              Previous Session Audit Manifest ({auditLog.length} Reroute Logs)
            </div>
            {auditLog.map(entry => <AuditEntryRow key={entry.audit_id} entry={entry} />)}
          </div>
        )}

        {pipeline.stage === 'idle' && (
          <div className="space-y-4">
            <div className="flex rounded-md border border-[#e5e1d8] bg-white p-1 w-fit shadow-xs">
              <button 
                onClick={() => setIngestMode('manual')}
                className={`text-xs uppercase font-mono font-bold px-4 py-1.5 rounded transition-colors cursor-pointer ${
                  ingestMode === 'manual' ? 'bg-[#0f2b48] text-white' : 'text-[#6b7280] hover:text-[#0f2b48]'
                }`}
              >
                Manual Disruption Trigger
              </button>
              <button 
                onClick={() => setIngestMode('autonomous')}
                className={`text-xs uppercase font-mono font-bold px-4 py-1.5 rounded transition-colors cursor-pointer ${
                  ingestMode === 'autonomous' ? 'bg-[#0f2b48] text-white' : 'text-[#6b7280] hover:text-[#0f2b48]'
                }`}
              >
                Continuous API / EDI Listener
              </button>
            </div>

            {ingestMode === 'manual' ? (
              <IntakeForm onSubmit={(data) => handleIngest(data, false)} />
            ) : (
              <AutonomousListener onSubmit={(data) => handleIngest(data, true)} />
            )}
          </div>
        )}

        {pipeline.disruption && (
          <DisruptionCard disruption={pipeline.disruption} />
        )}

        {pipeline.agentReasoning && (
          <div className="rounded-lg border border-[#e5e1d8] bg-white p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 border-b border-[#f0ece3] pb-2.5">
              <Cpu className="w-4 h-4 text-[#0f2b48]" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#111827]">
                Agent Cognitive Vector Core (Step-by-Step Reasoner)
              </h4>
            </div>
            <pre className="text-[#0f2b48] font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-56 overflow-auto p-3 rounded bg-[#fbfaf7] border border-[#e5e1d8]">
              {pipeline.agentReasoning}
            </pre>
          </div>
        )}

        {pipeline.plans && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pipeline.plans.map((plan, i) => (
              <PlanOptionCard 
                key={i} 
                plan={plan} 
                rank={i + 1}
                selectable={pipeline.gate?.decision === 'escalate' && pipeline.stage === 'gating'}
                selected={pipeline.gate?.decision === 'escalate' && pipeline.stage === 'gating' && selectedPlanIndex === i}
                onClick={() => setSelectedPlanIndex(i)}
              />
            ))}
          </div>
        )}

        {pipeline.gate && (
          <GateBanner gate={pipeline.gate} />
        )}

        {pipeline.gate?.decision === 'escalate' && pipeline.stage === 'gating' && (
          <ApprovalCard 
            onApprove={() => handleExecute(pipeline.disruption, pipeline.plans![selectedPlanIndex], pipeline.gate)}
            onReject={() => setPipeline(p => ({ ...p, stage: 'idle' }))}
            onRequestAlt={() => handlePlan(pipeline.disruption)}
          />
        )}

        {pipeline.execution && (
          <ExecutionChecklist execution={pipeline.execution} />
        )}

        {pipeline.stage === 'complete' && (
          <div className="rounded-lg border border-[#15803d]/30 bg-[#15803d]/10 p-5 text-[#15803d] flex justify-between items-center font-mono font-bold">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>PIPELINE DISPATCH EXECUTED. AUDIT RECORD COMMITTED TO ERP.</span>
            </div>
            <button 
              onClick={() => setPipeline({ stage: 'idle', disruption: null, agentReasoning: '', plans: null, gate: null, execution: null, auditId: null, error: null })} 
              className="bg-[#0f2b48] text-white px-4 py-2 rounded uppercase font-bold text-xs hover:bg-[#163b61] transition-colors cursor-pointer"
            >
              Simulate Next Scenario
            </button>
          </div>
        )}

        {pipeline.stage === 'error' && (
          <div className="rounded-lg border border-[#c92a2a]/30 bg-[#c92a2a]/10 p-5 text-[#c92a2a] flex flex-col gap-3 font-mono">
            <div className="font-bold uppercase tracking-wider text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Pipeline Warning</span>
              </div>
            </div>
            <div className="text-xs text-[#111827]">{pipeline.error}</div>
            <button 
              onClick={() => setPipeline({ stage: 'idle', disruption: null, agentReasoning: '', plans: null, gate: null, execution: null, auditId: null, error: null })} 
              className="bg-transparent border border-[#c92a2a] text-[#c92a2a] px-4 py-1.5 rounded uppercase font-bold text-xs hover:bg-[#c92a2a]/10 w-fit cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-3 text-[#0f2b48] font-mono font-semibold p-4 rounded-lg border border-[#e5e1d8] bg-white shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0f2b48] animate-ping" />
            <span>Processing telemetry through neural pipeline (1.2ms latency target)...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// 1. IntakeForm
function IntakeForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({ type: 'weather', severity: 'high', origin: '', destination: '', disruptionLocation: '', description: '' });

  const DEMO_SCENARIOS = [
    { type: 'weather', severity: 'medium', origin: 'Chicago, IL', destination: 'New York, NY', disruptionLocation: 'Cleveland, OH', description: 'Minor snow squall slowing down I-80. 4 hour expected delay.' },
    { type: 'port', severity: 'medium', origin: 'Shanghai, China', destination: 'Los Angeles, USA', disruptionLocation: 'Port of Long Beach', description: 'Temporary congestion at gate 4. 8 hour loading delay expected.' },
    { type: 'carrier', severity: 'medium', origin: 'Dallas, TX', destination: 'Atlanta, GA', disruptionLocation: 'Shreveport, LA', description: 'Truck breakdown on I-20. Replacement cab dispatched, 6 hour delay.' },
    { type: 'customs', severity: 'medium', origin: 'Monterrey, Mexico', destination: 'Detroit, MI', disruptionLocation: 'Laredo Border', description: 'Routine intensive customs checks. 5 hour border crossing delays.' },
    { type: 'port', severity: 'critical', origin: 'Singapore', destination: 'Rotterdam', disruptionLocation: 'Suez Canal', description: 'Draught blockage at the Suez Canal delaying all Asia-Europe maritime traffic. Cape of Good Hope reroute evaluation requested.' },
    { type: 'weather', severity: 'critical', origin: 'Long Beach, CA', destination: 'Chicago, IL', disruptionLocation: 'I-80 Wyoming', description: 'Massive blizzard halting ground freight. Reroute via Southern BNSF rail line.' }
  ];

  const loadRandomScenario = () => {
    const randomIndex = Math.floor(Math.random() * DEMO_SCENARIOS.length);
    setForm(DEMO_SCENARIOS[randomIndex]);
  };

  return (
    <div className="rounded-lg border border-[#e5e1d8] p-5 bg-white shadow-xs flex flex-col gap-4 font-mono">
      <div className="flex flex-wrap justify-between items-center border-b border-[#f0ece3] pb-3 gap-2">
        <div className="text-[#0f2b48] font-bold uppercase tracking-wider text-xs">Simulate Inbound Incident</div>
        <button 
          onClick={loadRandomScenario} 
          className="text-xs px-3 py-1.5 rounded-md border border-[#0f2b48]/30 text-[#0f2b48] hover:bg-[#0f2b48]/5 transition-colors font-bold cursor-pointer"
        >
          Populate Scenario
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select 
          className="bg-[#fbfaf7] border border-[#e5e1d8] rounded-md text-[#111827] p-2.5 text-xs font-mono uppercase focus:outline-none" 
          value={form.type} 
          onChange={e => setForm({...form, type: e.target.value})}
        >
          <option value="weather">Weather Disruption</option>
          <option value="port">Port Congestion</option>
          <option value="carrier">Carrier Equipment Breakdown</option>
          <option value="customs">Customs Bottleneck</option>
          <option value="geopolitical">Geopolitical Chokepoint</option>
        </select>

        <select 
          className="bg-[#fbfaf7] border border-[#e5e1d8] rounded-md text-[#111827] p-2.5 text-xs font-mono uppercase focus:outline-none" 
          value={form.severity} 
          onChange={e => setForm({...form, severity: e.target.value})}
        >
          <option value="critical">Critical (Mandatory Gating)</option>
          <option value="high">High Severity</option>
          <option value="medium">Medium (Autonomous Threshold)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input 
          type="text" 
          placeholder="ORIGIN (e.g. Shanghai, China)" 
          className="bg-[#fbfaf7] border border-[#e5e1d8] rounded-md text-[#111827] p-2.5 text-xs font-mono uppercase focus:outline-none" 
          value={form.origin} 
          onChange={e => setForm({...form, origin: e.target.value})} 
        />
        <input 
          type="text" 
          placeholder="DESTINATION (e.g. Rotterdam, Netherlands)" 
          className="bg-[#fbfaf7] border border-[#e5e1d8] rounded-md text-[#111827] p-2.5 text-xs font-mono uppercase focus:outline-none" 
          value={form.destination} 
          onChange={e => setForm({...form, destination: e.target.value})} 
        />
      </div>

      <input 
        type="text" 
        placeholder="DISRUPTION LOCATION (e.g. Suez Canal / Port of Long Beach)" 
        className="bg-[#fbfaf7] border border-[#e5e1d8] rounded-md text-[#111827] p-2.5 text-xs font-mono uppercase focus:outline-none" 
        value={form.disruptionLocation} 
        onChange={e => setForm({...form, disruptionLocation: e.target.value})} 
      />

      <textarea 
        placeholder="INCIDENT DESCRIPTION..." 
        className="bg-[#fbfaf7] border border-[#e5e1d8] rounded-md text-[#111827] p-2.5 text-xs uppercase h-20 resize-none font-mono focus:outline-none" 
        value={form.description} 
        onChange={e => setForm({...form, description: e.target.value})} 
      />

      <button 
        onClick={() => onSubmit(form)} 
        className="bg-[#0f2b48] text-white font-bold uppercase text-xs py-3 rounded-md hover:bg-[#163b61] transition-colors cursor-pointer shadow-xs"
      >
        Trigger Autonomous Decision Engine
      </button>
    </div>
  );
}

// 1.5 AutonomousListener
function AutonomousListener({ onSubmit }: { onSubmit: (data: string) => void }) {
  const [payload, setPayload] = useState('');

  const DEMO_PAYLOAD = `{
  "event_source": "CARRIER_API_WEBHOOK",
  "carrier_id": "MAERSK_LINE",
  "timestamp": "${new Date().toISOString()}",
  "shipment_status": "EXCEPTION",
  "origin_port": "NGB (Ningbo)",
  "destination_port": "LGB (Long Beach)",
  "vessel_imo": "9811000",
  "exception_details": {
    "code": "WX_TYPHOON",
    "description": "Vessel halting transit mid-Pacific due to unforecasted Super Typhoon approach. Expected stationary holding pattern.",
    "estimated_delay_hrs": 72
  }
}`;

  return (
    <div className="rounded-lg border border-[#e5e1d8] p-5 bg-white shadow-xs flex flex-col gap-3 font-mono">
      <div className="flex justify-between items-center border-b border-[#f0ece3] pb-3">
        <div className="text-[#0f2b48] font-bold uppercase tracking-wider text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
          <span>Live Ingestion Listener: WSS // API // EDI_X12</span>
        </div>
        <button 
          onClick={() => setPayload(DEMO_PAYLOAD)} 
          className="text-xs px-3 py-1.5 rounded-md border border-[#0f2b48]/30 text-[#0f2b48] hover:bg-[#0f2b48]/5 transition-colors font-bold cursor-pointer"
        >
          Inject EDI Payload
        </button>
      </div>

      <textarea 
        placeholder="RAW EDI PAYLOAD..." 
        className="bg-[#fbfaf7] border border-[#e5e1d8] rounded-md text-[#111827] p-3 text-xs font-mono h-40 resize-none focus:outline-none" 
        value={payload} 
        onChange={e => setPayload(e.target.value)} 
        spellCheck={false}
      />

      <button 
        onClick={() => { if (payload) onSubmit(payload); }} 
        disabled={!payload}
        className={`font-bold uppercase text-xs py-3 rounded-md transition-colors ${
          payload ? 'bg-[#0f2b48] text-white hover:bg-[#163b61] cursor-pointer' : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        {payload ? 'Ingest & Formulate Reroute' : 'Awaiting Payload...'}
      </button>
    </div>
  );
}

// 2. StageProgressBar
function StageProgressBar({ stage }: { stage: PipelineStage }) {
  const stages = ['ingesting', 'detecting', 'planning', 'gating', 'executing', 'auditing', 'complete'];
  const currentIndex = stages.indexOf(stage);
  
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
      {['INGESTION', 'DETECTION', 'PLANNING', 'GATEKEEPER', 'DISPATCH', 'ERP AUDIT'].map((s, i) => {
        const isActive = currentIndex === i;
        const isPast = currentIndex > i;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border transition-all ${
              isActive 
                ? 'border-[#0f2b48] text-white bg-[#0f2b48] shadow-xs' 
                : isPast 
                ? 'border-[#15803d]/40 text-[#15803d] bg-[#15803d]/10' 
                : 'border-[#e5e1d8] text-[#9ca3af] bg-[#fbfaf7]'
            }`}>
              {isPast ? <Check className="w-3.5 h-3.5 inline mr-1" /> : null}
              {s}
            </div>
            {i < 5 && <ArrowRight className={`w-3.5 h-3.5 ${isPast ? 'text-[#15803d]' : 'text-[#d1d5db]'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// 3. DisruptionCard
function DisruptionCard({ disruption }: { disruption: DisruptionJSON }) {
  return (
    <div className="rounded-lg border border-[#c92a2a]/30 bg-[#c92a2a]/5 p-5 shadow-xs font-mono">
      <div className="flex justify-between items-start mb-3 border-b border-[#c92a2a]/20 pb-2.5">
        <div className="text-[#c92a2a] font-bold uppercase tracking-wider text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> 
          <span>Disruption Detected // Incident Vector Active</span>
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded bg-white border border-[#c92a2a]/30 text-[#c92a2a] uppercase font-bold">
          Confidence: {disruption.confidence || 'HIGH'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
        <div><span className="text-[#6b7280]">TYPE:</span> <span className="text-[#111827] font-bold ml-1">{disruption.type}</span></div>
        <div><span className="text-[#6b7280]">SEVERITY:</span> <span className="text-[#c92a2a] font-bold ml-1">{disruption.severity}</span></div>
        <div><span className="text-[#6b7280]">RISK SCORE:</span> <span className="text-[#111827] font-bold ml-1">{((disruption.risk_score || 0) * 100).toFixed(0)}%</span></div>
        <div><span className="text-[#6b7280]">SLA WINDOW:</span> <span className="text-[#111827] font-bold ml-1">{disruption.time_to_sla_breach_hours || 0}H</span></div>
      </div>

      <div className="text-xs text-[#111827] font-sans leading-relaxed">
        <span className="font-mono font-bold text-[#6b7280]">ROOT CAUSE:</span> {disruption.root_cause || disruption.description}
      </div>
    </div>
  );
}

// 4. PlanOptionCard
function PlanOptionCard({ plan, rank, selectable, selected, onClick }: { plan: PlanOption, rank: number, selectable?: boolean, selected?: boolean, onClick?: () => void }) {
  if (!plan) return null;
  return (
    <div 
      className={`p-4 rounded-lg border transition-all shadow-xs font-mono ${
        selectable ? 'cursor-pointer hover:border-[#0f2b48] hover:bg-[#0f2b48]/5' : ''
      } ${
        selected ? 'border-[#0f2b48] bg-[#0f2b48]/10 ring-2 ring-[#0f2b48]' : 'border-[#e5e1d8] bg-white'
      }`}
      onClick={selectable ? onClick : undefined}
    >
      <div className="flex justify-between items-center mb-2.5 border-b border-[#f0ece3] pb-2">
        <span className="font-bold text-xs text-[#0f2b48]">OPTION 0{rank}</span>
        {selected && <span className="text-[10px] font-bold text-[#0f2b48]">[SELECTED]</span>}
      </div>

      <div className="text-xs space-y-1.5">
        <div><span className="text-[#6b7280]">CARRIER:</span> <span className="text-[#111827] font-bold ml-1">{plan.carrier}</span></div>
        <div><span className="text-[#6b7280]">ROUTE:</span> <span className="text-[#0f2b48] font-bold ml-1">{plan.route}</span></div>
        <div><span className="text-[#6b7280]">COST DELTA:</span> <span className="text-[#111827] font-bold ml-1">+${plan.cost_delta}</span></div>
        <div><span className="text-[#6b7280]">DELAY:</span> <span className="text-[#111827] font-bold ml-1">+{plan.delay_h}h</span></div>
        <div className="pt-1.5 border-t border-[#f0ece3]">
          <span className="text-[#6b7280]">SLA:</span> 
          <span className={`font-bold ml-1.5 ${plan.sla_compliant ? 'text-[#15803d]' : 'text-[#c92a2a]'}`}>
            {plan.sla_compliant ? 'COMPLIANT (PRESERVED)' : 'BREACH'}
          </span>
        </div>
      </div>
    </div>
  );
}

// 5. GateBanner
function GateBanner({ gate }: { gate: GateDecision }) {
  const isAuto = gate.decision === 'auto_execute';
  return (
    <div className={`p-4 rounded-lg border font-mono ${
      isAuto 
        ? 'border-[#15803d]/30 bg-[#15803d]/10 text-[#15803d]' 
        : 'border-[#c92a2a]/30 bg-[#c92a2a]/10 text-[#c92a2a]'
    }`}>
      <div className="font-bold uppercase tracking-wider text-xs mb-1">
        {isAuto ? 'GATEKEEPER VERIFICATION: AUTO-EXECUTE APPROVED' : 'GATEKEEPER ESCALATION: HUMAN APPROVAL REQUIRED'}
      </div>
      <div className="text-xs text-[#111827] font-sans">{gate.reason}</div>
    </div>
  );
}

// 6. ApprovalCard
function ApprovalCard({ onApprove, onReject, onRequestAlt }: any) {
  return (
    <div className="p-4 rounded-lg border border-[#e5e1d8] bg-white flex flex-wrap gap-3 font-mono text-xs shadow-xs">
      <button onClick={onApprove} className="flex-1 py-2.5 px-4 rounded bg-[#15803d] text-white font-bold uppercase hover:bg-green-700 transition-colors cursor-pointer">
        Approve & Dispatch
      </button>
      <button onClick={onReject} className="flex-1 py-2.5 px-4 rounded bg-[#c92a2a] text-white font-bold uppercase hover:bg-red-700 transition-colors cursor-pointer">
        Reject Reroute
      </button>
      <button onClick={onRequestAlt} className="flex-1 py-2.5 px-4 rounded border border-[#e5e1d8] text-[#111827] font-bold uppercase hover:bg-stone-100 transition-colors cursor-pointer">
        Request Alternate Plan
      </button>
    </div>
  );
}

// 7. ExecutionChecklist
function ExecutionChecklist({ execution }: { execution: ExecutionResult }) {
  const allSteps = [
    "book_carrier_capacity",
    "update_tms_manifest",
    "commit_erp_sap_record",
    "reserve_wms_alternate_dock",
    "notify_carrier_dispatch",
    "write_governance_audit"
  ];
  return (
    <div className="p-5 rounded-lg border border-[#e5e1d8] bg-white shadow-xs font-mono">
      <div className="text-xs font-bold uppercase tracking-wider text-[#0f2b48] mb-3 border-b border-[#f0ece3] pb-2">
        Execution & Dispatch Sequence
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {allSteps.map((step, i) => {
          const isDone = execution.steps_completed.includes(step);
          return (
            <div key={step} className={`text-xs flex items-center gap-2 p-2 rounded ${
              isDone ? 'bg-[#15803d]/10 text-[#15803d] font-bold' : 'text-[#9ca3af] bg-[#fbfaf7]'
            }`}>
              {isDone ? <Check className="w-3.5 h-3.5 text-[#15803d]" /> : <div className="w-3.5 h-3.5 rounded-full border border-stone-300" />}
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 8. AuditEntryRow
function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="p-3.5 rounded-md bg-white border border-[#e5e1d8] text-xs font-mono flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="text-[#6b7280] font-semibold">{entry.timestamp.split('T')[1].slice(0, 8)}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          entry.decision_type === 'auto_execute' ? 'bg-[#15803d]/10 text-[#15803d]' : 'bg-[#c92a2a]/10 text-[#c92a2a]'
        }`}>
          {entry.decision_type.toUpperCase()}
        </span>
        <span className="font-sans font-medium text-[#111827] truncate max-w-xs">{entry.disruption_summary}</span>
      </div>

      <div className="flex items-center gap-4 text-[#111827]">
        <span className="text-[#0f2b48] font-bold">{entry.plan_selected}</span>
        <span>+${entry.cost_delta_usd}</span>
        <span>+{entry.delay_hours}h</span>
        <span className={`font-bold ${entry.sla_preserved ? 'text-[#15803d]' : 'text-[#c92a2a]'}`}>
          {entry.sla_preserved ? 'SLA PRESERVED' : 'SLA BREACH'}
        </span>
      </div>
    </div>
  );
}

