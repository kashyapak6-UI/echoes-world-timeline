"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { EventItem } from "@/lib/types";
import { fmtYear } from "@/lib/format";
import { asset } from "@/lib/config";

function ll2v(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

function useDotTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.45, "rgba(255,255,255,.9)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(c);
  }, []);
}

function Globe({ land, events, colors, onYear }: { land: [number, number][]; events: EventItem[]; colors: Record<string, string>; onYear: (y: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const evGeo = useRef<THREE.BufferGeometry>(null);
  const landGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(land.length * 3);
    land.forEach(([la, lo], i) => ll2v(la, lo, 1).toArray(pos, i * 3));
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [land]);
  const evData = useMemo(() => {
    const pos = new Float32Array(events.length * 3), col = new Float32Array(events.length * 3);
    const c = new THREE.Color();
    events.forEach((e, i) => { ll2v(e.ll![0], e.ll![1], 1.012).toArray(pos, i * 3); c.set(colors[e.c] ?? "#fff").toArray(col, i * 3); });
    return { pos, col };
  }, [events, colors]);
  const dot = useDotTexture();
  const t0 = useRef(0);
  useFrame((state, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.08;
    const g = evGeo.current; if (!g || !events.length) return;
    t0.current += dt;
    const cycle = 16, k = (t0.current % cycle) / (cycle - 3);
    const n = Math.min(events.length, Math.floor(Math.min(1, k) * events.length));
    g.setDrawRange(0, n);
    onYear(events[Math.max(0, n - 1)].s);
  });
  return (
    <group ref={group} rotation={[0.35, -1.2, 0]}>
      <mesh><sphereGeometry args={[0.985, 64, 64]} /><meshBasicMaterial color="#0b0d16" /></mesh>
      <points geometry={landGeo}><pointsMaterial size={0.02} color="#3a4466" sizeAttenuation map={dot} transparent alphaTest={0.2} /></points>
      <points>
        <bufferGeometry ref={evGeo}>
          <bufferAttribute attach="attributes-position" args={[evData.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[evData.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.045} vertexColors sizeAttenuation map={dot} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      <mesh scale={1.08}><sphereGeometry args={[1, 48, 48]} /><meshBasicMaterial color="#7cc4ff" transparent opacity={0.04} side={THREE.BackSide} /></mesh>
    </group>
  );
}

export function HeroGlobe({ events, colors }: { events: EventItem[]; colors: Record<string, string> }) {
  const [land, setLand] = useState<[number, number][]>([]);
  const [year, setYear] = useState<number | null>(null);
  const lastYear = useRef<number | null>(null);
  useEffect(() => { fetch(asset("/data/land-dots.json")).then((r) => r.json()).then(setLand); }, []);
  const located = useMemo(() => events.filter((e) => e.ll && e.c !== "era" && e.s >= -3500).sort((a, b) => a.s - b.s), [events]);
  const onYear = (y: number) => {
    const r = Math.round(y / 10) * 10;
    if (r !== lastYear.current) { lastYear.current = r; setYear(r); }
  };
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        {land.length > 0 && <Globe land={land} events={located} colors={colors} onYear={onYear} />}
      </Canvas>
      {year != null && (
        <div className="pointer-events-none absolute bottom-[12%] left-1/2 hidden -translate-x-1/2 text-center md:block">
          <div className="font-mono text-[11px] uppercase tracking-[.3em] text-muted">history unfolding</div>
          <div className="font-display text-4xl italic text-gold tabular-nums">{fmtYear(year)}</div>
        </div>
      )}
    </div>
  );
}
