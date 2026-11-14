import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  Polyline,
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { useStore } from '../store';
import { Navigation, Map as MapIcon, Layers, AlertTriangle, Radio, Train, Car, Compass } from 'lucide-react';

interface SelectedInfo {
  type: 'origin' | 'destination' | 'disruption' | 'waypoint' | 'wms';
  position: { lat: number; lng: number };
  title: string;
  details?: Record<string, any>;
}

// Tactical layer controller hook for Google Maps native Transit and Traffic layers
function TacticalLayers({ rail, traffic }: { rail: boolean; traffic: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;
    const transitLayer = new google.maps.TransitLayer();
    if (rail) {
      transitLayer.setMap(map);
    } else {
      transitLayer.setMap(null);
    }
    return () => transitLayer.setMap(null);
  }, [map, rail]);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;
    const trafficLayer = new google.maps.TrafficLayer();
    if (traffic) {
      trafficLayer.setMap(map);
    } else {
      trafficLayer.setMap(null);
    }
    return () => trafficLayer.setMap(null);
  }, [map, traffic]);

  return null;
}

// Auto-fit camera bounds to current mission coordinates
function MapBoundsUpdater({ mapData }: { mapData: any }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !mapData || typeof google === 'undefined' || !google.maps) return;
    if (!Array.isArray(mapData.origin_coords) || !Array.isArray(mapData.dest_coords)) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: mapData.origin_coords[1], lng: mapData.origin_coords[0] });
    bounds.extend({ lat: mapData.dest_coords[1], lng: mapData.dest_coords[0] });

    if (Array.isArray(mapData.disruption_coords)) {
      bounds.extend({ lat: mapData.disruption_coords[1], lng: mapData.disruption_coords[0] });
    }

    if (mapData.options?.[0]?.waypoints) {
      mapData.options[0].waypoints.forEach((wp: [number, number]) => {
        if (Array.isArray(wp) && wp.length >= 2) {
          bounds.extend({ lat: wp[1], lng: wp[0] });
        }
      });
    }

    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [map, mapData]);

  return null;
}

export default function GeoNetwork() {
  const mapData = useStore(state => state.mapState);
  const wmsNodes = useStore(state => state.wmsState);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [activeLayers, setActiveLayers] = useState({
    rail: false,
    traffic: false,
    wms: true
  });
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [selectedInfo, setSelectedInfo] = useState<SelectedInfo | null>(null);

  useEffect(() => {
    if (!mapData) {
      useStore.getState().setMapState({
        disruption_coords: [121.47, 31.23], // Shanghai
        origin_coords: [121.47, 31.23],
        dest_coords: [-118.24, 34.05], // Los Angeles
        options: [
          { carrier: "Air Charter", route: "PVG -> ANC -> LAX", cost_delta: 4500, delay_h: 12 },
          { carrier: "Ocean Freight", route: "Ningbo -> LAX", cost_delta: 500, delay_h: 48 }
        ]
      });
    }
  }, [mapData]);

  const origin = mapData?.origin_coords ? { lat: mapData.origin_coords[1], lng: mapData.origin_coords[0] } : null;
  const destination = mapData?.dest_coords ? { lat: mapData.dest_coords[1], lng: mapData.dest_coords[0] } : null;
  const disruption = mapData?.disruption_coords ? { lat: mapData.disruption_coords[1], lng: mapData.disruption_coords[0] } : null;

  // Build Primary Route path (Origin -> Disruption -> Destination)
  const primaryRoutePath: { lat: number; lng: number }[] = [];
  if (origin && destination) {
    primaryRoutePath.push(origin);
    if (disruption) {
      primaryRoutePath.push(disruption);
    }
    primaryRoutePath.push(destination);
  }

  // Build Reroute Alternative path from waypoints if available
  let rerouteWaypoints: { lat: number; lng: number }[] = [];
  if (mapData?.options?.[0]?.waypoints && mapData.options[0].waypoints.length > 0) {
    rerouteWaypoints = mapData.options[0].waypoints.map((wp: [number, number]) => ({
      lat: wp[1],
      lng: wp[0]
    }));
  } else if (origin && destination) {
    // Generate an offset mid-point arching north (e.g. Great Circle via Anchorage/Pacific Rim)
    const midLat = (origin.lat + destination.lat) / 2 + 15;
    const midLng = (origin.lng + destination.lng) / 2;
    rerouteWaypoints = [{ lat: midLat, lng: midLng }];
  }

  const reroutePath: { lat: number; lng: number }[] = [];
  if (origin && destination) {
    reroutePath.push(origin);
    reroutePath.push(...rerouteWaypoints);
    reroutePath.push(destination);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-full flex flex-col font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1d8] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#c92a2a] uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4 text-[#0f2b48]" />
            <span>Autonomous Spatial Cartography</span>
          </div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#111827]">
            Geo Network & Chokepoint Routing
          </h2>
          <p className="text-xs text-[#6b7280] font-sans mt-0.5">
            Continuous Multi-Modal Satellite AIS/GPS Tracking & Disruption Bypass Engine via Google Maps
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-md bg-[#15803d]/10 text-[#15803d] border border-[#15803d]/30 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
            <span>Google Maps Platform: Live Sync</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 rounded-lg border border-[#e5e1d8] bg-white shadow-xs relative overflow-hidden flex flex-col md:flex-row min-h-[550px]">
        {/* Map Area */}
        <div className="flex-1 relative bg-white min-h-[400px]">
          {/* Tactical Layer Controls */}
          <div className="absolute top-4 right-4 z-20 bg-white/95 backdrop-blur-md border border-[#e5e1d8] rounded-md p-3 shadow-xs flex flex-col gap-2 min-w-[210px]">
            <div className="text-[10px] text-[#111827] font-mono font-bold uppercase tracking-wider border-b border-[#f0ece3] pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-[#0f2b48]" /> Map Controls</span>
              <span className="text-[9px] text-[#6b7280]">GMP v3</span>
            </div>

            {/* Map Mode Selector */}
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono font-bold">
              {(['roadmap', 'satellite', 'hybrid', 'terrain'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setMapType(type)}
                  className={`px-2 py-1 rounded uppercase tracking-wider border transition-colors cursor-pointer ${
                    mapType === type
                      ? 'border-[#0f2b48] bg-[#0f2b48] text-white shadow-xs'
                      : 'border-[#e5e1d8] bg-white text-[#6b7280] hover:text-[#0f2b48]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="border-t border-[#f0ece3] pt-2 flex flex-col gap-1 font-mono text-xs">
              <button
                onClick={() => setActiveLayers(prev => ({ ...prev, rail: !prev.rail }))}
                className={`flex items-center justify-between px-2 py-1.5 rounded transition-colors border cursor-pointer font-bold ${
                  activeLayers.rail ? 'border-[#b45309]/30 bg-[#b45309]/10 text-[#b45309]' : 'border-transparent text-[#6b7280] hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2"><Train className="w-3.5 h-3.5" /> Rail / Transit</div>
                {activeLayers.rail && <span className="w-1.5 h-1.5 rounded-full bg-[#b45309] animate-pulse"></span>}
              </button>

              <button
                onClick={() => setActiveLayers(prev => ({ ...prev, traffic: !prev.traffic }))}
                className={`flex items-center justify-between px-2 py-1.5 rounded transition-colors border cursor-pointer font-bold ${
                  activeLayers.traffic ? 'border-[#c92a2a]/30 bg-[#c92a2a]/10 text-[#c92a2a]' : 'border-transparent text-[#6b7280] hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2"><Car className="w-3.5 h-3.5" /> Live Traffic</div>
                {activeLayers.traffic && <span className="w-1.5 h-1.5 rounded-full bg-[#c92a2a] animate-pulse"></span>}
              </button>

              <button
                onClick={() => setActiveLayers(prev => ({ ...prev, wms: !prev.wms }))}
                className={`flex items-center justify-between px-2 py-1.5 rounded transition-colors border cursor-pointer font-bold ${
                  activeLayers.wms ? 'border-[#0f2b48]/30 bg-[#0f2b48]/10 text-[#0f2b48]' : 'border-transparent text-[#6b7280] hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2"><Radio className="w-3.5 h-3.5" /> WMS Facilities</div>
                {activeLayers.wms && <span className="w-1.5 h-1.5 rounded-full bg-[#0f2b48] animate-pulse"></span>}
              </button>
            </div>
          </div>

          {/* Google Maps Viewport */}
          <APIProvider apiKey={apiKey} language="en" region="US">
            <GoogleMap
              style={{ width: '100%', height: '100%' }}
              defaultCenter={{ lat: 25, lng: 0 }}
              defaultZoom={2}
              gestureHandling="greedy"
              mapId="DEMO_MAP_ID"
              mapTypeId={mapType}
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={false}
              streetViewControl={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              <TacticalLayers rail={activeLayers.rail} traffic={activeLayers.traffic} />
              <MapBoundsUpdater mapData={mapData} />

              {/* Primary Route Geodesic Polyline */}
              {primaryRoutePath.length >= 2 && (
                <Polyline
                  path={primaryRoutePath}
                  strokeColor="#1a4c8a"
                  strokeWeight={3}
                  strokeOpacity={0.85}
                  geodesic={true}
                />
              )}

              {/* Rerouted Alternative Geodesic Polyline */}
              {reroutePath.length >= 2 && (
                <Polyline
                  path={reroutePath}
                  strokeColor="#228b22"
                  strokeWeight={4}
                  strokeOpacity={0.9}
                  geodesic={true}
                />
              )}

              {/* Origin Marker */}
              {origin && (
                <AdvancedMarker
                  position={origin}
                  title="Origin Terminal"
                  onClick={() => setSelectedInfo({
                    type: 'origin',
                    position: origin,
                    title: 'Origin Terminal',
                    details: {
                      Coordinates: `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`,
                      Status: 'Departed / En Route'
                    }
                  })}
                >
                  <Pin background="#1a4c8a" glyphColor="#ffffff" borderColor="#1a1a1a" />
                </AdvancedMarker>
              )}

              {/* Destination Marker */}
              {destination && (
                <AdvancedMarker
                  position={destination}
                  title="Destination Facility"
                  onClick={() => setSelectedInfo({
                    type: 'destination',
                    position: destination,
                    title: 'Destination Terminal',
                    details: {
                      Coordinates: `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`,
                      Status: 'Scheduled Delivery Port'
                    }
                  })}
                >
                  <Pin background="#1a4c8a" glyphColor="#ffffff" borderColor="#1a1a1a" />
                </AdvancedMarker>
              )}

              {/* Disruption Marker */}
              {disruption && (
                <AdvancedMarker
                  position={disruption}
                  title="Active Disruption Zone"
                  onClick={() => setSelectedInfo({
                    type: 'disruption',
                    position: disruption,
                    title: 'Disruption Bottleneck',
                    details: {
                      Coordinates: `${disruption.lat.toFixed(4)}, ${disruption.lng.toFixed(4)}`,
                      Severity: 'CRITICAL',
                      Action: 'Rerouting in Progress'
                    }
                  })}
                >
                  <div className="relative flex items-center justify-center cursor-pointer">
                    <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-[#da312e] opacity-75"></span>
                    <div className="relative border-2 border-[#1a1a1a] bg-[#da312e] text-white px-2 py-1 shadow-md flex items-center gap-1 paper-edge">
                      <AlertTriangle className="w-3.5 h-3.5 text-white animate-bounce" />
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider">DISRUPTION</span>
                    </div>
                  </div>
                </AdvancedMarker>
              )}

              {/* Waypoint Markers */}
              {rerouteWaypoints.map((wp, idx) => (
                <AdvancedMarker
                  key={`reroute-wp-${idx}`}
                  position={wp}
                  title={`Reroute Waypoint ${idx + 1}`}
                  onClick={() => setSelectedInfo({
                    type: 'waypoint',
                    position: wp,
                    title: `Reroute Waypoint #${idx + 1}`,
                    details: {
                      Coordinates: `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`,
                      Designation: 'Bypass Navigation Hub'
                    }
                  })}
                >
                  <Pin background="#228b22" glyphColor="#ffffff" borderColor="#1a1a1a" scale={0.85} />
                </AdvancedMarker>
              ))}

              {/* WMS Node Markers */}
              {activeLayers.wms && wmsNodes && wmsNodes.map((node: any) => (
                <AdvancedMarker
                  key={node.id}
                  position={{ lat: node.lat, lng: node.lng }}
                  title={`${node.id} - ${node.name}`}
                  onClick={() => setSelectedInfo({
                    type: 'wms',
                    position: { lat: node.lat, lng: node.lng },
                    title: `${node.id}: ${node.name}`,
                    details: {
                      Region: `${node.region} (Tier ${node.tier})`,
                      Capacity: `${node.capacity_pct}%`,
                      Docks: `${node.active_docks} / ${node.total_docks} active`,
                      Inbound: `${node.inbound_shipments} shipments`,
                      Status: node.status.toUpperCase()
                    }
                  })}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 border-[#1a1a1a] shadow-xs cursor-pointer transition-transform hover:scale-150 ${
                      node.capacity_pct >= 90 ? 'bg-[#da312e] animate-pulse' : node.capacity_pct >= 80 ? 'bg-[#b45309]' : 'bg-[#1a4c8a]'
                    }`}
                  />
                </AdvancedMarker>
              ))}

              {/* InfoWindow on Selected Entity */}
              {selectedInfo && (
                <InfoWindow
                  position={selectedInfo.position}
                  onCloseClick={() => setSelectedInfo(null)}
                >
                  <div className="font-mono p-1 text-xs text-[#1a1a1a] max-w-[220px]">
                    <div className="font-bold border-b-2 border-dashed border-[#d5d1c8] pb-1 mb-2 text-[#1a4c8a] flex items-center justify-between">
                      <span>{selectedInfo.title}</span>
                    </div>
                    {selectedInfo.details && (
                      <div className="space-y-1 text-[11px]">
                        {Object.entries(selectedInfo.details).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <span className="text-[#666] font-semibold">{k}:</span>
                            <span className="font-bold text-[#1a1a1a] text-right">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </APIProvider>

          {/* Map Legend */}
          <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur-md border border-[#e5e1d8] rounded-md p-3 font-mono text-[11px] space-y-2 shadow-xs pointer-events-none">
            <div className="text-[10px] text-[#6b7280] font-bold uppercase tracking-wider border-b border-[#f0ece3] pb-1">Cartographic Legend</div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-1 bg-[#0f2b48] rounded"></span>
              <span className="text-[#111827]">Primary Route (Geodesic)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-1 bg-[#15803d] rounded"></span>
              <span className="text-[#111827]">Approved Diverted Path</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c92a2a] animate-pulse"></span>
              <span className="text-[#111827]">Disruption Chokepoint</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0f2b48]"></span>
              <span className="text-[#111827]">WMS Gateway Buffer Node</span>
            </div>
          </div>
        </div>

        {/* Side Panel: Route Analysis */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[#e5e1d8] bg-[#fbfaf7] p-5 flex flex-col overflow-y-auto shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2 border-b border-[#e5e1d8] pb-3 mb-4">
            <Navigation className="w-4 h-4 text-[#0f2b48]" />
            <h3 className="font-display font-bold uppercase tracking-wider text-[#111827] text-xs">
              Corridor Vector Analysis
            </h3>
          </div>

          {!mapData ? (
            <div className="flex-1 flex items-center justify-center text-[#6b7280] font-bold uppercase tracking-wider text-xs text-center">
              Awaiting Disruption Coordinates
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(mapData.disruption_coords) && (
                <div className="p-3.5 rounded-md bg-[#c92a2a]/10 border border-[#c92a2a]/20">
                  <div className="text-[11px] text-[#c92a2a] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Compromised Zone
                  </div>
                  <div className="text-xs text-[#111827] font-semibold">
                    LAT: {mapData.disruption_coords[1]?.toFixed(4)}° N<br/>
                    LNG: {mapData.disruption_coords[0]?.toFixed(4)}° E
                  </div>
                </div>
              )}

              {mapData.options && mapData.options.length > 0 && mapData.options[0] && (
                <div className="p-4 rounded-md bg-white border border-[#e5e1d8] shadow-xs space-y-2">
                  <div className="text-[11px] text-[#15803d] font-bold uppercase tracking-wider border-b border-[#f0ece3] pb-1.5 flex justify-between items-center">
                    <span>Approved Bypass Corridor</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#15803d]/10 text-[10px]">OPTIMAL</span>
                  </div>
                  
                  <div className="space-y-1.5 text-xs">
                    <div><span className="text-[#6b7280]">Carrier:</span> <span className="text-[#111827] font-bold">{mapData.options[0].carrier}</span></div>
                    <div><span className="text-[#6b7280]">Routing:</span> <span className="text-[#0f2b48] font-bold">{mapData.options[0].route}</span></div>
                    <div className="flex justify-between pt-2 border-t border-[#f0ece3]">
                      <span className="text-[#15803d] font-bold">+{mapData.options[0].delay_h}h Delay</span>
                      <span className="text-[#0f2b48] font-bold">+${mapData.options[0].cost_delta} USD</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Network Summary */}
              <div className="p-4 rounded-md bg-white border border-[#e5e1d8] shadow-xs space-y-2 text-xs">
                <div className="font-bold uppercase tracking-wider text-[#0f2b48] border-b border-[#f0ece3] pb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> Global Spatial Grid
                </div>
                <div className="flex justify-between text-[#6b7280]">
                  <span>Active WMS Hubs:</span>
                  <span className="font-bold text-[#111827]">{wmsNodes.length}</span>
                </div>
                <div className="flex justify-between text-[#6b7280]">
                  <span>Saturated (&gt;90%):</span>
                  <span className="font-bold text-[#c92a2a]">
                    {wmsNodes.filter((n: any) => n.capacity_pct >= 90).length} Nodes
                  </span>
                </div>
                <div className="flex justify-between text-[#6b7280]">
                  <span>Safe Buffer (&lt;75%):</span>
                  <span className="font-bold text-[#15803d]">
                    {wmsNodes.filter((n: any) => n.capacity_pct < 75).length} Nodes
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
