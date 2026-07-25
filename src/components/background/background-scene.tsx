"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useTheme } from "next-themes";

// ─── Theme-tuned scene config (Aurora Light pass, 2026-07-24) ────────────────
// The canvas paints a solid, full-viewport background color behind every
// route (z-index 0, fixed) — it is the app's real page background, not
// decoration on top of one. A light theme therefore can't reuse the dark
// scene's lighting/materials as-is: point-light intensities and emissive
// glow tuned to read against near-black (#0B0F19) either wash out a light
// ground to white or (if left too dim) read as murky rather than premium.
// Geometry/composition/animation are identical between themes — only
// color and intensity are relit, matching the "genuine redesign, not a
// naive inversion" direction confirmed in the approved mockup.
interface SceneTheme {
  bg: string;
  hemisphere: [string, string, number];
  directional: { color: string; intensity: number };
  violetKey: { color: string; base: number; wobble: number };
  blueRim: { color: string; base: number; wobble: number };
  purpleAccent: { color: string; intensity: number };
  glassEmissiveScale: number;
  particleColorNear: string;
  particleColorFar: string;
  particleOpacityScale: number;
  volumeOpacityScale: number;
}

const SCENE_THEME: { dark: SceneTheme; light: SceneTheme } = {
  dark: {
    bg: "#0B0F19",
    hemisphere: ["#1a0533", "#04080f", 0.7],
    directional: { color: "#e8e0ff", intensity: 0.55 },
    violetKey: { color: "#7C3AED", base: 6, wobble: 1.4 },
    blueRim: { color: "#2563EB", base: 3.5, wobble: 0.8 },
    purpleAccent: { color: "#A78BFA", intensity: 2.4 },
    glassEmissiveScale: 1,
    particleColorNear: "#DDD6FE",
    particleColorFar: "#EDE9FE",
    particleOpacityScale: 1,
    volumeOpacityScale: 1,
  },
  light: {
    bg: "#FAF9F7",
    // Soft lavender sky / warm-ivory ground — same hemisphere-separation
    // technique, recalibrated for a light room instead of a night sky.
    hemisphere: ["#EDE9FE", "#FDFBF7", 1.05],
    directional: { color: "#FFFFFF", intensity: 0.85 },
    // Point-light intensities cut ~55-60% — a light ground shows moderate
    // intensity clearly; the dark scene's values would blow out to white.
    violetKey: { color: "#7C3AED", base: 2.6, wobble: 0.6 },
    blueRim: { color: "#2563EB", base: 1.5, wobble: 0.35 },
    purpleAccent: { color: "#A78BFA", intensity: 1.0 },
    glassEmissiveScale: 0.45,
    // Pale lavender particles vanish on ivory — deepened for visibility.
    particleColorNear: "#9D7FE8",
    particleColorFar: "#B9A6ED",
    particleOpacityScale: 0.7,
    // Aurora/atmospheric washes read as murk on a light ground at dark-mode
    // opacity — dialed back further than everything else in the scene.
    volumeOpacityScale: 0.35,
  },
};

// ─── Scene Lights ─────────────────────────────────────────────────────────────
// 5-light premium rig:
//   hemisphereLight    — free sky/ground color separation, no falloff artifacts
//   directionalLight   — soft lavender fill from above-right
//   violetKey          — breathing violet key light (upper right)
//   blueRim            — counter-key from lower left
//   purpleAccent       — top-left fill, closes the shadow side
function SceneLights({ theme }: { theme: SceneTheme }) {
  const violetRef = useRef<THREE.PointLight>(null!);
  const blueRef = useRef<THREE.PointLight>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (violetRef.current) violetRef.current.intensity = theme.violetKey.base + Math.sin(t * 0.38) * theme.violetKey.wobble;
    if (blueRef.current) blueRef.current.intensity = theme.blueRim.base + Math.cos(t * 0.33) * theme.blueRim.wobble;
  });

  return (
    <>
      <hemisphereLight args={theme.hemisphere} />
      <directionalLight position={[2, 10, 6]} intensity={theme.directional.intensity} color={theme.directional.color} />
      <pointLight ref={violetRef} position={[5, 6, 3]} intensity={theme.violetKey.base} color={theme.violetKey.color} decay={1.8} />
      <pointLight ref={blueRef} position={[-5, -4, 2]} intensity={theme.blueRim.base} color={theme.blueRim.color} decay={2.0} />
      <pointLight position={[-3, 5, -1]} intensity={theme.purpleAccent.intensity} color={theme.purpleAccent.color} decay={2.2} />
    </>
  );
}

// ─── Hero Glass Torus ─────────────────────────────────────────────────────────
// The centerpiece. MeshTransmissionMaterial: real liquid glass with chromatic
// aberration and subsurface refraction. Not plastic. Not matte.
// Position: upper center-right per composition brief.
function GlassTorus({ theme, position }: { theme: SceneTheme; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.085;
    ref.current.rotation.z += delta * 0.026;
  });

  return (
    <mesh ref={ref} position={position} rotation={[0.35, 0, 0.08]}>
      <torusGeometry args={[1.9, 0.48, 32, 64]} />
      <MeshTransmissionMaterial
        transmission={0.92}
        roughness={0.02}
        thickness={1.4}
        chromaticAberration={0.07}
        anisotropy={0.4}
        distortion={0.12}
        distortionScale={0.25}
        temporalDistortion={0.08}
        color="#9D6FEF"
        emissive="#4C1D95"
        emissiveIntensity={0.06 * theme.glassEmissiveScale}
        samples={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Crystal Shards ───────────────────────────────────────────────────────────
// icosahedron detail=1 (80 faces) avoids the flat "cartoon gem" look of detail=0.
// Physical glass: real transmission + clearcoat, soft purple tint.
interface CrystalProps {
  position: [number, number, number];
  scale: number;
  spinSpeed: number;
  floatSpeed: number;
  floatAmplitude: number;
  color: string;
  phaseOffset: number;
  theme: SceneTheme;
}

function Crystal({ position, scale, spinSpeed, floatSpeed, floatAmplitude, color, phaseOffset, theme }: CrystalProps) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * spinSpeed;
    ref.current.rotation.x = Math.sin(t * spinSpeed * 0.6 + phaseOffset) * 0.32;
    ref.current.position.y = position[1] + Math.sin(t * floatSpeed + phaseOffset) * floatAmplitude;
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 1]} />
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.045 * theme.glassEmissiveScale}
        metalness={0.0}
        roughness={0.02}
        transmission={0.78}
        ior={1.5}
        thickness={0.9}
        clearcoat={1.0}
        clearcoatRoughness={0.04}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Glass Spheres ────────────────────────────────────────────────────────────
// Higher poly count (32 segments). Water-like IOR (1.33) is softer than glass,
// gives the "liquid" feel without sharp refraction edges.
interface GlassSphereProps {
  position: [number, number, number];
  scale: number;
  phaseOffset: number;
  theme: SceneTheme;
}

function GlassSphere({ position, scale, phaseOffset, theme }: GlassSphereProps) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 0.28 + phaseOffset) * 0.18;
    ref.current.rotation.y += 0.003;
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshPhysicalMaterial
        color="#BFDBFE"
        emissive="#3B82F6"
        emissiveIntensity={0.035 * theme.glassEmissiveScale}
        metalness={0.0}
        roughness={0.0}
        transmission={0.88}
        ior={1.33}
        thickness={0.65}
        clearcoat={0.85}
        clearcoatRoughness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Glass Ribbon ─────────────────────────────────────────────────────────────
// A thin, elliptical ring — lower right per brief composition. Ice-blue
// transmission, rotated to catch multiple light angles simultaneously.
function GlassRibbon({ theme, position }: { theme: SceneTheme; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    ref.current.rotation.z += delta * 0.038;
    ref.current.rotation.y += delta * 0.016;
  });

  return (
    <mesh ref={ref} position={position} scale={[1.85, 1.0, 0.42]} rotation={[0.38, -0.28, 0.18]}>
      <torusGeometry args={[1.0, 0.052, 8, 56]} />
      <meshPhysicalMaterial
        color="#A5F3FC"
        emissive="#0EA5E9"
        emissiveIntensity={0.032 * theme.glassEmissiveScale}
        metalness={0.0}
        roughness={0.0}
        transmission={0.92}
        ior={1.38}
        thickness={0.12}
        clearcoat={1.0}
        clearcoatRoughness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Depth-Layered Particle Field ─────────────────────────────────────────────
// Two draw calls instead of one. Near layer: brighter, larger.
// Far layer: dimmer, smaller, slower drift — creates true depth perception.
interface ParticleFieldProps {
  count?: number;
  zMin?: number;
  zMax?: number;
  size?: number;
  opacity?: number;
  color?: string;
  driftSpeed?: number;
}

function ParticleField({
  count = 180,
  zMin = -2,
  zMax = -9,
  size = 0.032,
  opacity = 0.15,
  color = "#DDD6FE",
  driftSpeed = 1.0,
}: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  const { geometry, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = zMin + Math.random() * Math.abs(zMax - zMin);
      speeds[i] = (Math.random() * 0.004 + 0.001) * driftSpeed;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, speeds };
  }, [count, zMin, zMax, driftSpeed]);

  useFrame(() => {
    const attr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i];
      if (arr[i * 3 + 1] > 10) arr[i * 3 + 1] = -10;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Atmospheric Depth Volumes ─────────────────────────────────────────────────
// Very faint emissive spheres deep in the scene. Never visible as distinct
// objects — their ambient glow creates the "luminous depth" feeling behind glass.
function AtmosphericVolumes({ theme }: { theme: SceneTheme }) {
  return (
    <>
      <mesh position={[1.5, -0.5, -15]}>
        <sphereGeometry args={[5.5, 10, 10]} />
        <meshBasicMaterial color="#2D0B6E" transparent opacity={0.05 * theme.volumeOpacityScale} />
      </mesh>
      <mesh position={[-2.5, 2.0, -20]}>
        <sphereGeometry args={[4.5, 8, 8]} />
        <meshBasicMaterial color="#0c1a5e" transparent opacity={0.038 * theme.volumeOpacityScale} />
      </mesh>
    </>
  );
}

// ─── Aurora Ribbons ───────────────────────────────────────────────────────────
// Very large planes positioned deep enough that the fog naturally fades them.
// At this scale (48×14 units) and opacity (0.011–0.018), they read as
// atmospheric gradients rather than visible rectangles.
function AuroraRibbons({ theme }: { theme: SceneTheme }) {
  const ref0 = useRef<THREE.Mesh>(null!);
  const ref1 = useRef<THREE.Mesh>(null!);
  const ref2 = useRef<THREE.Mesh>(null!);
  const ref3 = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref0.current) ref0.current.rotation.z = Math.sin(t * 0.065) * 0.07;
    if (ref1.current) ref1.current.rotation.z = Math.sin(t * 0.065 + Math.PI * 0.6) * 0.07;
    if (ref2.current) ref2.current.rotation.z = Math.sin(t * 0.065 + Math.PI) * 0.07;
    if (ref3.current) ref3.current.rotation.z = Math.sin(t * 0.055 + Math.PI * 1.4) * 0.06;
  });

  return (
    <>
      <mesh ref={ref0} position={[0, 3, -18]} rotation={[0.1, 0, 0]}>
        <planeGeometry args={[50, 14]} />
        <meshBasicMaterial color="#5B21B6" transparent opacity={0.018 * theme.volumeOpacityScale} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ref1} position={[2, -1, -24]} rotation={[-0.06, 0.05, 0]}>
        <planeGeometry args={[50, 14]} />
        <meshBasicMaterial color="#1D4ED8" transparent opacity={0.013 * theme.volumeOpacityScale} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ref2} position={[-2, 1, -30]} rotation={[0.08, -0.04, 0]}>
        <planeGeometry args={[50, 16]} />
        <meshBasicMaterial color="#4338CA" transparent opacity={0.010 * theme.volumeOpacityScale} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ref3} position={[0, -2, -22]} rotation={[0.04, 0.02, 0]}>
        <planeGeometry args={[50, 10]} />
        <meshBasicMaterial color="#0891B2" transparent opacity={0.009 * theme.volumeOpacityScale} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ─── Mouse Parallax + Camera Breathing ───────────────────────────────────────
// Parallax max: 0.009 rad ≈ 0.5° per brief.
// Camera breathing: very slow sine on z (period ~52s, amplitude ±0.08 units).
function ParallaxGroup({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null!);
  const mouse = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  const { camera } = useThree();

  const handleMouse = useCallback((e: MouseEvent) => {
    mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
  }, []);

  const handleScroll = useCallback(() => {
    const el = document.querySelector("main");
    if (el) scroll.current = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
  }, []);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    window.addEventListener("mousemove", handleMouse, { passive: true });
    mainEl?.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      mainEl?.removeEventListener("scroll", handleScroll);
    };
  }, [handleMouse, handleScroll]);

  useFrame((state) => {
    // Subtle parallax — max ≈0.5° per brief
    const targetX = mouse.current.y * 0.009;
    const targetY = mouse.current.x * 0.009;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.032;
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.032;

    // Camera breathing — 52s period, ±0.08 units
    const breathe = Math.sin(state.clock.elapsedTime * 0.12) * 0.08;
    const scrollPull = 5 - scroll.current * 0.8;
    camera.position.z += (scrollPull + breathe - camera.position.z) * 0.04;
  });

  return <group ref={groupRef}>{children}</group>;
}

// ─── Full 3D Scene ────────────────────────────────────────────────────────────
function Scene({ theme }: { theme: SceneTheme }) {
  return (
    <ParallaxGroup>
      <SceneLights theme={theme} />

      {/* Deep atmospheric volumes — behind all glass objects */}
      <AtmosphericVolumes theme={theme} />
      <AuroraRibbons theme={theme} />

      {/* Hero torus — pushed to bleed off the far upper-right corner
          (2026-07-24: was [1.8,1.5,-5.5], close enough to camera/center to
          render directly over hero content at typical viewport widths —
          confirmed via live screenshot, present in both themes, not new to
          this pass). A first pass moved objects to x/y ~±5-6 at z ~-7/-8.5,
          which was still not far enough out: at fov 54 the visible frustum
          at that depth is wide enough that ±5-6 is only ~half-way to the
          true edge, so shapes still sat over the hero card (second live
          screenshot). This pass pushes every object close to or past the
          frustum boundary (x/y ~±9-11 at z ~-9 to -12) so each one reads as
          a corner accent bleeding off-frame — the intended "sparingly used,
          not cluttering" treatment — verified against the actual visible
          content width (sidebar + centered 880px column leaves only ~150-
          200px of true margin at 1440px viewport width, too narrow for a
          moderate offset to clear on its own). */}
      <GlassTorus theme={theme} position={[9.5, 4.0, -11]} />

      {/* Large crystal — upper-left corner */}
      <Crystal
        position={[-10, 4.5, -10]}
        scale={0.55}
        spinSpeed={0.18}
        floatSpeed={0.35}
        floatAmplitude={0.22}
        color="#A78BFA"
        phaseOffset={0}
        theme={theme}
      />

      {/* Smaller accent crystals — right edge / lower-left corner */}
      <Crystal
        position={[10, 2.0, -9]}
        scale={0.30}
        spinSpeed={0.22}
        floatSpeed={0.44}
        floatAmplitude={0.14}
        color="#C4B5FD"
        phaseOffset={2.1}
        theme={theme}
      />
      <Crystal
        position={[-10, -4.5, -11]}
        scale={0.26}
        spinSpeed={0.15}
        floatSpeed={0.30}
        floatAmplitude={0.16}
        color="#818CF8"
        phaseOffset={1.4}
        theme={theme}
      />

      {/* Glass spheres — lower-left and right corners, no longer the
          near-camera dominant sphere that used to sit at z=-2.8 */}
      <GlassSphere position={[-10.5, -5, -10]} scale={0.42} phaseOffset={0} theme={theme} />
      <GlassSphere position={[-11, 2.5, -12]} scale={0.36} phaseOffset={2.6} theme={theme} />
      <GlassSphere position={[10, -5, -10]} scale={0.24} phaseOffset={4.9} theme={theme} />

      {/* Glass ribbon — lower-right corner */}
      <GlassRibbon theme={theme} position={[10.5, -4, -11]} />

      {/* Particles — near layer (z -2 to -9): dim, small */}
      <ParticleField
        count={180}
        zMin={-2}
        zMax={-9}
        size={0.032}
        opacity={0.14 * theme.particleOpacityScale}
        color={theme.particleColorNear}
        driftSpeed={1.0}
      />
      {/* Particles — far layer (z -9 to -16): very dim, tiny, slower */}
      <ParticleField
        count={80}
        zMin={-9}
        zMax={-16}
        size={0.020}
        opacity={0.07 * theme.particleOpacityScale}
        color={theme.particleColorFar}
        driftSpeed={0.6}
      />
    </ParallaxGroup>
  );
}

// ─── Canvas Wrapper ───────────────────────────────────────────────────────────
export function BackgroundScene() {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const { resolvedTheme } = useTheme();
  const [forcedTheme, setForcedTheme] = useState<"light" | "dark" | null>(null);

  // ForceSceneTheme (login, etc.) pins the scene independent of the site
  // toggle — see that component's own comment for why.
  useEffect(() => {
    const read = () => {
      const forced = document.documentElement.getAttribute("data-force-scene-theme");
      setForcedTheme(forced === "light" || forced === "dark" ? forced : null);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-force-scene-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // Default to dark on the very first frame (pre-hydration resolvedTheme is
  // undefined) — matches the scene's pre-existing dark-only look, so there
  // is no light->dark flash for users who land on a dark preference.
  const effectiveTheme = forcedTheme ?? (resolvedTheme === "light" ? "light" : "dark");
  const sceneTheme = effectiveTheme === "light" ? SCENE_THEME.light : SCENE_THEME.dark;

  useEffect(() => {
    const decide = () =>
      setFrameloop(
        document.hidden || document.documentElement.hasAttribute("data-editor")
          ? "never"
          : "always"
      );

    // Pause when tab is hidden or when inside the editor
    document.addEventListener("visibilitychange", decide);

    // React to editor-mode toggling (EditorModeActivator sets/removes data-editor)
    const observer = new MutationObserver(decide);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-editor"],
    });

    return () => {
      document.removeEventListener("visibilitychange", decide);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="lv-bg-engine"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 54, near: 0.1, far: 60 }}
        dpr={[1, 1.5]}
        frameloop={frameloop}
        performance={{ min: 0.5 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <color attach="background" args={[sceneTheme.bg]} />
        {/* Fog: starts at z=10, complete at z=26 — naturally fades deep aurora ribbons */}
        <fog attach="fog" args={[sceneTheme.bg, 10, 26]} />
        <AdaptiveDpr pixelated />
        <Scene theme={sceneTheme} />
      </Canvas>
    </div>
  );
}
