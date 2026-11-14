import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { 
  Navigation, 
  Map as MapIcon, 
  Layers, 
  AlertTriangle, 
  Radio, 
  Train, 
  Compass, 
  Maximize2, 
  Minimize2, 
  Info, 
  Ship, 
  Plane, 
  Truck, 
  CheckCircle2, 
  Activity,
  Anchor,
  Globe2,
  MapPin,
  ExternalLink
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface SelectedInfo {
  type: 'origin' | 'destination' | 'disruption' | 'waypoint' | 'wms';
  position: { lat: number; lng: number };
  title: string;
  details?: Record<string, any>;
}

// Global shipping lanes and maritime choke points for tactical rendering
const MARITIME_CORRIDORS = [
  // Transpacific (Asia to US West Coast)
  { id: 'TP-1', name: 'Transpacific Northern', points: [[121.47, 31.23], [140.0, 38.0], [-160.0, 45.0], [-130.0, 40.0], [-118.24, 34.05]] },
  // Asia to Europe via Suez
  { id: 'AE-1', name: 'Suez Gateway Corridor', points: [[121.47, 31.23], [103.81, 1.35], [80.0, 6.0], [43.5, 12.5], [32.5, 29.9], [14.0, 36.0], [-5.6, 36.0], [4.47, 51.92]] },
  // Asia to Europe via Cape of Good Hope
  { id: 'AE-2', name: 'Cape Circumvention Route', points: [[121.47, 31.23], [103.81, 1.35], [75.0, -5.0], [45.0, -25.0], [18.4, -34.3], [-10.0, -10.0], [-15.0, 20.0], [4.47, 51.92]] },
  // Transatlantic
  { id: 'TA-1', name: 'North Atlantic Trunk', points: [[4.47, 51.92], [-10.0, 50.0], [-45.0, 42.0], [-74.0, 40.7]] },
  // Eurasian Rail
  { id: 'ER-1', name: 'Eurasian Intermodal Rail', points: [[106.55, 29.56], [87.61, 43.82], [61.4, 55.1], [37.6, 55.7], [19.0, 52.2], [6.76, 51.43]] },
];

// Major Choke Points
const CHOKEPOINTS = [
  { name: 'Suez Canal', coords: [32.34, 30.7], risk: 'Medium-High', type: 'Canal' },
  { name: 'Strait of Malacca', coords: [101.5, 2.5], risk: 'Moderate', type: 'Strait' },
  { name: 'Bab-el-Mandeb', coords: [43.3, 12.6], risk: 'High Conflict Zone', type: 'Strait' },
  { name: 'Panama Canal', coords: [-79.9, 9.1], risk: 'Draft Restrictions', type: 'Canal' },
  { name: 'Strait of Hormuz', coords: [56.4, 26.5], risk: 'Geopolitical Risk', type: 'Strait' },
  { name: 'English Channel / Dover', coords: [1.4, 51.0], risk: 'Congestion', type: 'Strait' },
];

// Dark Executive Map Theme matching SupplyGuard naval aesthetic
const DARK_TACTICAL_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0d1f33" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1f33" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#74889e" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c0d0e0" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#56718d" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#11263d" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#19324d" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#122336" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#234468" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#07121f" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3f5974" }]
  }
];

export default function GeoNetwork() {
  const mapData = useStore(state => state.mapState);
  const wmsNodes = useStore(state => state.wmsState);

  const [activeLayers, setActiveLayers] = useState({
    maritime: true,
    rail: true,
    wms: true,
    chokepoints: true,
  });

  const [viewPreset, setViewPreset] = useState<'global' | 'transpacific' | 'asia-europe' | 'americas'>('global');
  const [selectedInfo, setSelectedInfo] = useState<SelectedInfo | null>(null);

  // Map Engine Mode: 'google' | 'tactical'
  const [mapMode, setMapMode] = useState<'google' | 'tactical'>('google');
  const [googleStatus, setGoogleStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [googleErrorMessage, setGoogleErrorMessage] = useState<string | null>(null);

  // Google Maps DOM container ref and instances
  const googleMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const gmpObjectsRef = useRef<{
    polylines: any[];
    markers: any[];
  }>({ polylines: [], markers: [] });

  // Fallback map state if none loaded
  useEffect(() => {
    if (!mapData) {
      useStore.getState().setMapState({
        disruption_coords: [121.47, 31.23], // Shanghai
        origin_coords: [121.47, 31.23],
        dest_coords: [-118.24, 34.05], // Los Angeles
        options: [
          { carrier: "Air Charter Express", route: "PVG -> ANC -> LAX", cost_delta: 4500, delay_h: 12, reliability: 0.98, sla_compliant: true },
          { carrier: "Ocean Diversion (Busan Hub)", route: "CNSZX -> PUS -> USLAX", cost_delta: 2200, delay_h: 22, reliability: 0.92, sla_compliant: true },
          { carrier: "Eurasian Intermodal Rail", route: "Chongqing -> Duisburg Rail -> Atlantic", cost_delta: 3800, delay_h: 18, reliability: 0.95, sla_compliant: true },
        ]
      });
    }
  }, [mapData]);

  // Google Maps JavaScript API Script Tag Injection
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || (firebaseConfig as any)?.apiKey || '';
    
    if (!apiKey) {
      console.warn('No Google Maps API Key found in environment. Defaulting to Tactical Vector View.');
      setGoogleStatus('error');
      setGoogleErrorMessage('API Key required for Google Maps. Add VITE_GOOGLE_MAPS_API_KEY to your environment variables.');
      setMapMode('tactical');
      return;
    }

    // Check if script already loaded
    if (window.google && window.google.maps) {
      setGoogleStatus('ready');
      return;
    }

    const scriptId = 'gmp-dynamic-script-loader';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker,geometry`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => {
      setGoogleStatus('ready');
    };

    const handleError = () => {
      setGoogleStatus('error');
      setGoogleErrorMessage('Google Maps script failed to load. Check network connection or API key restrictions.');
      setMapMode('tactical');
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    // Global listener for Maps auth failure
    (window as any).gm_authFailure = () => {
      setGoogleStatus('error');
      setGoogleErrorMessage('Google Maps API authentication failed. Please verify your API key.');
      setMapMode('tactical');
    };

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, []);

  // Initialize and update Google Map instance
  useEffect(() => {
    if (mapMode !== 'google' || googleStatus !== 'ready' || !googleMapRef.current || !window.google?.maps) {
      return;
    }

    // Create Map if not already initialized
    if (!mapInstanceRef.current) {
      try {
        const map = new window.google.maps.Map(googleMapRef.current, {
          center: { lat: 25.0, lng: 10.0 },
          zoom: 2.3,
          minZoom: 1.8,
          maxZoom: 12,
          mapId: 'DEMO_MAP_ID',
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: window.google.maps.ControlPosition.TOP_RIGHT,
          },
          streetViewControl: false,
          fullscreenControl: true,
          styles: DARK_TACTICAL_MAP_STYLE,
          backgroundColor: '#07121f'
        });

        mapInstanceRef.current = map;
      } catch (err) {
        console.warn('Map initialization error:', err);
        setGoogleStatus('error');
        setMapMode('tactical');
        return;
      }
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean up previous polylines & markers
    gmpObjectsRef.current.polylines.forEach(p => p.setMap(null));
    gmpObjectsRef.current.markers.forEach(m => m.setMap(null));
    gmpObjectsRef.current.polylines = [];
    gmpObjectsRef.current.markers = [];

    // 1. Maritime Corridors & Rail
    if (activeLayers.maritime) {
      MARITIME_CORRIDORS.filter(c => c.id !== 'ER-1').forEach(corridor => {
        const path = corridor.points.map(pt => ({ lat: pt[1], lng: pt[0] }));
        const poly = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#0284c7',
          strokeOpacity: 0.65,
          strokeWeight: 2,
          map
        });
        gmpObjectsRef.current.polylines.push(poly);
      });
    }

    if (activeLayers.rail) {
      const railCorridor = MARITIME_CORRIDORS.find(c => c.id === 'ER-1');
      if (railCorridor) {
        const path = railCorridor.points.map(pt => ({ lat: pt[1], lng: pt[0] }));
        const poly = new window.google.maps.Polyline({
          path,
          geodesic: false,
          strokeColor: '#eab308',
          strokeOpacity: 0.8,
          strokeWeight: 2.5,
          map
        });
        gmpObjectsRef.current.polylines.push(poly);
      }
    }

    // 2. Active Disrupted & Rerouted Mission Lines
    if (mapData?.origin_coords && mapData?.dest_coords) {
      const orig = { lat: mapData.origin_coords[1], lng: mapData.origin_coords[0] };
      const dest = { lat: mapData.dest_coords[1], lng: mapData.dest_coords[0] };

      // Red disrupted original path
      const disruptedPoly = new window.google.maps.Polyline({
        path: [orig, dest],
        geodesic: true,
        strokeColor: '#ef4444',
        strokeOpacity: 0.6,
        strokeWeight: 2,
        map
      });
      gmpObjectsRef.current.polylines.push(disruptedPoly);

      // Green / Cyan reroute corridor
      const midLat = (orig.lat + dest.lat) / 2 + 10;
      const midLng = (orig.lng + dest.lng) / 2;
      const reroutePoly = new window.google.maps.Polyline({
        path: [orig, { lat: midLat, lng: midLng }, dest],
        geodesic: true,
        strokeColor: '#10b981',
        strokeOpacity: 0.95,
        strokeWeight: 3.5,
        map
      });
      gmpObjectsRef.current.polylines.push(reroutePoly);
    }

    // 3. WMS Warehouse Markers
    if (activeLayers.wms && wmsNodes && wmsNodes.length > 0) {
      wmsNodes.forEach((node: any) => {
        const isCritical = node.status === 'critical' || node.capacity_pct >= 90;
        const isWarning = node.status === 'warning' || node.capacity_pct >= 75;
        const color = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

        const marker = new window.google.maps.Marker({
          position: { lat: node.lat, lng: node.lng },
          map,
          title: node.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: node.tier === 1 ? 6.5 : 5,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          }
        });

        marker.addListener('click', () => {
          setSelectedInfo({
            type: 'wms',
            position: { lat: node.lat, lng: node.lng },
            title: `${node.name} (${node.id})`,
            details: {
              Region: node.region,
              Tier: `Tier ${node.tier}`,
              Utilization: `${node.capacity_pct}% Capacity`,
              Dock_Slots: `${node.active_docks} / ${node.total_docks} Active`,
              Inbound_Demand: `${node.inbound_shipments} Shipments`,
              Status: node.status.toUpperCase()
            }
          });
        });

        gmpObjectsRef.current.markers.push(marker);
      });
    }

    // 4. Strategic Choke Points
    if (activeLayers.chokepoints) {
      CHOKEPOINTS.forEach(cp => {
        const marker = new window.google.maps.Marker({
          position: { lat: cp.coords[1], lng: cp.coords[0] },
          map,
          title: cp.name,
          icon: {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 4,
            fillColor: '#f59e0b',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 1,
          }
        });

        marker.addListener('click', () => {
          setSelectedInfo({
            type: 'disruption',
            position: { lat: cp.coords[1], lng: cp.coords[0] },
            title: `Strategic Chokepoint: ${cp.name}`,
            details: {
              Risk_Level: cp.risk,
              Classification: cp.type,
              Coordinates: `${cp.coords[1]}°N, ${cp.coords[0]}°E`,
              Surveillance: 'Continuous Naval AIS Sync'
            }
          });
        });

        gmpObjectsRef.current.markers.push(marker);
      });
    }

    // 5. Active Disruption Zone
    if (mapData?.disruption_coords) {
      const pos = { lat: mapData.disruption_coords[1], lng: mapData.disruption_coords[0] };
      
      const circle = new window.google.maps.Circle({
        map,
        center: pos,
        radius: 400000, // 400km radius
        fillColor: '#ef4444',
        fillOpacity: 0.25,
        strokeColor: '#ef4444',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
      gmpObjectsRef.current.polylines.push(circle);

      const disMarker = new window.google.maps.Marker({
        position: pos,
        map,
        title: 'Active Disruption Anomaly',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      });

      disMarker.addListener('click', () => {
        setSelectedInfo({
          type: 'disruption',
          position: pos,
          title: 'Active Detected Disruption',
          details: {
            Type: 'High Severity Anomaly',
            Location: `${pos.lat.toFixed(2)}°N, ${pos.lng.toFixed(2)}°E`,
            Impact: 'Corridor Capacity Choked',
            Resolution: 'Autonomous Diversion Plan Active'
          }
        });
      });

      gmpObjectsRef.current.markers.push(disMarker);
    }

    // 6. Origin & Destination Pins
    if (mapData?.origin_coords) {
      const origPos = { lat: mapData.origin_coords[1], lng: mapData.origin_coords[0] };
      const origMarker = new window.google.maps.Marker({
        position: origPos,
        map,
        title: 'Origin Gateway',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#38bdf8',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      });
      origMarker.addListener('click', () => {
        setSelectedInfo({
          type: 'origin',
          position: origPos,
          title: 'Departure Origin Hub',
          details: {
            Hub: 'Shenzhen / Shanghai Maritime Gateway',
            Status: 'DISPATCHED',
            Vessel_Manifest: 'Tier-1 Contract Bound'
          }
        });
      });
      gmpObjectsRef.current.markers.push(origMarker);
    }

    if (mapData?.dest_coords) {
      const destPos = { lat: mapData.dest_coords[1], lng: mapData.dest_coords[0] };
      const destMarker = new window.google.maps.Marker({
        position: destPos,
        map,
        title: 'Destination Terminal',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      });
      destMarker.addListener('click', () => {
        setSelectedInfo({
          type: 'destination',
          position: destPos,
          title: 'Destination Terminal',
          details: {
            Hub: 'Port of Los Angeles / Long Beach Gateway',
            Status: 'INBOUND RESERVATION',
            SLA_Target: 'Zero Penalty Threshold'
          }
        });
      });
      gmpObjectsRef.current.markers.push(destMarker);
    }

  }, [mapMode, googleStatus, mapData, wmsNodes, activeLayers]);

  // Adjust camera when viewPreset changes
  useEffect(() => {
    if (mapMode === 'google' && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      if (viewPreset === 'global') {
        map.panTo({ lat: 25.0, lng: 10.0 });
        map.setZoom(2.3);
      } else if (viewPreset === 'transpacific') {
        map.panTo({ lat: 30.0, lng: -160.0 });
        map.setZoom(3);
      } else if (viewPreset === 'asia-europe') {
        map.panTo({ lat: 28.0, lng: 60.0 });
        map.setZoom(3);
      } else if (viewPreset === 'americas') {
        map.panTo({ lat: 35.0, lng: -95.0 });
        map.setZoom(3.5);
      }
    }
  }, [viewPreset, mapMode]);

  // SVG Canvas dimensions and coordinate projection for Tactical Vector Grid Mode
  const SVG_WIDTH = 960;
  const SVG_HEIGHT = 520;

  const projectCoords = useMemo(() => {
    return (lng: number, lat: number): [number, number] => {
      let normLng = lng;
      if (normLng > 180) normLng -= 360;
      if (normLng < -180) normLng += 360;

      const x = ((normLng + 180) / 360) * SVG_WIDTH;
      const clampedLat = Math.max(-75, Math.min(80, lat));
      const y = ((85 - clampedLat) / 160) * SVG_HEIGHT;
      return [x, y];
    };
  }, [SVG_WIDTH, SVG_HEIGHT]);

  const makePathData = (coords: number[][]) => {
    if (!coords || coords.length === 0) return '';
    return coords.reduce((acc, pt, idx) => {
      const [x, y] = projectCoords(pt[0], pt[1]);
      return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  };

  const originPos = mapData?.origin_coords ? projectCoords(mapData.origin_coords[0], mapData.origin_coords[1]) : null;
  const destPos = mapData?.dest_coords ? projectCoords(mapData.dest_coords[0], mapData.dest_coords[1]) : null;
  const disruptionPos = mapData?.disruption_coords ? projectCoords(mapData.disruption_coords[0], mapData.disruption_coords[1]) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1d8] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#c92a2a] uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4 text-[#0f2b48]" />
            <span>Geospatial Transit Corridors & Dynamic Maps</span>
          </div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#111827]">
            Tactical Network Operations
          </h2>
          <div className="text-xs text-[#6b7280] font-sans mt-0.5">
            Real-time multi-modal route projection, maritime lane monitoring, and autonomous corridor diversion engine
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-[#e5e1d8] text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${mapMode === 'google' && googleStatus === 'ready' ? 'bg-[#15803d]' : 'bg-[#0284c7]'} animate-pulse`}></span>
            <span className="font-bold text-[#0f2b48]">
              {mapMode === 'google' && googleStatus === 'ready' ? 'Google Maps: Live Script' : 'Vector Grid: Active'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0f2b48] text-white text-xs font-mono font-bold shadow-xs">
            <Activity className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>1,818 Tracked Assets</span>
          </div>
        </div>
      </div>

      {/* Main Tactical Map Frame */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white shadow-xs overflow-hidden">
        {/* Map Header Toolbar */}
        <div className="p-3 border-b border-[#e5e1d8] bg-[#fbfaf7] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Engine Selector: Google Maps vs Tactical Vector */}
            <div className="flex rounded-md border border-[#e5e1d8] bg-white p-0.5 shadow-2xs">
              <button
                onClick={() => setMapMode('google')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
                  mapMode === 'google' ? 'bg-[#0f2b48] text-white font-bold' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <MapPin className="w-3 h-3 text-[#38bdf8]" />
                <span>Google Maps API</span>
              </button>
              <button
                onClick={() => setMapMode('tactical')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
                  mapMode === 'tactical' ? 'bg-[#0f2b48] text-white font-bold' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Globe2 className="w-3 h-3 text-[#10b981]" />
                <span>Tactical Vector</span>
              </button>
            </div>

            {/* View Corridor Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#6b7280] hidden sm:inline">Corridor:</span>
              <div className="flex rounded-md border border-[#e5e1d8] bg-white p-0.5">
                <button 
                  onClick={() => setViewPreset('global')}
                  className={`px-2 py-0.5 rounded transition-colors text-[11px] ${viewPreset === 'global' ? 'bg-[#0f2b48] text-white font-bold' : 'text-stone-600 hover:bg-stone-50'}`}
                >
                  Global
                </button>
                <button 
                  onClick={() => setViewPreset('transpacific')}
                  className={`px-2 py-0.5 rounded transition-colors text-[11px] ${viewPreset === 'transpacific' ? 'bg-[#0f2b48] text-white font-bold' : 'text-stone-600 hover:bg-stone-50'}`}
                >
                  Transpacific
                </button>
                <button 
                  onClick={() => setViewPreset('asia-europe')}
                  className={`px-2 py-0.5 rounded transition-colors text-[11px] ${viewPreset === 'asia-europe' ? 'bg-[#0f2b48] text-white font-bold' : 'text-stone-600 hover:bg-stone-50'}`}
                >
                  Asia-Europe
                </button>
                <button 
                  onClick={() => setViewPreset('americas')}
                  className={`px-2 py-0.5 rounded transition-colors text-[11px] ${viewPreset === 'americas' ? 'bg-[#0f2b48] text-white font-bold' : 'text-stone-600 hover:bg-stone-50'}`}
                >
                  Americas
                </button>
              </div>
            </div>
          </div>

          {/* Tactical Layer Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#6b7280]">Layers:</span>
            <button
              onClick={() => setActiveLayers(l => ({ ...l, maritime: !l.maritime }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                activeLayers.maritime ? 'bg-[#0284c7]/10 text-[#0284c7] border-[#0284c7]/30 font-bold' : 'bg-white text-stone-500 border-[#e5e1d8]'
              }`}
            >
              <Ship className="w-3 h-3" /> Maritime
            </button>
            <button
              onClick={() => setActiveLayers(l => ({ ...l, rail: !l.rail }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                activeLayers.rail ? 'bg-[#ca8a04]/10 text-[#a16207] border-[#ca8a04]/30 font-bold' : 'bg-white text-stone-500 border-[#e5e1d8]'
              }`}
            >
              <Train className="w-3 h-3" /> Rail
            </button>
            <button
              onClick={() => setActiveLayers(l => ({ ...l, wms: !l.wms }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                activeLayers.wms ? 'bg-[#15803d]/10 text-[#15803d] border-[#15803d]/30 font-bold' : 'bg-white text-stone-500 border-[#e5e1d8]'
              }`}
            >
              <Anchor className="w-3 h-3" /> WMS ({wmsNodes.length})
            </button>
            <button
              onClick={() => setActiveLayers(l => ({ ...l, chokepoints: !l.chokepoints }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                activeLayers.chokepoints ? 'bg-[#c92a2a]/10 text-[#c92a2a] border-[#c92a2a]/30 font-bold' : 'bg-white text-stone-500 border-[#e5e1d8]'
              }`}
            >
              <AlertTriangle className="w-3 h-3" /> Chokepoints
            </button>
          </div>
        </div>

        {/* Notice banner if Google Maps script failed or is missing key on deployment */}
        {googleErrorMessage && mapMode === 'tactical' && (
          <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2 text-xs font-mono text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{googleErrorMessage}</span>
            </div>
            <button
              onClick={() => setGoogleErrorMessage(null)}
              className="text-amber-700 hover:text-amber-950 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Map Canvas View Container (Height strictly explicit per CF2) */}
        <div className="relative w-full bg-[#0b1928] overflow-hidden select-none" style={{ height: '540px', minHeight: '540px' }}>
          
          {/* MODE 1: Google Maps Dynamic JS Container */}
          <div 
            ref={googleMapRef}
            style={{ 
              width: '100%', 
              height: '100%', 
              display: mapMode === 'google' ? 'block' : 'none' 
            }}
          />

          {/* MODE 2: Tactical Vector SVG Grid */}
          {mapMode === 'tactical' && (
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-full block"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <radialGradient id="disruptionGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#ef4444" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
                <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Grid Lines */}
              <g stroke="#1e293b" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.6">
                {[45, 90, 135, 180, 225, 270, 315].map(deg => {
                  const x = (deg / 360) * SVG_WIDTH;
                  return <line key={`meridian-${deg}`} x1={x} y1={0} x2={x} y2={SVG_HEIGHT} />;
                })}
                {[0.2, 0.35, 0.5, 0.65, 0.8].map((ratio, i) => (
                  <line 
                    key={`par-${i}`} 
                    x1={0} 
                    y1={ratio * SVG_HEIGHT} 
                    x2={SVG_WIDTH} 
                    y2={ratio * SVG_HEIGHT} 
                    stroke={ratio === 0.5 ? '#334155' : '#1e293b'} 
                    strokeWidth={ratio === 0.5 ? '1' : '0.75'}
                    strokeDasharray={ratio === 0.5 ? 'none' : '3,3'}
                  />
                ))}
              </g>

              {/* Continents Silhouettes */}
              <g fill="#132338" stroke="#1e3a5f" strokeWidth="0.75" opacity="0.85">
                <path d="M 120 70 L 190 60 L 260 70 L 290 110 L 240 180 L 210 240 L 170 230 L 130 180 L 80 120 Z" />
                <path d="M 230 250 L 280 270 L 310 330 L 270 420 L 240 430 L 220 340 Z" />
                <path d="M 450 70 L 520 60 L 540 110 L 490 140 L 440 130 L 430 90 Z" />
                <path d="M 440 150 L 530 150 L 560 220 L 540 330 L 490 380 L 440 280 L 420 190 Z" />
                <path d="M 530 60 L 780 50 L 850 110 L 820 180 L 760 220 L 700 240 L 640 210 L 550 120 Z" />
                <path d="M 700 250 L 740 260 L 780 300 L 730 320 L 690 280 Z" />
                <path d="M 760 340 L 840 330 L 860 400 L 790 420 L 750 380 Z" />
              </g>

              {/* Maritime Corridors */}
              {activeLayers.maritime && (
                <g stroke="#0284c7" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.65">
                  {MARITIME_CORRIDORS.filter(c => c.id !== 'ER-1').map(corridor => (
                    <path key={corridor.id} d={makePathData(corridor.points)} fill="none" />
                  ))}
                </g>
              )}

              {/* Eurasian Rail */}
              {activeLayers.rail && (
                <g stroke="#eab308" strokeWidth="2" strokeDasharray="6,3" opacity="0.75">
                  {MARITIME_CORRIDORS.filter(c => c.id === 'ER-1').map(corridor => (
                    <path key={corridor.id} d={makePathData(corridor.points)} fill="none" />
                  ))}
                </g>
              )}

              {/* Disrupted & Rerouted Mission Lines */}
              {originPos && destPos && (
                <g>
                  <path
                    d={`M ${originPos[0]} ${originPos[1]} Q ${(originPos[0] + destPos[0]) / 2} ${Math.min(originPos[1], destPos[1]) - 60} ${destPos[0]} ${destPos[1]}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.8"
                  />
                  <path
                    d={`M ${originPos[0]} ${originPos[1]} Q ${(originPos[0] + destPos[0]) / 2} ${Math.min(originPos[1], destPos[1]) - 110} ${destPos[0]} ${destPos[1]}`}
                    fill="none"
                    stroke="url(#routeGradient)"
                    strokeWidth="3.5"
                    filter="url(#glowEffect)"
                    className="animate-pulse"
                  />
                  <path
                    d={`M ${originPos[0]} ${originPos[1]} Q ${(originPos[0] + destPos[0]) / 2} ${Math.min(originPos[1], destPos[1]) - 110} ${destPos[0]} ${destPos[1]}`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Chokepoints */}
              {activeLayers.chokepoints && CHOKEPOINTS.map((cp, idx) => {
                const [cx, cy] = projectCoords(cp.coords[0], cp.coords[1]);
                return (
                  <g 
                    key={`choke-${idx}`} 
                    className="cursor-pointer group"
                    onClick={() => setSelectedInfo({
                      type: 'disruption',
                      position: { lat: cp.coords[1], lng: cp.coords[0] },
                      title: `Strategic Chokepoint: ${cp.name}`,
                      details: {
                        Risk_Level: cp.risk,
                        Classification: cp.type,
                        Coordinates: `${cp.coords[1]}°N, ${cp.coords[0]}°E`,
                        Surveillance: 'Continuous Naval AIS Sync'
                      }
                    })}
                  >
                    <circle cx={cx} cy={cy} r="5" fill="#f59e0b" opacity="0.3" className="animate-ping" />
                    <circle cx={cx} cy={cy} r="3" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                    <text 
                      x={cx + 6} 
                      y={cy + 3} 
                      fill="#fef08a" 
                      fontSize="9" 
                      fontFamily="monospace"
                      className="opacity-70 group-hover:opacity-100 transition-opacity"
                    >
                      {cp.name}
                    </text>
                  </g>
                );
              })}

              {/* WMS Nodes */}
              {activeLayers.wms && wmsNodes.map((node) => {
                const [nx, ny] = projectCoords(node.lng, node.lat);
                const isWarning = node.status === 'warning' || node.capacity_pct >= 75;
                const isCritical = node.status === 'critical' || node.capacity_pct >= 90;
                const nodeColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

                return (
                  <g 
                    key={node.id} 
                    className="cursor-pointer group"
                    onClick={() => setSelectedInfo({
                      type: 'wms',
                      position: { lat: node.lat, lng: node.lng },
                      title: `${node.name} (${node.id})`,
                      details: {
                        Region: node.region,
                        Tier: `Tier ${node.tier}`,
                        Utilization: `${node.capacity_pct}% Capacity`,
                        Dock_Slots: `${node.active_docks} / ${node.total_docks} Active`,
                        Inbound_Demand: `${node.inbound_shipments} Shipments`,
                        Status: node.status.toUpperCase()
                      }
                    })}
                  >
                    <circle cx={nx} cy={ny} r={node.tier === 1 ? '5' : '3.5'} fill={nodeColor} stroke="#ffffff" strokeWidth="1" />
                    <text 
                      x={nx + 6} 
                      y={ny + 3} 
                      fill="#94a3b8" 
                      fontSize="8.5" 
                      fontFamily="monospace" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    >
                      {node.name.split(' ')[0]} ({node.capacity_pct}%)
                    </text>
                  </g>
                );
              })}

              {/* Disruption */}
              {disruptionPos && (
                <g 
                  className="cursor-pointer"
                  onClick={() => setSelectedInfo({
                    type: 'disruption',
                    position: { lat: mapData.disruption_coords[1], lng: mapData.disruption_coords[0] },
                    title: 'Active Detected Disruption',
                    details: {
                      Type: 'High Severity Anomaly',
                      Location: `${mapData.disruption_coords[1]}°N, ${mapData.disruption_coords[0]}°E`,
                      Impact: 'Corridor Capacity Choked',
                      Resolution: 'Autonomous Diversion Plan Active'
                    }
                  })}
                >
                  <circle cx={disruptionPos[0]} cy={disruptionPos[1]} r="24" fill="url(#disruptionGlow)" />
                  <circle cx={disruptionPos[0]} cy={disruptionPos[1]} r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                  <text 
                    x={disruptionPos[0]} 
                    y={disruptionPos[1] - 12} 
                    fill="#fca5a5" 
                    fontSize="10" 
                    fontWeight="bold"
                    fontFamily="monospace" 
                    textAnchor="middle"
                  >
                    DISRUPTION ZONE
                  </text>
                </g>
              )}

              {/* Origin / Dest */}
              {originPos && (
                <g className="cursor-pointer">
                  <circle cx={originPos[0]} cy={originPos[1]} r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                  <text x={originPos[0]} y={originPos[1] + 16} fill="#7dd3fc" fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    ORIGIN
                  </text>
                </g>
              )}
              {destPos && (
                <g className="cursor-pointer">
                  <circle cx={destPos[0]} cy={destPos[1]} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  <text x={destPos[0]} y={destPos[1] + 16} fill="#6ee7b7" fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    DESTINATION
                  </text>
                </g>
              )}
            </svg>
          )}

          {/* Interactive Info Window / Overlay Card when an item is selected */}
          {selectedInfo && (
            <div className="absolute top-4 right-4 max-w-sm w-80 bg-white/95 backdrop-blur-md rounded-lg border border-[#e5e1d8] p-4 shadow-lg text-[#111827] z-30 font-sans">
              <div className="flex items-start justify-between gap-2 border-b border-[#e5e1d8] pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#0f2b48] text-white flex items-center justify-center font-bold text-xs">
                    {selectedInfo.type === 'disruption' ? '!' : 'SG'}
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xs uppercase text-[#111827] leading-tight">
                      {selectedInfo.title}
                    </h4>
                    <span className="text-[10px] text-[#6b7280] font-mono">
                      {selectedInfo.position.lat.toFixed(2)}°N, {selectedInfo.position.lng.toFixed(2)}°E
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedInfo(null)}
                  className="text-stone-400 hover:text-stone-800 text-xs font-mono font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {selectedInfo.details && (
                <div className="space-y-1.5 text-xs font-mono">
                  {Object.entries(selectedInfo.details).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center text-[11px] py-0.5 border-b border-stone-100">
                      <span className="text-[#6b7280]">{key.replace('_', ' ')}:</span>
                      <span className="font-semibold text-[#0f2b48]">{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Canvas Bottom Legend Strip */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md bg-[#0b1928]/90 border border-slate-700/80 text-[11px] font-mono text-slate-300 backdrop-blur-sm z-20">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] border border-white"></span>
                <span>Origin</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white"></span>
                <span>Destination</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white animate-pulse"></span>
                <span>Disruption Zone</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-gradient-to-r from-emerald-400 to-sky-400"></span>
                <span>Optimal Diversion</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                <span>WMS Hub (Optimal)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
                <span>WMS Hub (Critical)</span>
              </span>
            </div>
            <div className="text-slate-400 hidden sm:block">
              {mapMode === 'google' ? 'Google Maps JavaScript API Active' : 'Tactical Vector Grid Active'}
            </div>
          </div>
        </div>
      </div>

      {/* Vector Corridor Breakdown & Comparative Analysis Table */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#0f2b48]" />
            <div>
              <h3 className="font-display font-bold text-lg text-[#111827]">
                Evaluated Diversion Corridors & Cost Vectors
              </h3>
              <p className="text-xs text-[#6b7280]">
                Autonomous routing choices scored against Gatekeeper constraints ($5,000 cost delta / 24h delay ceiling)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-[#15803d] px-2.5 py-1 rounded bg-[#15803d]/10">
            3 Vectors Computed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#fbfaf7] border-y border-[#e5e1d8] text-[#6b7280] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Carrier / Route Strategy</th>
                <th className="py-2.5 px-3">Mode</th>
                <th className="py-2.5 px-3">Cost Delta</th>
                <th className="py-2.5 px-3">Delay Impact</th>
                <th className="py-2.5 px-3">Reliability Index</th>
                <th className="py-2.5 px-3">SLA Status</th>
                <th className="py-2.5 px-3 text-right">Gatekeeper Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e1d8]">
              {mapData?.options?.map((opt: any, index: number) => {
                const isCompliant = opt.cost_delta <= 5000 && opt.delay_h <= 24;
                return (
                  <tr key={index} className="hover:bg-[#fbfaf7] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#111827]">{opt.carrier}</div>
                      <div className="text-[11px] text-[#6b7280] font-sans">{opt.route}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-stone-100 text-stone-700 font-semibold">
                        {opt.carrier?.toLowerCase().includes('air') ? 'Air Cargo' : opt.carrier?.toLowerCase().includes('rail') ? 'Intermodal Rail' : 'Ocean Express'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#111827]">
                      +${(opt.cost_delta || 0).toLocaleString()} USD
                    </td>
                    <td className="py-3 px-3">
                      <span className={(opt.delay_h || 0) <= 14 ? 'text-[#15803d] font-bold' : 'text-[#b45309] font-bold'}>
                        +{opt.delay_h || 0} Hours
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#15803d] rounded-full" 
                            style={{ width: `${(opt.reliability || 0.95) * 100}%` }}
                          />
                        </div>
                        <span>{((opt.reliability || 0.95) * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[#15803d] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> SLA Protected
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isCompliant ? (
                        <span className="px-2.5 py-1 rounded bg-[#15803d]/10 text-[#15803d] font-bold text-[10px] uppercase">
                          Auto-Executable
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-[#c92a2a]/10 text-[#c92a2a] font-bold text-[10px] uppercase">
                          Human Escalation
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
