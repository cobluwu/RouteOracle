import React, { useState, useEffect } from 'react';
import { ShieldAlert, Map as MapIcon, Package, Activity, Settings, Terminal, Ship, Database, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { useStore } from './store';
import Dashboard from './components/Dashboard';
import AgentPanel from './components/AgentPanel';
import FleetStatus from './components/FleetStatus';
import GeoNetwork from './components/GeoNetwork';
import WMSNodes from './components/WMSNodes';
import SysConfig from './components/SysConfig';
import LandingPage from './components/LandingPage';
import { 
  auth, 
  signInWithGoogle, 
  logOut, 
  seedInitialFirestoreData, 
  subscribeToAuditLogs, 
  subscribeToWmsNodes, 
  subscribeToFleetData, 
  subscribeToSystemConfig 
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [isLaunched, setIsLaunched] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState<string>('SYSTEM NOMINAL // NO ACTIVE CRITICAL ALERTS //');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const { 
    auditLog, 
    setAuditLog, 
    setWmsState, 
    setFleetState, 
    setConfig, 
    currentUser, 
    setCurrentUser,
    isFirebaseConnected,
    setIsFirebaseConnected
  } = useStore();

  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Firebase Authentication & Real-Time Firestore Synchronization
  useEffect(() => {
    let unsubAudits: (() => void) | null = null;
    let unsubWms: (() => void) | null = null;
    let unsubFleet: (() => void) | null = null;
    let unsubConfig: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user: User | null) => {
      setCurrentUser(user);
      if (user) {
        setIsFirebaseConnected(true);
        // Seed initial collections if newly provisioned
        await seedInitialFirestoreData();

        // Subscribe to real-time Cloud Firestore updates
        unsubAudits = subscribeToAuditLogs((audits) => {
          if (audits && audits.length > 0) {
            setAuditLog(audits);
          }
        });

        unsubWms = subscribeToWmsNodes((nodes) => {
          if (nodes && nodes.length > 0) {
            setWmsState(nodes);
          }
        });

        unsubFleet = subscribeToFleetData((fleetUpdate) => {
          setFleetState(fleetUpdate);
        });

        unsubConfig = subscribeToSystemConfig((configUpdate) => {
          setConfig(configUpdate);
        });
      } else {
        setIsFirebaseConnected(false);
        if (unsubAudits) unsubAudits();
        if (unsubWms) unsubWms();
        if (unsubFleet) unsubFleet();
        if (unsubConfig) unsubConfig();
      }
    });

    return () => {
      unsubAuth();
      if (unsubAudits) unsubAudits();
      if (unsubWms) unsubWms();
      if (unsubFleet) unsubFleet();
      if (unsubConfig) unsubConfig();
    };
  }, []);

  useEffect(() => {
    if (auditLog && auditLog.length > 0) {
      const recentLogs = auditLog.slice(0, 5);
      const alertString = recentLogs.map((log: any) => {
        const severity = log.decision_type === 'escalate' ? '[CRITICAL]' : '[INFO]';
        return `${severity} ${log.disruption_summary.toUpperCase()} -> ${log.decision_type === 'escalate' ? 'ESCALATED TO HUMAN' : `REROUTED VIA ${log.plan_selected.toUpperCase()}`} //`;
      }).join(' ');
      setAlerts(alertString);
    } else {
      setAlerts('SYSTEM NOMINAL // NO ACTIVE CRITICAL ALERTS //');
    }
  }, [auditLog]);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Sign-In failed:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  if (!isLaunched) {
    return <LandingPage onLaunch={() => setIsLaunched(true)} />;
  }

  return (
    <div className="flex h-screen text-[#111827] font-sans overflow-hidden bg-[#fbfaf7]">
      {/* Sidebar - Executive Command Palette */}
      <aside className="w-72 border-r border-[#e5e1d8] flex flex-col bg-white relative z-20 shadow-xs">
        <div className="p-5 border-b border-[#e5e1d8] flex items-center justify-between bg-[#fbfaf7]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#0f2b48] text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
              SG
            </div>
            <div>
              <h1 className="font-display font-extrabold text-lg tracking-tight text-[#111827] uppercase leading-none">
                SupplyGuard
              </h1>
              <div className="text-[10px] text-[#15803d] mt-1 font-mono uppercase flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 bg-[#15803d] rounded-full animate-pulse block"></span>
                <span>Autonomous Engine Armed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Subsystem Telemetry Bar in Sidebar */}
        <div className="px-4 py-2.5 bg-[#fbfaf7]/80 border-b border-[#e5e1d8] text-[10px] font-mono text-[#6b7280] space-y-1.5">
          <div className="flex justify-between items-center">
            <span>DATA SERVER:</span>
            <span className="font-bold text-[#0f2b48] flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isFirebaseConnected ? 'bg-[#15803d]' : 'bg-amber-500'}`}></span>
              FIREBASE FIRESTORE
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>ERP LINK:</span>
            <span className="font-bold text-[#0f2b48]">SAP S/4HANA (SYNCED)</span>
          </div>
          <div className="flex justify-between items-center">
            <span>FLEET TELEMETRY:</span>
            <span className="font-bold text-[#15803d]">1,818 ASSETS LIVE</span>
          </div>
          <div className="flex justify-between items-center">
            <span>DETECTION LATENCY:</span>
            <span className="font-bold text-[#c92a2a] tabular-nums">1.2ms (GEMINI)</span>
          </div>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1.5">
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider mb-1 font-mono font-bold px-2 pt-2">
            Operations Modules
          </div>
          <NavItem icon={<Activity />} label="Live_Telemetry" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Terminal />} label="Agent_Terminal" active={activeTab === 'disruptions'} onClick={() => setActiveTab('disruptions')} badge="3_CRIT" />
          <NavItem icon={<MapIcon />} label="Geo_Network" active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
          <NavItem icon={<Ship />} label="Active_Fleet" active={activeTab === 'fleet'} onClick={() => setActiveTab('fleet')} />
          <NavItem icon={<Package />} label="WMS_Nodes" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
        </nav>

        {/* Operator Profile / Firebase Auth in Sidebar */}
        <div className="p-3 border-t border-[#e5e1d8] bg-[#fbfaf7] space-y-2">
          {currentUser ? (
            <div className="p-2.5 rounded-md bg-white border border-[#e5e1d8] space-y-2">
              <div className="flex items-center gap-2.5">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-7 h-7 rounded-full border border-[#e5e1d8]" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#0f2b48] text-white flex items-center justify-center font-mono text-xs font-bold">
                    {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-[#111827] truncate font-sans">
                    {currentUser.displayName || 'Authorized Operator'}
                  </div>
                  <div className="text-[10px] text-[#6b7280] truncate font-mono">
                    {currentUser.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[10px] font-mono">
                <span className="text-[#15803d] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Firestore Linked
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-stone-500 hover:text-[#c92a2a] transition-colors cursor-pointer flex items-center gap-1 font-bold"
                >
                  <LogOut className="w-3 h-3" /> Exit
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-bold bg-[#0f2b48] text-white hover:bg-[#13375c] rounded-md transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          )}

          <NavItem icon={<Settings />} label="Sys_Config" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <button
            onClick={() => setIsLaunched(false)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-medium text-[#6b7280] hover:text-[#0f2b48] hover:bg-white rounded-md border border-transparent hover:border-[#e5e1d8] transition-all cursor-pointer"
          >
            <span>← Exit to Overview</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10 bg-[#fbfaf7] overflow-hidden">
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm font-mono">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Global Executive Status Header */}
        <header className="h-14 border-b border-[#e5e1d8] flex items-center justify-between px-6 bg-white z-10 shadow-xs">
          <div className="flex items-center gap-4 overflow-hidden whitespace-nowrap w-1/2">
            <span className="text-[#c92a2a] text-[11px] font-bold border border-[#c92a2a]/30 bg-[#c92a2a]/10 px-2 py-0.5 uppercase rounded-sm font-mono shrink-0">
              Disruption Feed
            </span>
            <div className={`text-xs uppercase font-mono font-semibold tracking-wider overflow-hidden relative w-full h-4 ${alerts.includes('CRITICAL') ? 'text-[#c92a2a]' : 'text-[#0f2b48]'}`}>
              <span className="animate-marquee absolute whitespace-nowrap">
                {alerts}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-mono text-[#6b7280]">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#fbfaf7] border border-[#e5e1d8]">
              <Database className="w-3.5 h-3.5 text-[#0f2b48]" />
              <span className="text-[#111827] font-semibold">
                Firebase Firestore: <span className={isFirebaseConnected ? 'text-[#15803d]' : 'text-amber-600'}>{isFirebaseConnected ? 'Live Cloud' : 'Ready'}</span>
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#fbfaf7] border border-[#e5e1d8]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
              <span className="text-[#111827] font-semibold">SLA Target: 99.98%</span>
            </div>
            <div className="text-[#111827] font-bold uppercase tracking-wider">
              UTC: {new Date().toISOString().split('T')[1].slice(0, 8)}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 bg-[#fbfaf7]">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'disruptions' && <AgentPanel />}
          {activeTab === 'fleet' && <FleetStatus />}
          {activeTab === 'map' && <GeoNetwork />}
          {activeTab === 'inventory' && <WMSNodes />}
          {activeTab === 'settings' && <SysConfig />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-2.5 rounded-md transition-all font-mono font-semibold text-xs cursor-pointer ${
        active 
          ? 'bg-[#0f2b48] text-white shadow-xs' 
          : 'text-[#4b5563] hover:text-[#0f2b48] hover:bg-stone-100'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {React.cloneElement(icon, { className: 'w-4 h-4' })}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      {badge && (
        <span className={`py-0.5 px-1.5 text-[9px] font-bold uppercase tracking-wider rounded ${
          active ? 'bg-[#c92a2a] text-white' : 'bg-[#c92a2a]/10 text-[#c92a2a]'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
