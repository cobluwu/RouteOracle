import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useSpring, useTransform, Variants, MotionValue, useMotionTemplate } from 'motion/react';
import { 
  Power, Activity, GitCommit, ShieldAlert, Workflow, Terminal, Zap, 
  CheckCircle2, TrendingDown, Layers, MapPin, Compass, ArrowRight, 
  ChevronRight, Sparkles, Anchor, ShieldCheck, Clock
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  BarChart, Bar, Legend, ComposedChart, Line
} from 'recharts';
import { TelemetryChartInteractive } from './TelemetryChart';
import { SysConfigSim } from './SysConfigSim';
import { ScrollInteractiveBackground } from './ScrollInteractiveBackground';

// --- Data for Interactive Telemetry & Impact Charts ---
const costMitigationData = Array.from({ length: 10 }, (_, i) => ({
  stage: `W${i + 1}`,
  unmitigated: 100000 + (i * 26000) + (Math.random() * 8000),
  supplyGuard: 100000 + (i * 4800) + (Math.random() * 4000),
}));

const fleetData = [
  { region: 'North America', onTime: 4200, mitigated: 850, delayed: 150 },
  { region: 'Europe', onTime: 3100, mitigated: 620, delayed: 90 },
  { region: 'Asia Pacific', onTime: 5400, mitigated: 1240, delayed: 210 },
  { region: 'Latin America', onTime: 1800, mitigated: 310, delayed: 60 },
];

const capacityData = [
  { node: 'USEWR', demand: 85, capacity: 60 },
  { node: 'NLRTM', demand: 90, capacity: 85 },
  { node: 'SGSIN', demand: 60, capacity: 100 },
  { node: 'CNPVG', demand: 95, capacity: 50 },
  { node: 'USLAX', demand: 75, capacity: 80 },
];

// --- Animation Variants ---
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } 
  }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14 }
  }
};

// --- Scroll Reveal Text Component ---
const Word = ({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) => {
  const opacity = useTransform(progress, range, [0.15, 1]);
  const color = useTransform(progress, range, ["#9ca3af", "#111827"]);
  const y = useTransform(progress, range, [16, 0]);
  
  return (
    <span className="relative mr-3 lg:mr-4 mt-2 inline-block">
      <motion.span className="absolute opacity-15" style={{ color: "#9ca3af" }}>{children}</motion.span>
      <motion.span style={{ opacity, color, y, display: "inline-block" }}>{children}</motion.span>
    </span>
  );
};

const ScrollRevealText = ({ text }: { text: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 80%", "start 25%"]
  });

  const words = text.split(" ");
  return (
    <div ref={containerRef} className="max-w-6xl mx-auto py-28 px-6">
      <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold uppercase leading-[1.15] tracking-tight flex flex-wrap justify-center text-center text-balance">
        {words.map((word, i) => {
          const start = i / words.length;
          const end = start + (1 / words.length);
          return (
            <Word key={i} progress={scrollYProgress} range={[start, end]}>
              {word}
            </Word>
          );
        })}
      </h2>
    </div>
  );
};

const textContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const textLetterVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)", 
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } 
  }
};

const AnimatedLetter = ({ letter, index, scrollY, isGuard }: { letter: string; index: number; scrollY: MotionValue<number>; isGuard: boolean }) => {
  const fadeOutStart = 30 + (index * 12);
  const fadeOutEnd = fadeOutStart + 160;
  
  const scrollOpacity = useTransform(scrollY, [fadeOutStart, fadeOutEnd], [1, 0.15]);
  const scrollYOffset = useTransform(scrollY, [fadeOutStart, fadeOutEnd], [0, -30]);
  const scrollBlurRaw = useTransform(scrollY, [fadeOutStart, fadeOutEnd], [0, 8]);
  const scrollFilter = useMotionTemplate`blur(${scrollBlurRaw}px)`;

  return (
    <motion.span
      variants={textLetterVariants}
      style={{ 
        opacity: scrollOpacity, 
        y: scrollYOffset, 
        filter: scrollFilter, 
        color: isGuard ? "#0f2b48" : "#111827" 
      }}
      className={`inline-block ${isGuard && index === 6 ? "ml-3 sm:ml-5 md:ml-8" : ""}`}
    >
      {letter}
    </motion.span>
  );
};

// --- Framer Motion Interactive Text Highlighting Pattern (Per Code Conventions) ---
const ScrollHighlightWord = ({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) => {
  const scaleX = useTransform(progress, range, [0, 1]);
  return (
    <span className="relative inline-block font-bold px-[3px] mx-[2px] z-10">
      <motion.span
        style={{ scaleX, backgroundColor: "#c92a2a", opacity: 0.22, transformOrigin: "left center" }}
        className="absolute left-0 top-[10%] bottom-[10%] w-full -z-10 rounded-[3px]"
      />
      {children}
    </span>
  );
};

const ScrollHighlightHeader = ({ text }: { text: string }) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 90%", "center 60%"]
  });

  const words = text.split(" ");
  return (
    <span ref={containerRef} className="inline-flex flex-wrap gap-y-1">
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + (1 / words.length);
        return (
          <ScrollHighlightWord key={i} progress={scrollYProgress} range={[start, end]}>
            {word}
          </ScrollHighlightWord>
        );
      })}
    </span>
  );
};

export default function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const { scrollYProgress, scrollY } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  // Top Bar scroll opacity & elevation state
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const unsub = scrollY.on("change", (latest) => {
      setIsScrolled(latest > 30);
    });
    return () => unsub();
  }, [scrollY]);

  // Subtle Hero Transform
  const headerY = useTransform(scrollY, [0, 300], [0, 60]);
  const headerOpacity = useTransform(scrollY, [0, 260], [1, 0.3]);
  const skewX = useTransform(scrollY, [0, 300], [0, -2]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.94]);

  const preambleY = useTransform(scrollY, [0, 300], [0, -30]);
  const preambleOpacity = useTransform(scrollY, [0, 180], [1, 0]);
  const preambleText = "AUTONOMOUS LOGISTICS DISRUPTION ENGINE // 2026";

  // Section 3: Telemetry (Clip from Right to Left)
  const section3Ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: s3Progress } = useScroll({ target: section3Ref, offset: ["start 85%", "center center"] });

  // Section 4: Cost (Clip from Bottom to Top)
  const section4Ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: s4Progress } = useScroll({ target: section4Ref, offset: ["start 85%", "center center"] });
  const s4ClipRaw = useTransform(s4Progress, [0, 1], [100, 0]);
  const s4Clip = useMotionTemplate`inset(${s4ClipRaw}% 0 0 0)`;

  // Section 5: SLA (Scale Y)
  const section5Ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: s5Progress } = useScroll({ target: section5Ref, offset: ["start 85%", "center center"] });
  const s5ScaleY = useTransform(s5Progress, [0, 1], [0, 1]);

  // Section 6: Decision (Scale)
  const section6Ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: s6Progress } = useScroll({ target: section6Ref, offset: ["start 85%", "center center"] });
  const s6Scale = useTransform(s6Progress, [0.3, 1], [0.85, 1]);
  const s6Opacity = useTransform(s6Progress, [0.3, 1], [0, 1]);

  // Section 7: Capacity (Clip from center out)
  const section7Ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: s7Progress } = useScroll({ target: section7Ref, offset: ["start 85%", "center center"] });
  const s7ClipRaw = useTransform(s7Progress, [0, 1], [50, 0]);
  const s7Clip = useMotionTemplate`inset(0 ${s7ClipRaw}% 0 ${s7ClipRaw}%)`;

  // Architecture Bento Card scroll elevation
  const archRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: archScrollProgress } = useScroll({
    target: archRef,
    offset: ["start 95%", "end 10%"]
  });

  const archY0 = useTransform(archScrollProgress, [0, 0.35, 0.7, 1], [180, 0, 0, -120]);
  const archY1 = useTransform(archScrollProgress, [0, 0.4, 0.7, 1], [220, 0, 0, -140]);
  const archY2 = useTransform(archScrollProgress, [0, 0.45, 0.7, 1], [260, 0, 0, -160]);

  const archOp0 = useTransform(archScrollProgress, [0.0, 0.3, 0.75, 1.0], [0, 1, 1, 0.2]);
  const archOp1 = useTransform(archScrollProgress, [0.05, 0.35, 0.75, 1.0], [0, 1, 1, 0.2]);
  const archOp2 = useTransform(archScrollProgress, [0.1, 0.4, 0.75, 1.0], [0, 1, 1, 0.2]);

  const archYs = [archY0, archY1, archY2];
  const archOps = [archOp0, archOp1, archOp2];

  return (
    <div className="text-[#111827] font-sans min-h-screen relative overflow-x-hidden selection:bg-[#c92a2a] selection:text-white">
      
      {/* Top Accent Loading Indicator */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-[#c92a2a] origin-left z-50 shadow-sm" 
        style={{ scaleX }} 
      />

      {/* Top Bar Contract (Strict 3-zone Header: Brand - Links - CTA) */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled 
          ? 'bg-[#fbfaf7]/95 backdrop-blur-md border-b border-[#e5e1d8] py-3 shadow-xs' 
          : 'bg-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand title wordmark */}
          <a href="#" className="flex items-center gap-2.5 text-lg font-display font-bold tracking-tight text-[#111827] whitespace-nowrap shrink-0 group">
            <div className="w-8 h-8 rounded-md bg-[#0f2b48] text-white flex items-center justify-center font-mono text-xs font-bold transition-transform duration-300 group-hover:scale-105">
              SG
            </div>
            <span>SUPPLYGUARD</span>
          </a>

          {/* Zone 2: Clean single-line text links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#4b5563]">
            <a href="#workflow" className="hover:text-[#0f2b48] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4">Workflow</a>
            <a href="#threat-velocity" className="hover:text-[#0f2b48] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4">Threat Velocity</a>
            <a href="#penalty-mitigation" className="hover:text-[#0f2b48] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4">Penalty Analysis</a>
            <a href="#fleet-resilience" className="hover:text-[#0f2b48] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4">Fleet Status</a>
            <a href="#node-grid" className="hover:text-[#0f2b48] transition-colors whitespace-nowrap shrink-0 hover:underline underline-offset-4">Node Grid</a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onLaunch}
              className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-[#0f2b48] rounded-md hover:bg-[#163b61] transition-all duration-200 shadow-xs hover:shadow-sm whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <Power className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Launch Terminal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Scroll Interactive Background (Reacts dynamically to user scroll) */}
      <ScrollInteractiveBackground />

      {/* ================= SECTION 1: HERO & INITIALIZE ================= */}
      <section className="min-h-screen flex flex-col items-center justify-center relative z-10 px-6 pt-32 pb-20 text-center">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="flex flex-col items-center relative z-10 w-full max-w-5xl mx-auto">
          
          {/* Technical Preamble */}
          <motion.div 
            style={{ y: preambleY, opacity: preambleOpacity }}
            className="mb-6 flex items-center gap-3 text-[#c92a2a] font-mono text-xs tracking-[0.25em] font-semibold"
          >
            <span className="w-6 h-[1.5px] bg-[#c92a2a] hidden sm:block"></span>
            <span>{preambleText}</span>
            <span className="w-6 h-[1.5px] bg-[#c92a2a] hidden sm:block"></span>
          </motion.div>

          {/* Kinetic Display Wordmark */}
          <motion.div
            style={{ y: headerY, opacity: headerOpacity }}
            className="relative w-full flex justify-center items-center py-2 mb-6 cursor-default"
          >
            <motion.h1 
              variants={textContainerVariants}
              initial="hidden"
              animate="visible"
              style={{ skewX, scale }} 
              className="text-5xl sm:text-[5.5rem] md:text-[7.5rem] lg:text-[9.25rem] font-display font-extrabold tracking-tight m-0 leading-none flex items-center mx-auto uppercase text-[#111827]"
            >
              {Array.from("SUPPLYGUARD").map((char, idx) => (
                <AnimatedLetter key={idx} letter={char} index={idx} scrollY={scrollY} isGuard={idx >= 6} />
              ))}
            </motion.h1>
          </motion.div>
          
          <motion.p variants={fadeUp} className="text-base sm:text-xl md:text-2xl text-[#4b5563] tracking-normal mb-10 max-w-2xl text-center px-4 font-sans font-normal leading-relaxed text-balance">
            Autonomous supply chain rerouting. <br className="hidden sm:block"/>
            Millisecond transit detection. <strong className="text-[#0f2b48] font-semibold ink-underline">Zero SLA breaches.</strong>
          </motion.p>

          {/* High-Intent Launch Button */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button 
              onClick={onLaunch}
              className="group relative inline-flex items-center justify-center px-8 md:px-12 py-4 text-sm md:text-base font-mono font-bold tracking-wider text-white bg-[#0f2b48] hover:bg-[#163b61] rounded-md transition-all duration-300 shadow-md hover:shadow-xl cursor-pointer w-full sm:w-auto gap-3"
            >
              <Power className="w-5 h-5 text-[#38bdf8] transition-transform duration-300 group-hover:rotate-90" />
              <span>INITIALIZE OPERATIONS TERMINAL</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* Verified Trust Strip */}
          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-6 text-xs text-[#6b7280] font-mono">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#15803d]" />
              <span>Continuous ERP Governance</span>
            </div>
            <span aria-hidden="true" className="text-[#d1d5db]">·</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#0f2b48]" />
              <span>1.2ms Anomaly Detection</span>
            </div>
            <span aria-hidden="true" className="text-[#d1d5db] hidden sm:inline">·</span>
            <div className="hidden sm:flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#c92a2a]" />
              <span>Autonomous Route Dispatch</span>
            </div>
          </motion.div>

          {/* Interactive Live Operations Telemetry Console (No static image) */}
          <motion.div 
            variants={fadeUp}
            className="mt-14 w-full max-w-5xl rounded-lg border border-[#e5e1d8] bg-white/90 backdrop-blur-md shadow-sm overflow-hidden text-left"
          >
            {/* Top Bar of Console */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-[#e5e1d8] bg-[#fbfaf7]/80 text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15803d] animate-pulse" />
                <span className="font-bold text-[#111827] uppercase tracking-wider">Engine State: ARMED & AUTONOMOUS</span>
                <span className="text-[#9ca3af] hidden sm:inline">·</span>
                <span className="text-[#6b7280] hidden sm:inline">Continuous Carrier Feed</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#6b7280]">
                <span>ERP SYNC: SAP / ORACLE / MANHATTAN WMS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#0f2b48]" />
              </div>
            </div>

            {/* 4 Executive Telemetry Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#e5e1d8] border-b border-[#e5e1d8]">
              <div className="p-5 lg:p-6">
                <div className="text-[11px] font-mono text-[#6b7280] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Monitored Assets</span>
                  <span className="text-[#15803d] font-bold">LIVE</span>
                </div>
                <div className="text-2xl lg:text-3xl font-display font-extrabold text-[#111827] tabular-nums">1,818</div>
                <div className="text-xs text-[#4b5563] mt-1 font-sans">Active maritime & intermodal units</div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="text-[11px] font-mono text-[#6b7280] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Decision Latency</span>
                  <span className="text-[#0f2b48] font-bold">1.2ms</span>
                </div>
                <div className="text-2xl lg:text-3xl font-display font-extrabold text-[#0f2b48] tabular-nums">Sub-Second</div>
                <div className="text-xs text-[#4b5563] mt-1 font-sans">Autonomous Gemini neural pipeline</div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="text-[11px] font-mono text-[#6b7280] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Corridor Diverted</span>
                  <span className="text-[#c92a2a] font-bold">ACTIVE</span>
                </div>
                <div className="text-2xl lg:text-3xl font-display font-extrabold text-[#c92a2a] tabular-nums">14 Hubs</div>
                <div className="text-xs text-[#4b5563] mt-1 font-sans">Suez bypass / Panama queue gate</div>
              </div>

              <div className="p-5 lg:p-6">
                <div className="text-[11px] font-mono text-[#6b7280] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>SLA Avoided Losses</span>
                  <span className="text-[#15803d] font-bold">YTD</span>
                </div>
                <div className="text-2xl lg:text-3xl font-display font-extrabold text-[#15803d] tabular-nums">-$1.28M</div>
                <div className="text-xs text-[#4b5563] mt-1 font-sans">Zero contract breach penalty rate</div>
              </div>
            </div>

            {/* Live Ticker Stream Bar */}
            <div className="px-6 py-3 bg-[#fbfaf7]/60 flex items-center justify-between text-[11px] font-mono text-[#4b5563] overflow-hidden">
              <div className="flex items-center gap-2 shrink-0 text-[#0f2b48] font-bold">
                <Zap className="w-3.5 h-3.5 text-[#c92a2a]" />
                <span className="uppercase tracking-wider">Live Log:</span>
              </div>
              <div className="truncate ml-3 text-[#6b7280]">
                <span className="text-[#0f2b48] font-semibold">[03:31:09] SGSIN → USLAX</span> Trans-Pacific routing optimal · 
                <span className="text-[#c92a2a] font-semibold ml-2">[03:29:44] EGSCA</span> Suez Chokepoint congestion detected → automated diversion engaged · 
                <span className="text-[#15803d] font-semibold ml-2">[03:27:12] USEWR</span> Newark buffer capacity balanced
              </div>
            </div>
          </motion.div>

        </motion.div>

        {/* Subtle Scroll Down Marker */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-12 flex flex-col items-center pointer-events-none"
        >
          <div className="text-[11px] font-mono text-[#9ca3af] uppercase tracking-widest mb-2">Scroll To Inspect Architecture</div>
          <div className="w-[1px] h-8 bg-gradient-to-b from-[#0f2b48] to-transparent animate-pulse" />
        </motion.div>
      </section>

      {/* ================= SCROLL REVEAL STATEMENT ================= */}
      <section className="relative z-10 border-y border-[#e5e1d8] bg-white">
        <ScrollRevealText text="WE DON'T JUST PREDICT DISRUPTIONS. WE AUTONOMOUSLY REROUTE THE GLOBAL SUPPLY CHAIN IN MILLISECONDS." />
      </section>

      {/* ================= SECTION 2: SYSTEM ARCHITECTURE WORKFLOW ================= */}
      <section id="workflow" className="py-28 relative z-10 px-6 lg:px-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto">
          
          <motion.div variants={fadeUp} className="mb-14">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#c92a2a] uppercase tracking-wider mb-2">
              <Workflow className="w-4 h-4" />
              <span>Core Operational Engine</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight text-[#111827]">
              Three-Stage Autonomous Pipeline
            </h2>
            <p className="text-sm text-[#4b5563] mt-2 max-w-xl">
              From raw logistics disruptions to verified, budget-gated carrier reroute commands.
            </p>
          </motion.div>

          <div ref={archRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 min-h-[380px]">
            {[
              { 
                icon: Terminal, 
                title: "Information Ingestion", 
                num: "01", 
                color: "#0f2b48", 
                code: "INGESTION // REALTIME",
                desc: [
                  { text: "Dual-stream ingestion", highlight: true },
                  { text: " through the Agent Terminal via ", highlight: false },
                  { text: "direct incident triggers", highlight: true },
                  { text: " and continuous carrier telemetry.", highlight: false }
                ] 
              },
              { 
                icon: Activity, 
                title: "Multi-Module Processing", 
                num: "02", 
                color: "#163b61", 
                code: "VECTOR_COMPUTE // GEO_SYNC",
                desc: [
                  { text: "Cross-referencing live capacity", highlight: true },
                  { text: " across ", highlight: false },
                  { text: "WMS Nodes, Geo Network, & Fleet", highlight: true },
                  { text: " modules to compute risk vectors.", highlight: false }
                ] 
              },
              { 
                icon: GitCommit, 
                title: "Pathfinding & Gated Dispatch", 
                num: "03", 
                color: "#c92a2a", 
                code: "DISPATCH // GOVERNANCE",
                desc: [
                  { text: "Computes 3 optimal route options.", highlight: true },
                  { text: " The selected plan is verified against thresholds and ", highlight: false },
                  { text: "dispatched via Google Maps", highlight: true },
                  { text: " to active carriers.", highlight: false }
                ] 
              }
            ].map((item, i) => {
              const Icon = item.icon;
              return (
              <motion.div 
                key={i} 
                style={{
                  opacity: archOps[i],
                  y: archYs[i],
                }}
                className="w-full h-full relative"
              >
                <div
                  className="card-luxury p-7 relative flex flex-col justify-between h-full group rounded-md"
                >
                  {/* Subtle top indicator bar */}
                  <div className="flex items-center justify-between border-b border-[#f0ece3] pb-3 mb-6">
                    <span className="text-[11px] text-[#6b7280] font-mono font-semibold tracking-wider">{item.code}</span>
                    <span className="text-xl font-display font-extrabold text-[#9ca3af] group-hover:text-[#0f2b48] transition-colors">{item.num}</span>
                  </div>

                  <div className="mb-6">
                    <div className="w-10 h-10 rounded-md bg-[#f4f2ec] text-[#0f2b48] flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <h3 className="text-lg lg:text-xl font-display font-bold text-[#111827] mb-2">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-[#4b5563] leading-relaxed font-sans">
                      {item.desc.map((part, pIdx) => {
                        if (!part.highlight) return <span key={pIdx}>{part.text}</span>;
                        return (
                          <span key={pIdx} className="relative inline-block font-semibold text-[#111827] px-[2px] mx-[1px] z-10">
                            <motion.span
                              variants={{
                                idle: { scaleX: 0 },
                                hovering: { scaleX: 1 }
                              }}
                              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                              style={{ backgroundColor: item.color, opacity: 0.18, transformOrigin: "left center" }}
                              className="absolute left-0 top-[10%] bottom-[10%] w-full -z-10 rounded-[2px]"
                            />
                            {part.text}
                          </span>
                        );
                      })}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#f0ece3] flex items-center justify-between text-[11px] font-mono text-[#6b7280]">
                    <span>Stage {item.num} Operational</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ================= SECTION 3: TELEMETRY & EVENT INGESTION ================= */}
      <section id="threat-velocity" ref={section3Ref} className="py-24 relative z-10 px-6 lg:px-24 bg-white border-y border-[#e5e1d8]">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
          <motion.div variants={fadeUp} className="lg:w-1/3">
            <div className="w-10 h-10 border border-[#e5e1d8] flex items-center justify-center rounded-md mb-6 bg-[#fbfaf7] text-[#0f2b48]">
              <Zap className="w-5 h-5" />
            </div>
            
            <h2 className="text-3xl font-display font-bold uppercase text-[#111827] leading-tight flex items-center flex-wrap gap-x-2 mb-4">
              <span>Real-Time Threat</span>
              <ScrollHighlightHeader text="Velocity" />
            </h2>
            
            <p className="text-[#4b5563] text-sm leading-relaxed font-sans mb-8">
              SupplyGuard continuously ingests thousands of global logistics events per hour. Our neural models filter noise, identifying critical anomalies—such as labor strikes, extreme weather, or port congestion—before they cascade into failures.
            </p>
            
            <div className="flex flex-col gap-2.5 font-mono text-xs">
              <div className="flex justify-between items-center p-3 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
                <span className="text-[#6b7280]">Model Pipeline:</span>
                <span className="font-bold text-[#0f2b48]">Gemini Autonomous Agent</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
                <span className="text-[#6b7280]">Inference Latency:</span>
                <span className="font-bold text-[#c92a2a] tabular-nums">1.2ms / event</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-md bg-[#fbfaf7] border border-[#e5e1d8]">
                <span className="text-[#6b7280]">Target SLA Compliance:</span>
                <span className="font-bold text-[#15803d] tabular-nums">99.98% Guaranteed</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div variants={fadeUp} className="lg:w-2/3 w-full h-[420px] bg-[#fbfaf7] p-6 relative rounded-md border border-[#e5e1d8] shadow-sm overflow-hidden">
            <div className="w-full h-full">
               <TelemetryChartInteractive progress={s3Progress} />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================= SECTION 4: COST MITIGATION ================= */}
      <section id="penalty-mitigation" ref={section4Ref} className="py-28 relative z-10 px-6 lg:px-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto flex flex-col lg:flex-row-reverse gap-16 items-center">
          <motion.div variants={fadeUp} className="lg:w-1/3">
            <div className="w-10 h-10 border border-[#e5e1d8] flex items-center justify-center rounded-md mb-6 bg-white text-[#15803d]">
              <TrendingDown className="w-5 h-5" />
            </div>
            
            <h2 className="text-3xl font-display font-bold uppercase text-[#111827] mb-4">
              Predictive Penalty Mitigation
            </h2>
            
            <p className="text-[#4b5563] text-sm leading-relaxed font-sans mb-8">
              By proactively rerouting shipments around predicted bottlenecks, the agent prevents exponential late-fees, expedited air-freight penalties, and total loss cascades. The AI optimizes for the lowest cost delta that still respects required SLAs.
            </p>

            <div className="p-4 rounded-md bg-white border border-[#e5e1d8] space-y-2 text-xs font-mono">
              <div className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Mitigation Snapshot</div>
              <div className="flex justify-between">
                <span>Cascading Risk Avoided:</span>
                <span className="font-bold text-[#15803d]">-$1.28M USD</span>
              </div>
              <div className="flex justify-between">
                <span>Avg. Reroute Cost Delta:</span>
                <span className="font-bold text-[#0f2b48]">+$4,500 USD</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div variants={fadeUp} className="lg:w-2/3 w-full h-[420px] bg-white p-6 relative rounded-md border border-[#e5e1d8] shadow-sm overflow-hidden">
             <div className="text-xs font-mono font-bold text-[#6b7280] uppercase tracking-wider mb-2">Figure 2: Penalty Cascade Extrapolation vs AI Response</div>
             <motion.div style={{ clipPath: s4Clip }} className="w-full h-[340px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={costMitigationData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="unmitigatedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c92a2a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#c92a2a" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="supplyGuardGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f2b48" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0f2b48" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d8" vertical={false} />
                    <XAxis dataKey="stage" stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 11, fontFamily: 'monospace'}} tickLine={false} axisLine={{ stroke: '#e5e1d8' }} />
                    <YAxis stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 11, fontFamily: 'monospace'}} tickLine={false} axisLine={{ stroke: '#e5e1d8' }} tickFormatter={(val) => `$${val/1000}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e1d8', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      itemStyle={{ fontSize: 11, fontFamily: 'monospace' }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#111827', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="unmitigated" stroke="#c92a2a" strokeWidth={2.5} fillOpacity={1} fill="url(#unmitigatedGrad)" name="Unmitigated Cascade Penalty" />
                    <Area type="monotone" dataKey="supplyGuard" stroke="#0f2b48" strokeWidth={2.5} fillOpacity={1} fill="url(#supplyGuardGrad)" name="SupplyGuard Dynamic Route" />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================= SECTION 5: FLEET STATUS & SLA ================= */}
      <section id="fleet-resilience" ref={section5Ref} className="py-24 relative z-10 px-6 lg:px-24 bg-white border-y border-[#e5e1d8]">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
          <motion.div variants={fadeUp} className="lg:w-1/3">
            <div className="w-10 h-10 border border-[#e5e1d8] flex items-center justify-center rounded-md mb-6 bg-[#fbfaf7] text-[#0f2b48]">
              <CheckCircle2 className="w-5 h-5 text-[#15803d]" />
            </div>
            
            <h2 className="text-3xl font-display font-bold uppercase text-[#111827] mb-4">
              Active Fleet Resilience
            </h2>
            
            <p className="text-[#4b5563] text-sm leading-relaxed font-sans mb-8">
              Different shipments command different priority tiers. The Active Fleet mathematical gating ensures that Tier-1 service level agreements (SLAs) are absolutely protected, adjusting routes based on contract penalty weightings.
            </p>
          </motion.div>
          
          <motion.div variants={fadeUp} className="lg:w-2/3 w-full h-[420px] bg-[#fbfaf7] p-6 relative rounded-md border border-[#e5e1d8] shadow-sm overflow-hidden">
             <div className="text-xs font-mono font-bold text-[#6b7280] uppercase tracking-wider mb-2">Figure 3: Fleet Status by Operating Region</div>
             <motion.div style={{ scaleY: s5ScaleY, transformOrigin: "bottom" }} className="w-full h-[340px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={fleetData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d8" vertical={false} />
                   <XAxis dataKey="region" stroke="#6b7280" tick={{fill: '#111827', fontSize: 11, fontFamily: 'monospace'}} tickLine={false} axisLine={{ stroke: '#e5e1d8' }} />
                   <YAxis stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 11, fontFamily: 'monospace'}} tickLine={false} axisLine={{ stroke: '#e5e1d8' }} />
                   <Tooltip 
                      cursor={{ fill: 'rgba(15, 43, 72, 0.04)' }}
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e1d8', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      itemStyle={{ fontSize: 11, fontFamily: 'monospace' }} 
                   />
                   <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#111827', paddingTop: '10px' }} />
                   <Bar dataKey="onTime" stackId="a" fill="#0f2b48" name="On Time (Nominal)" maxBarSize={38} radius={[0, 0, 0, 0]} />
                   <Bar dataKey="mitigated" stackId="a" fill="#15803d" name="Auto-Mitigated" maxBarSize={38} radius={[0, 0, 0, 0]} />
                   <Bar dataKey="delayed" stackId="a" fill="#c92a2a" name="Delayed (Bottleneck)" maxBarSize={38} radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================= SECTION 6: SIMULATION & GOVERNANCE ================= */}
      <section ref={section6Ref} className="py-28 relative z-10 px-6 lg:px-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto flex flex-col lg:flex-row-reverse gap-16 items-center">
          <motion.div variants={fadeUp} className="lg:w-1/3">
            <div className="w-10 h-10 border border-[#e5e1d8] flex items-center justify-center rounded-md mb-6 bg-white text-[#0f2b48]">
              <Layers className="w-5 h-5" />
            </div>
            
            <h2 className="text-3xl font-display font-bold uppercase text-[#111827] mb-4">
              Governance Gatekeeper Limits
            </h2>
            
            <p className="text-[#4b5563] text-sm leading-relaxed font-sans mb-8">
              The agent is designed to execute safely. When a disruption triggers a reroute plan, if the cost and delay thresholds fall within predefined Sys Config safety limits, the system injects the redirect command back instantly, requiring zero human intervention.
            </p>
          </motion.div>
          
          <motion.div variants={fadeUp} className="lg:w-2/3 w-full h-[420px] relative rounded-md border border-[#e5e1d8] p-6 bg-white shadow-sm overflow-hidden">
             <div className="text-xs font-mono font-bold text-[#6b7280] uppercase tracking-wider mb-2">Figure 4: Active Constraint Simulator</div>
             <motion.div style={{ scale: s6Scale, opacity: s6Opacity }} className="w-full h-full">
               <SysConfigSim />
             </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================= SECTION 7: NODE SATURATION GRID ================= */}
      <section id="node-grid" ref={section7Ref} className="py-24 relative z-10 px-6 lg:px-24 bg-white border-t border-[#e5e1d8]">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
          <motion.div variants={fadeUp} className="lg:w-1/3">
            <div className="w-10 h-10 border border-[#e5e1d8] flex items-center justify-center rounded-md mb-6 bg-[#fbfaf7] text-[#c92a2a]">
              <MapPin className="w-5 h-5" />
            </div>
            
            <h2 className="text-3xl font-display font-bold uppercase text-[#111827] mb-4">
              Gateway Saturation Index
            </h2>
            
            <p className="text-[#4b5563] text-sm leading-relaxed font-sans mb-8">
              Rerouting is useless if the alternate port is full. The Geo Network cross-references live WMS Nodes capacity data to ensure that proposed diversions won't simply land in another congested queue.
            </p>
          </motion.div>
          
          <motion.div variants={fadeUp} className="lg:w-2/3 w-full h-[420px] bg-[#fbfaf7] p-6 relative rounded-md border border-[#e5e1d8] shadow-sm overflow-hidden">
             <div className="text-xs font-mono font-bold text-[#6b7280] uppercase tracking-wider mb-2">Figure 5: Gateway Capacity vs Live Inbound Demand</div>
             <motion.div style={{ clipPath: s7Clip }} className="w-full h-[340px]">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={capacityData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d8" vertical={false} />
                    <XAxis dataKey="node" stroke="#6b7280" tick={{fill: '#111827', fontSize: 11, fontFamily: 'monospace'}} tickLine={false} axisLine={{ stroke: '#e5e1d8' }} />
                    <YAxis stroke="#6b7280" tick={{fill: '#6b7280', fontSize: 11, fontFamily: 'monospace'}} tickLine={false} axisLine={{ stroke: '#e5e1d8' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e1d8', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                      itemStyle={{ fontSize: 11, fontFamily: 'monospace' }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#111827', paddingTop: '10px' }} />
                    <Bar dataKey="demand" barSize={36} fill="#0f2b48" name="Inbound Demand %" radius={[4, 4, 0, 0]} />
                    <Line type="step" dataKey="capacity" stroke="#c92a2a" strokeWidth={2.5} dot={false} name="Carrier Buffer Capacity %" />
                  </ComposedChart>
               </ResponsiveContainer>
             </motion.div>
          </motion.div>
        </motion.div>

        {/* Bottom CTA Section */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="max-w-4xl mx-auto text-center mt-32 pb-24 border-t border-[#e5e1d8] pt-16">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#0f2b48] font-bold uppercase tracking-widest mb-4">
            <Anchor className="w-4 h-4 text-[#c92a2a]" />
            <span>Autonomous Supply Chain Readiness</span>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-display font-extrabold uppercase text-[#111827] mb-6 tracking-tight text-balance">
            Deploy The Routing Engine
          </h2>
          
          <p className="text-sm md:text-base text-[#4b5563] max-w-xl mx-auto mb-8 font-sans">
            Gain full command over global disruptions, automated carrier rerouting, and real-time WMS telemetry.
          </p>
          
          <button 
            onClick={onLaunch}
            className="group relative inline-flex items-center justify-center px-10 py-4 text-sm font-mono font-bold uppercase tracking-wider text-white bg-[#0f2b48] hover:bg-[#163b61] rounded-md transition-all duration-300 shadow-md hover:shadow-xl cursor-pointer gap-3"
          >
            <Power className="w-4 h-4 text-[#38bdf8] transition-transform duration-300 group-hover:rotate-90" />
            <span>Launch Operations Interface</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </motion.div>
      </section>

      {/* Quiet Footer */}
      <footer className="py-8 border-t border-[#e5e1d8] bg-[#fbfaf7] text-[#6b7280] text-xs font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#111827]">SUPPLYGUARD</span>
            <span>· Autonomous Logistics Infrastructure</span>
          </div>
          <div>
            <span>© 2026 SupplyGuard Systems. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
