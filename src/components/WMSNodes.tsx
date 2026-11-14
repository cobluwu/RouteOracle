import React, { useState } from 'react';
import { Warehouse, Box, Truck, AlertTriangle, Activity, ArrowDownToLine, ArrowUpFromLine, Layers, Filter } from 'lucide-react';
import { useStore } from '../store';

const GATEWAY_SATURATION = [
  { node: 'USEWR', name: 'Newark Gateway', demand: 85, capacity: 60, status: 'Restricted' },
  { node: 'NLRTM', name: 'Rotterdam Terminal', demand: 90, capacity: 85, status: 'Warning' },
  { node: 'SGSIN', name: 'Singapore Mega-Hub', demand: 60, capacity: 100, status: 'Optimal' },
  { node: 'CNPVG', name: 'Shanghai Deepwater', demand: 95, capacity: 50, status: 'Critical Saturation' },
  { node: 'USLAX', name: 'Los Angeles DC', demand: 75, capacity: 80, status: 'Optimal' },
];

export default function WMSNodes() {
  const nodes = useStore(state => state.wmsState);
  const [selectedTier, setSelectedTier] = useState<number | 'all'>('all');

  const filteredNodes = selectedTier === 'all' 
    ? nodes 
    : nodes.filter(n => n.tier === selectedTier);

  const getStatusBadge = (status: string, capacity: number) => {
    if (capacity >= 90 || status === 'critical') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#c92a2a]/10 text-[#c92a2a]">CRITICAL LOAD</span>;
    }
    if (capacity >= 75 || status === 'warning') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#b45309]/10 text-[#b45309]">ELEVATED</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#15803d]/10 text-[#15803d]">OPTIMAL BUFFER</span>;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1d8] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#c92a2a] uppercase tracking-wider mb-1">
            <Warehouse className="w-4 h-4 text-[#0f2b48]" />
            <span>Facility Buffer & Inventory Mesh</span>
          </div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#111827]">
            WMS Nodes & Gateway Saturation
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-md bg-white border border-[#e5e1d8] text-xs font-mono">
            <span className="text-[#6b7280] px-2">Tier Filter:</span>
            <button
              onClick={() => setSelectedTier('all')}
              className={`px-2.5 py-1 rounded transition-colors ${selectedTier === 'all' ? 'bg-[#0f2b48] text-white font-bold' : 'text-[#4b5563] hover:bg-stone-100'}`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedTier(1)}
              className={`px-2.5 py-1 rounded transition-colors ${selectedTier === 1 ? 'bg-[#0f2b48] text-white font-bold' : 'text-[#4b5563] hover:bg-stone-100'}`}
            >
              Tier 1 Gateways
            </button>
            <button
              onClick={() => setSelectedTier(2)}
              className={`px-2.5 py-1 rounded transition-colors ${selectedTier === 2 ? 'bg-[#0f2b48] text-white font-bold' : 'text-[#4b5563] hover:bg-stone-100'}`}
            >
              Tier 2 RDCs
            </button>
          </div>
        </div>
      </div>

      {/* Global WMS Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-lg border border-[#e5e1d8] bg-white shadow-xs">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6b7280] mb-1">Monitored Facilities</div>
          <div className="text-3xl font-display font-extrabold text-[#111827] tabular-nums">{nodes.length} Active Nodes</div>
          <div className="text-xs text-[#4b5563] mt-1 font-sans">Across AMER, EMEA & APAC</div>
        </div>

        <div className="p-5 rounded-lg border border-[#e5e1d8] bg-white shadow-xs">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6b7280] mb-1">Network Capacity Utilization</div>
          <div className="text-3xl font-display font-extrabold text-[#0f2b48] tabular-nums">
            {Math.round(nodes.reduce((acc, n) => acc + n.capacity_pct, 0) / nodes.length)}%
          </div>
          <div className="text-xs text-[#15803d] mt-1 font-mono font-semibold">Buffered: Safe operating band</div>
        </div>

        <div className="p-5 rounded-lg border border-[#e5e1d8] bg-white shadow-xs">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6b7280] mb-1">Live Inbound Shipments</div>
          <div className="text-3xl font-display font-extrabold text-[#111827] tabular-nums">
            {nodes.reduce((acc, n) => acc + n.inbound_shipments, 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#4b5563] mt-1 font-sans">Active dock staging queues</div>
        </div>

        <div className="p-5 rounded-lg border border-[#e5e1d8] bg-white shadow-xs">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6b7280] mb-1">Critical Saturation Points</div>
          <div className="text-3xl font-display font-extrabold text-[#c92a2a] tabular-nums">
            {nodes.filter(n => n.capacity_pct >= 90).length} Nodes
          </div>
          <div className="text-xs text-[#c92a2a] mt-1 font-mono font-semibold">Auto-diversion routes active</div>
        </div>
      </div>

      {/* Figure 5 Validation: Gateway Saturation Index Banner */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1d8] pb-4 mb-5">
          <div>
            <div className="text-xs font-mono font-bold text-[#6b7280] uppercase tracking-wider mb-1">
              Figure 5 Validation: Inbound Demand vs Carrier Buffer Capacity
            </div>
            <h3 className="text-lg font-display font-bold uppercase tracking-tight text-[#111827] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0f2b48]" />
              Gateway Saturation Index & Queue Prevention
            </h3>
          </div>
          <div className="text-xs font-mono text-[#6b7280]">
            Autonomous cross-referencing prevents rerouting shipments into congested queues.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {GATEWAY_SATURATION.map((item, idx) => (
            <div key={idx} className="p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8] font-mono text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-[#111827] text-sm">{item.node}</span>
                <span className={`text-[10px] font-bold ${item.capacity < 70 ? 'text-[#c92a2a]' : 'text-[#15803d]'}`}>
                  {item.status}
                </span>
              </div>
              <div className="text-[11px] text-[#6b7280] mb-2">{item.name}</div>
              
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Inbound Demand:</span>
                  <span className="font-bold text-[#0f2b48]">{item.demand}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Buffer Capacity:</span>
                  <span className={`font-bold ${item.capacity < 70 ? 'text-[#c92a2a]' : 'text-[#15803d]'}`}>{item.capacity}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nodes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredNodes.map((node) => (
          <div key={node.id} className="rounded-lg border border-[#e5e1d8] bg-white p-5 shadow-xs flex flex-col justify-between">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between mb-3 border-b border-[#f0ece3] pb-3">
                <div>
                  <div className="text-[11px] font-mono font-bold text-[#0f2b48]">{node.id}</div>
                  <h3 className="text-base font-display font-bold text-[#111827] mt-0.5">
                    {node.name}
                  </h3>
                  <div className="text-[11px] font-mono text-[#6b7280]">Region: {node.region} · Tier {node.tier}</div>
                </div>
                <div>{getStatusBadge(node.status, node.capacity_pct)}</div>
              </div>

              {/* Capacity Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[11px] font-mono mb-1.5">
                  <span className="text-[#6b7280]">Storage Capacity</span>
                  <span className={`font-bold ${node.capacity_pct >= 90 ? 'text-[#c92a2a]' : 'text-[#111827]'}`}>
                    {node.capacity_pct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[#f4f2ec] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      node.capacity_pct >= 90 ? 'bg-[#c92a2a]' : node.capacity_pct >= 75 ? 'bg-[#b45309]' : 'bg-[#15803d]'
                    }`}
                    style={{ width: `${node.capacity_pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Docks & Flow */}
            <div className="pt-3 border-t border-[#f0ece3] grid grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <div className="text-[11px] text-[#6b7280]">Active Docks</div>
                <div className="text-sm font-bold text-[#111827] mt-0.5">
                  {node.active_docks} <span className="text-[#9ca3af] font-normal">/ {node.total_docks}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-[#6b7280]">Inbound / Outbound</div>
                <div className="text-sm font-bold text-[#0f2b48] mt-0.5">
                  {node.inbound_shipments} <span className="text-[#9ca3af] font-normal">/ {node.outbound_shipments}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
