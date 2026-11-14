import React, { useState } from 'react';
import { Settings, ShieldAlert, Sliders, RotateCcw, AlertTriangle, ToggleLeft, ToggleRight, Save, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import { useStore } from '../store';
import { saveSystemConfigInFirestore } from '../lib/firebase';

export default function SysConfig() {
  const { config, setConfig, resetStore } = useStore();
  const [localConfig, setLocalConfig] = useState(config);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSave = () => {
    setConfig(localConfig);
    saveSystemConfigInFirestore(localConfig).catch(err => console.warn('Firestore config save note:', err));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const executeReset = () => {
    resetStore();
    window.location.reload();
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Title & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1d8] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#c92a2a] uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4 text-[#0f2b48]" />
            <span>Autonomous Governance Rules</span>
          </div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#111827]">
            System Configuration & Gatekeeper Limits
          </h2>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-md bg-[#0f2b48]/10 text-[#0f2b48] border border-[#0f2b48]/20 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0f2b48]" />
            <span>ERP Governance Gate: ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Autonomous Gatekeeper Limits Card (Directly Justifying Landing Page & RULE[AGENTS_md]) */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#e5e1d8] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#0f2b48]/10 text-[#0f2b48] flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-[#111827]">
                Autonomous Execution Thresholds (Gatekeeper Limits)
              </h3>
              <p className="text-xs text-[#6b7280]">
                Per SupplyGuard rules: reroute plans within these limits execute instantly. Any breach triggers human escalation.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Autonomous Execution Master Toggle */}
          <div className="flex items-center justify-between p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
            <div>
              <div className="text-sm font-bold text-[#111827]">Autonomous Dispatch Mode</div>
              <div className="text-xs text-[#6b7280] font-sans mt-0.5">
                Automatically dispatch approved carrier reroutes without waiting for human confirmation
              </div>
            </div>
            <button 
              onClick={() => setConfig({...config, autoMode: !config.autoMode})}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                config.autoMode 
                  ? 'bg-[#15803d] text-white shadow-xs' 
                  : 'bg-stone-200 text-stone-700'
              }`}
            >
              {config.autoMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span>{config.autoMode ? 'ENABLED' : 'DISABLED'}</span>
            </button>
          </div>

          {/* Max Cost Delta Slider */}
          <div className="p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-sm font-bold text-[#111827]">Maximum Cost Delta Threshold</span>
                <span className="text-xs text-[#6b7280] block font-sans">
                  Plans exceeding this cost delta trigger mandatory human supervisor sign-off
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-lg font-bold text-[#0f2b48] tabular-nums">${localConfig.maxCost.toLocaleString()} USD</span>
                <span className="text-[10px] text-[#6b7280] block">Ceiling</span>
              </div>
            </div>
            <input 
              type="range" 
              min="500" 
              max="20000" 
              step="500"
              value={localConfig.maxCost}
              onChange={(e) => setLocalConfig({...localConfig, maxCost: parseInt(e.target.value)})}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#0f2b48]"
            />
            <div className="flex justify-between text-[#6b7280] text-[10px] font-mono mt-1.5">
              <span>$500 Min</span>
              <span className="font-bold text-[#0f2b48]">$5,000 Standard Enterprise Guardrail</span>
              <span>$20,000 Max</span>
            </div>
          </div>

          {/* Max Delay Slider */}
          <div className="p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-sm font-bold text-[#111827]">Maximum Transit Delay Threshold</span>
                <span className="text-xs text-[#6b7280] block font-sans">
                  Delays exceeding this threshold are gated to prevent contract SLA breaches
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-lg font-bold text-[#0f2b48] tabular-nums">{localConfig.maxDelay} Hours</span>
                <span className="text-[10px] text-[#6b7280] block">Ceiling</span>
              </div>
            </div>
            <input 
              type="range" 
              min="6" 
              max="72" 
              step="6"
              value={localConfig.maxDelay}
              onChange={(e) => setLocalConfig({...localConfig, maxDelay: parseInt(e.target.value)})}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#0f2b48]"
            />
            <div className="flex justify-between text-[#6b7280] text-[10px] font-mono mt-1.5">
              <span>6h Express SLA</span>
              <span className="font-bold text-[#0f2b48]">24h Gatekeeper Limit</span>
              <span>72h Extended</span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button 
              onClick={handleSave}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-md font-mono text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                saved 
                  ? 'bg-[#15803d] text-white' 
                  : 'bg-[#0f2b48] text-white hover:bg-[#163b61]'
              }`}
            >
              {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saved ? 'Thresholds Saved' : 'Save Gatekeeper Config'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Geopolitical & Corridor Constraints */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#e5e1d8] pb-4 mb-6">
          <div>
            <h3 className="font-display font-bold text-base text-[#111827]">
              Strategic Routing & Geopolitical Constraints
            </h3>
            <p className="text-xs text-[#6b7280]">
              Mandatory corridor bypass policies enforced on all multi-modal rerouting options
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
            <div>
              <div className="text-sm font-bold text-[#111827]">Avoid Red Sea / Suez Chokepoint (EGSCA)</div>
              <div className="text-xs text-[#6b7280] font-sans">
                Forces AI to bypass the Red Sea and route strictly via Cape of Good Hope
              </div>
            </div>
            <button 
              onClick={() => {
                const updated = {...localConfig, avoidRedSea: !localConfig.avoidRedSea};
                setLocalConfig(updated);
                setConfig(updated);
                saveSystemConfigInFirestore(updated).catch(err => console.warn('Firestore config save note:', err));
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                localConfig.avoidRedSea ? 'bg-[#c92a2a] text-white shadow-xs' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {localConfig.avoidRedSea ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span>{localConfig.avoidRedSea ? 'AVOID ACTIVE' : 'BYPASS OFF'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
            <div>
              <div className="text-sm font-bold text-[#111827]">Avoid Panama Canal Queue (PAPTY)</div>
              <div className="text-xs text-[#6b7280] font-sans">
                Diverts shipments to overland intermodal rail to circumvent drought draft restrictions
              </div>
            </div>
            <button 
              onClick={() => {
                const updated = {...localConfig, avoidPanamaCanal: !localConfig.avoidPanamaCanal};
                setLocalConfig(updated);
                setConfig(updated);
                saveSystemConfigInFirestore(updated).catch(err => console.warn('Firestore config save note:', err));
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                localConfig.avoidPanamaCanal ? 'bg-[#c92a2a] text-white shadow-xs' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {localConfig.avoidPanamaCanal ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span>{localConfig.avoidPanamaCanal ? 'AVOID ACTIVE' : 'BYPASS OFF'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
            <div>
              <div className="text-sm font-bold text-[#111827]">Strict Carbon Limits (Scope 3 ESG)</div>
              <div className="text-xs text-[#6b7280] font-sans">
                Penalizes carbon-intensive air freight and favors electric intermodal rail & ocean corridors
              </div>
            </div>
            <button 
              onClick={() => {
                const updated = {...localConfig, strictCarbon: !localConfig.strictCarbon};
                setLocalConfig(updated);
                setConfig(updated);
                saveSystemConfigInFirestore(updated).catch(err => console.warn('Firestore config save note:', err));
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                localConfig.strictCarbon ? 'bg-[#15803d] text-white shadow-xs' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {localConfig.strictCarbon ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span>{localConfig.strictCarbon ? 'ENFORCED' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Factory Reset */}
      <div className="rounded-lg border border-[#e5e1d8] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#111827]">Restore Factory State</div>
            <div className="text-xs text-[#6b7280] font-sans">
              Revert all simulated fleet routes, audit entries, and warehouse loads to default
            </div>
          </div>
          
          {!confirmReset ? (
            <button 
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md font-mono text-xs font-bold text-[#c92a2a] border border-[#c92a2a]/30 hover:bg-[#c92a2a]/10 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#c92a2a] font-mono">Confirm Reset?</span>
              <button 
                onClick={executeReset}
                className="px-3 py-1.5 rounded bg-[#c92a2a] text-white font-mono text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
              >
                Yes, Reset
              </button>
              <button 
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded border border-[#e5e1d8] text-xs font-mono hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
