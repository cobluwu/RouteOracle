import React from 'react';
import { Ship, Truck, Plane, Activity, Navigation, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';

const REGIONAL_RESILIENCE = [
  { region: 'North America', onTime: 4200, mitigated: 850, delayed: 150, score: '96.8%' },
  { region: 'Europe', onTime: 3100, mitigated: 620, delayed: 90, score: '97.6%' },
  { region: 'Asia Pacific', onTime: 5400, mitigated: 1240, delayed: 210, score: '97.0%' },
  { region: 'Latin America', onTime: 1800, mitigated: 310, delayed: 60, score: '97.2%' },
];

export default function FleetStatus() {
  const fleetState = useStore(state => state.fleetState);
  const totalFleetAssets = (fleetState?.ocean?.active || 71) + (fleetState?.air?.active || 19) + (fleetState?.ground?.active || 1728);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1d8] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#c92a2a] uppercase tracking-wider mb-1">
            <Ship className="w-4 h-4 text-[#0f2b48]" />
            <span>Carrier Network Telemetry</span>
          </div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#111827]">
            Active Fleet Resilience
          </h2>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-md bg-[#15803d]/10 text-[#15803d] border border-[#15803d]/30 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
            <span>Total Active Assets: {totalFleetAssets.toLocaleString()} Units</span>
          </div>
        </div>
      </div>

      {/* Fleet Overview Cards (71 Ocean + 19 Air + 1728 Ground = 1,818 Units) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FleetCard 
          title="Ocean Freight (Deepwater)" 
          icon={<Ship />} 
          active={fleetState.ocean.active} 
          volume={fleetState.ocean.volume} 
          trend={fleetState.ocean.trend} 
          color="#0f2b48" 
          detail="Trans-Pacific & Suez Diversion Fleets"
        />
        <FleetCard 
          title="Air Cargo (Express Corridors)" 
          icon={<Plane />} 
          active={fleetState.air.active} 
          volume={fleetState.air.volume} 
          trend={fleetState.air.trend} 
          color="#0f2b48" 
          detail="Emergency SLA Bypass Fleet"
        />
        <FleetCard 
          title="Ground & Intermodal Rail" 
          icon={<Truck />} 
          active={fleetState.ground.active} 
          volume={fleetState.ground.volume} 
          trend={fleetState.ground.trend} 
          color="#15803d" 
          detail="Inland Port & Cross-Dock Drayage"
        />
      </div>

      {/* Figure 3 Validation: Regional SLA Resilience Table */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1d8] pb-4 mb-5">
          <div>
            <div className="text-xs font-mono font-bold text-[#6b7280] uppercase tracking-wider mb-1">
              Figure 3 Validation: Regional Contract Weightings
            </div>
            <h3 className="text-lg font-display font-bold uppercase tracking-tight text-[#111827] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#15803d]" />
              Active Fleet Resilience by Operating Region
            </h3>
          </div>
          <div className="text-xs font-mono text-[#6b7280]">
            Tier-1 Contract Protection: <strong className="text-[#15803d]">ACTIVE</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {REGIONAL_RESILIENCE.map((item, idx) => (
            <div key={idx} className="p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8] font-mono text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-[#111827] text-sm">{item.region}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#15803d]/10 text-[#15803d] font-bold text-[11px]">{item.score}</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-[#4b5563]">
                <div className="flex justify-between">
                  <span>On-Time:</span>
                  <span className="font-bold text-[#0f2b48]">{item.onTime.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Mitigated:</span>
                  <span className="font-bold text-[#15803d]">+{item.mitigated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delayed (Contained):</span>
                  <span className="font-bold text-[#c92a2a]">{item.delayed}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Transit Manifest */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5 border-b border-[#e5e1d8] pb-3">
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-[#111827] flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#0f2b48]" /> Live Carrier Transit Manifest & Tier-1 SLA Status
          </h3>
          <span className="text-[11px] font-mono text-[#6b7280]">AIS / GPS Position Feed</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="border-b border-[#e5e1d8] text-[11px] font-mono uppercase tracking-wider text-[#6b7280]">
                <th className="pb-3 pl-2">Asset ID</th>
                <th className="pb-3">Mode</th>
                <th className="pb-3">Origin Hub</th>
                <th className="pb-3">Destination</th>
                <th className="pb-3">ETA (UTC)</th>
                <th className="pb-3">SLA Priority</th>
                <th className="pb-3 text-right pr-2">Transit Status</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {fleetState.activeRoutes.map((route: any, idx: number) => {
                const isDelayed = route.status.includes('DELAY');
                const isApproaching = route.status.includes('APPROACH');
                return (
                  <tr key={idx} className="border-b border-[#f0ece3] hover:bg-[#fbfaf7] transition-colors">
                    <td className="py-3.5 pl-2 font-bold text-[#111827]">{route.id}</td>
                    <td className="py-3.5 text-[#4b5563]">{route.type}</td>
                    <td className="py-3.5 text-[#0f2b48] font-semibold">{route.origin}</td>
                    <td className="py-3.5 text-[#0f2b48] font-semibold">{route.dest}</td>
                    <td className="py-3.5 text-[#6b7280]">{route.eta}</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0f2b48]/10 text-[#0f2b48]">
                        TIER-1 CRITICAL
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-2 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        isDelayed 
                          ? 'bg-[#c92a2a]/10 text-[#c92a2a]' 
                          : isApproaching 
                          ? 'bg-[#15803d]/10 text-[#15803d]' 
                          : 'bg-[#0f2b48]/10 text-[#0f2b48]'
                      }`}>
                        [{route.status}]
                      </span>
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

function FleetCard({ title, icon, active, volume, trend, color, detail }: any) {
  const isCritical = active < 5;

  return (
    <div className="p-5 rounded-lg border border-[#e5e1d8] bg-white shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-mono font-semibold text-[#6b7280]">{title}</div>
          {detail && <div className="text-xs text-[#4b5563] font-sans mt-0.5">{detail}</div>}
        </div>
        <div style={{ color: isCritical ? '#c92a2a' : color }}>{React.cloneElement(icon, { className: 'w-5 h-5' })}</div>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <div className="font-display text-3xl font-extrabold tracking-tight text-[#111827] tabular-nums">
          {active}
        </div>
        <div className="text-xs font-mono text-[#6b7280] uppercase">Active Units</div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#f0ece3] text-[11px] font-mono">
        <span className="text-[#4b5563]">Payload: {volume}</span>
        <span style={{ color: isCritical ? '#c92a2a' : '#15803d' }} className="font-bold">
          {trend}
        </span>
      </div>
    </div>
  );
}
