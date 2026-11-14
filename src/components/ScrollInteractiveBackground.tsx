import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';

interface HubNode {
  id: string;
  name: string;
  code: string;
  x: number; // 0 to 1
  y: number; // 0 to 1
  type: 'port' | 'canal' | 'airport' | 'hub';
  status: 'nominal' | 'diverted' | 'congested';
}

const GLOBAL_HUBS: HubNode[] = [
  { id: 'uslax', name: 'Port of Los Angeles', code: 'USLAX', x: 0.16, y: 0.38, type: 'port', status: 'congested' },
  { id: 'usewr', name: 'Newark Gateway', code: 'USEWR', x: 0.28, y: 0.32, type: 'port', status: 'nominal' },
  { id: 'papty', name: 'Panama Canal Transit', code: 'PAPTY', x: 0.25, y: 0.54, type: 'canal', status: 'diverted' },
  { id: 'nlrtm', name: 'Port of Rotterdam', code: 'NLRTM', x: 0.49, y: 0.25, type: 'port', status: 'nominal' },
  { id: 'deham', name: 'Hamburg Terminal', code: 'DEHAM', x: 0.52, y: 0.22, type: 'port', status: 'nominal' },
  { id: 'egsca', name: 'Suez Chokepoint', code: 'EGSCA', x: 0.56, y: 0.42, type: 'canal', status: 'diverted' },
  { id: 'aedxb', name: 'Dubai Air Logistics', code: 'AEDXB', x: 0.62, y: 0.44, type: 'airport', status: 'nominal' },
  { id: 'sgsin', name: 'Singapore Mega-Hub', code: 'SGSIN', x: 0.74, y: 0.56, type: 'port', status: 'nominal' },
  { id: 'cnpvg', name: 'Shanghai Deepwater', code: 'CNPVG', x: 0.81, y: 0.40, type: 'port', status: 'congested' },
  { id: 'jptyo', name: 'Tokyo Bay Logistics', code: 'JPTYO', x: 0.88, y: 0.38, type: 'hub', status: 'nominal' },
];

const HUB_CONNECTIONS: [string, string][] = [
  ['uslax', 'usewr'],
  ['uslax', 'papty'],
  ['papty', 'nlrtm'],
  ['usewr', 'nlrtm'],
  ['nlrtm', 'deham'],
  ['nlrtm', 'egsca'],
  ['egsca', 'aedxb'],
  ['aedxb', 'sgsin'],
  ['sgsin', 'cnpvg'],
  ['cnpvg', 'jptyo'],
  ['uslax', 'jptyo'],
  ['sgsin', 'uslax'],
];

export const ScrollInteractiveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { scrollY, scrollYProgress } = useScroll();
  
  // Smooth spring for motion reactions
  const smoothScrollY = useSpring(scrollY, { stiffness: 90, damping: 20 });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 20 });

  // Floating coordinates calculated from scroll
  const [telemetry, setTelemetry] = useState({
    lat: '34.0522° N',
    lon: '118.2437° W',
    heading: '042°',
    speedKnots: '24.8 kts',
    activeReroutes: 14,
  });

  // Track dynamic rotation and elevation from scroll
  const ringRotate = useTransform(smoothScrollY, [0, 5000], [0, 360]);
  const compassRotate = useTransform(smoothScrollY, [0, 5000], [0, -180]);
  const gridYParallax = useTransform(smoothScrollY, [0, 5000], [0, -400]);
  const gridOpacity = useTransform(smoothProgress, [0, 0.2, 0.8, 1], [0.35, 0.5, 0.4, 0.3]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Dynamic scroll tracking variables
    let lastScrollY = window.scrollY;
    let currentScrollY = window.scrollY;
    let scrollVelocity = 0;
    let smoothedVelocity = 0;
    let lastTime = performance.now();
    let packetOffset = 0;
    let radarPulseRadius = 0;
    let rippleCenter = { x: width * 0.56, y: height * 0.42 };

    const updateScrollMetrics = () => {
      const nowScroll = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? nowScroll / docHeight : 0;
      
      // Update telemetry display
      const currentLat = (15 + progress * 45).toFixed(4);
      const currentLon = (-130 + progress * 240).toFixed(4);
      const headingDeg = Math.round((42 + progress * 320) % 360);
      const knots = (18 + Math.abs(smoothedVelocity) * 1.5).toFixed(1);

      setTelemetry({
        lat: `${currentLat}° N`,
        lon: `${Math.abs(Number(currentLon)).toFixed(4)}° ${Number(currentLon) >= 0 ? 'E' : 'W'}`,
        heading: `${headingDeg.toString().padStart(3, '0')}°`,
        speedKnots: `${knots} kts`,
        activeReroutes: Math.round(12 + progress * 16),
      });
    };

    const handleScroll = () => {
      currentScrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Render loop
    const render = (time: number) => {
      const dt = Math.max(1, (time - lastTime) / 1000);
      lastTime = time;

      // Calculate instantaneous and smoothed velocity
      const rawVelocity = (currentScrollY - lastScrollY) / dt;
      lastScrollY = currentScrollY;
      smoothedVelocity += (rawVelocity - smoothedVelocity) * 0.12;
      const absVelocity = Math.abs(smoothedVelocity);

      // Packet advance is propelled by constant base flow + scroll velocity
      packetOffset += (0.0015 + absVelocity * 0.00008);

      // Trigger radar ripple if scroll velocity spikes
      if (absVelocity > 150 && radarPulseRadius === 0) {
        radarPulseRadius = 1;
        // Focus near Suez or Rotterdam based on scroll depth
        const focalHub = currentScrollY > 1200 ? GLOBAL_HUBS[5] : GLOBAL_HUBS[3];
        rippleCenter = { x: focalHub.x * width, y: focalHub.y * height };
      }

      if (radarPulseRadius > 0) {
        radarPulseRadius += 3.5 + absVelocity * 0.01;
        if (radarPulseRadius > Math.max(width, height) * 0.7) {
          radarPulseRadius = 0;
        }
      }

      // Parallax shift based on scroll
      const parallaxY = -(currentScrollY * 0.08) % 80;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle background coordinate grid that shifts with scroll
      ctx.save();
      const gridSize = 64;
      ctx.strokeStyle = 'rgba(15, 43, 72, 0.04)';
      ctx.lineWidth = 1;

      const offsetX = 0;
      const offsetY = parallaxY;

      ctx.beginPath();
      for (let x = offsetX % gridSize; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = offsetY % gridSize; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Grid intersections dots
      ctx.fillStyle = 'rgba(15, 43, 72, 0.08)';
      for (let x = offsetX % (gridSize * 2); x < width; x += gridSize * 2) {
        for (let y = offsetY % (gridSize * 2); y < height; y += gridSize * 2) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 2. Draw Topographic / Bathymetric contour stream reacting to scroll
      ctx.save();
      const waveCount = 4;
      const scrollPhase = currentScrollY * 0.0025;
      for (let w = 0; w < waveCount; w++) {
        const baseHeight = height * (0.65 + w * 0.09);
        const waveOpacity = 0.03 + (w * 0.015);
        ctx.strokeStyle = `rgba(15, 43, 72, ${waveOpacity})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();

        for (let x = 0; x <= width; x += 16) {
          const nx = x / width;
          const elevation = 
            Math.sin(nx * 4 + scrollPhase + w * 1.5) * (18 + w * 6) +
            Math.cos(nx * 8 - scrollPhase * 0.8) * 8 +
            (smoothedVelocity * 0.02 * Math.sin(nx * 10));
          const y = baseHeight + elevation;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // 3. Draw Radar Ripple if active
      if (radarPulseRadius > 0) {
        ctx.save();
        const rippleAlpha = Math.max(0, 0.25 * (1 - radarPulseRadius / (Math.max(width, height) * 0.7)));
        ctx.strokeStyle = `rgba(201, 42, 42, ${rippleAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(rippleCenter.x, rippleCenter.y, radarPulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(15, 43, 72, ${rippleAlpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(rippleCenter.x, rippleCenter.y, radarPulseRadius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Map hub screen coordinates with scroll parallax
      const hubCoords: Record<string, { x: number; y: number; hub: HubNode }> = {};
      GLOBAL_HUBS.forEach((hub) => {
        // Individual parallax depth based on y coordinate
        const depthFactor = 0.03 + (hub.y * 0.06);
        const screenX = hub.x * width;
        const screenY = hub.y * height - (currentScrollY * depthFactor) % (height * 1.2) + (height * 0.08);
        hubCoords[hub.id] = { x: screenX, y: screenY, hub };
      });

      // 4. Draw Great-Circle Transit Arcs & Animated Cargo Packets
      HUB_CONNECTIONS.forEach(([fromId, toId], idx) => {
        const from = hubCoords[fromId];
        const to = hubCoords[toId];
        if (!from || !to) return;

        // Bezier control point arc curving upward or downward
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const arcHeight = Math.min(60, dist * 0.18) * (idx % 2 === 0 ? -1 : 1);
        const cpX = midX;
        const cpY = midY + arcHeight + Math.sin(scrollPhase + idx) * 8;

        // Base route path
        ctx.save();
        const isAlertRoute = from.hub.status === 'diverted' || to.hub.status === 'diverted';
        ctx.strokeStyle = isAlertRoute ? 'rgba(201, 42, 42, 0.14)' : 'rgba(15, 43, 72, 0.12)';
        ctx.lineWidth = isAlertRoute ? 1.5 : 1;
        ctx.setLineDash([4, 8]);
        // Line dash animated by scroll
        ctx.lineDashOffset = -(currentScrollY * 0.4 + time * 0.015 * (idx % 2 === 0 ? 1 : -1));

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
        ctx.stroke();
        ctx.restore();

        // Moving cargo packet pulse along quadratic curve
        const t = (packetOffset * 1.4 + (idx * 0.17)) % 1;
        const packetX = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cpX + t * t * to.x;
        const packetY = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cpY + t * t * to.y;

        ctx.save();
        ctx.fillStyle = isAlertRoute ? '#c92a2a' : '#0f2b48';
        ctx.beginPath();
        ctx.arc(packetX, packetY, 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Glow around packet
        ctx.fillStyle = isAlertRoute ? 'rgba(201, 42, 42, 0.25)' : 'rgba(15, 43, 72, 0.2)';
        ctx.beginPath();
        ctx.arc(packetX, packetY, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 5. Draw Hub Nodes and Telemetry Rings
      Object.values(hubCoords).forEach(({ x, y, hub }, i) => {
        ctx.save();
        const isAlert = hub.status === 'diverted';
        const isCongested = hub.status === 'congested';
        const nodeColor = isAlert ? '#c92a2a' : isCongested ? '#b45309' : '#0f2b48';

        // Outer pulsing orbital ring (reacts to scroll velocity)
        const pulseSize = 6 + Math.sin(time * 0.003 + i) * 2 + Math.min(8, absVelocity * 0.02);
        ctx.strokeStyle = isAlert ? 'rgba(201, 42, 42, 0.28)' : 'rgba(15, 43, 72, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        ctx.stroke();

        // Inner solid core
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Alphanumeric node label and status
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(hub.code, x + 10, y - 4);

        if (isAlert) {
          ctx.fillStyle = '#c92a2a';
          ctx.fillText('REROUTE', x + 10, y + 8);
        } else if (isCongested) {
          ctx.fillStyle = '#b45309';
          ctx.fillText('QUEUE', x + 10, y + 8);
        }
        ctx.restore();
      });

      // Update telemetry state occasionally
      if (Math.random() < 0.08) {
        updateScrollMetrics();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* HTML5 Interactive Physics Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none opacity-85" 
      />

      {/* Parallax SVG Geometrical Radar Telemetry Layer */}
      <motion.div 
        style={{ y: gridYParallax, opacity: gridOpacity }}
        className="absolute inset-0 pointer-events-none"
      >
        {/* Top-Right Rotating Radar Graticule */}
        <motion.div 
          style={{ rotate: ringRotate }}
          className="absolute -top-24 -right-24 w-[520px] h-[520px] text-[#0f2b48] opacity-35"
        >
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.25" strokeDasharray="1 3" />
            <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="26" stroke="currentColor" strokeWidth="0.15" strokeDasharray="2 4" />
            <circle cx="50" cy="50" r="14" stroke="currentColor" strokeWidth="0.25" />
            <line x1="50" y1="2" x2="50" y2="98" stroke="currentColor" strokeWidth="0.1" />
            <line x1="2" y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth="0.1" />
            <path d="M50 20 L50 24 M50 76 L50 80 M20 50 L24 50 M76 50 L80 50" stroke="currentColor" strokeWidth="0.4" />
          </svg>
        </motion.div>

        {/* Center-Left Navigational Compass Dial */}
        <motion.div 
          style={{ rotate: compassRotate }}
          className="absolute top-[42%] -left-28 w-[440px] h-[440px] text-[#4b5563] opacity-25"
        >
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <polygon points="50,4 94,26 94,74 50,96 6,74 6,26" stroke="currentColor" strokeWidth="0.2" />
            <polygon points="50,14 84,31 84,69 50,86 16,69 16,31" stroke="currentColor" strokeWidth="0.2" strokeDasharray="2 3" />
            <circle cx="50" cy="50" r="18" stroke="currentColor" strokeWidth="0.2" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Floating Viewport Telemetry Ribbons (Reacts to Scroll Depth) */}
      <div className="fixed bottom-6 left-6 z-20 hidden md:flex items-center gap-4 px-3.5 py-2 rounded-md bg-[#fbfaf7]/90 backdrop-blur-md border border-[#e5e1d8] shadow-xs font-mono text-[11px] text-[#4b5563]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
          <span className="font-semibold text-[#111827]">GRID SYNC</span>
        </div>
        <span className="text-[#d1d5db]">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[#9ca3af]">POS:</span>
          <span className="text-[#0f2b48] font-bold tabular-nums">{telemetry.lat}</span>
          <span className="text-[#0f2b48] font-bold tabular-nums">{telemetry.lon}</span>
        </div>
        <span className="text-[#d1d5db]">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[#9ca3af]">V_EFF:</span>
          <span className="text-[#111827] font-semibold tabular-nums">{telemetry.speedKnots}</span>
        </div>
        <span className="text-[#d1d5db]">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[#9ca3af]">ACTIVE REROUTES:</span>
          <span className="text-[#c92a2a] font-bold tabular-nums">{telemetry.activeReroutes} NODES</span>
        </div>
      </div>

      {/* Vertical Scroll Progress Bar Indicator on Viewport Edge */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col items-center gap-2 py-4 px-1.5 rounded-full bg-[#fbfaf7]/75 backdrop-blur-xs border border-[#e5e1d8] text-[9px] font-mono text-[#9ca3af]">
        <span>N</span>
        <div className="w-[2px] h-24 bg-[#e5e1d8] relative rounded-full overflow-hidden">
          <motion.div 
            style={{ scaleY: smoothProgress, transformOrigin: 'top' }}
            className="w-full h-full bg-[#0f2b48]"
          />
        </div>
        <span>S</span>
      </div>
    </div>
  );
};
