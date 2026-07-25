export type MotionParameter =
  | "position"
  | "scale"
  | "rotation"
  | "opacity"
  | "blur"
  | "crop"
  | "mask"
  | "motionPath";

export type MotionEasing =
  | "LINEAR"
  | "EASE_IN"
  | "EASE_OUT"
  | "EASE_IN_OUT"
  | {
      type: "BEZIER";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export interface CropDefinition {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MaskDefinition {
  shape: "rectangle" | "ellipse" | "custom";
  path?: string;
}

export interface MotionPoint {
  x: number;
  y: number;
}

export interface MotionKeyframe {
  id: string;
  parameter: MotionParameter;
  timeMs: number;
  value: number | MotionPoint | CropDefinition | MaskDefinition | MotionPoint[];
  easing: MotionEasing;
}

export interface AnimationPreset {
  id: string;
  label: string;
  description: string;
  parameter: MotionParameter;
  keyframes: (durationMs: number, baseValue?: number | MotionPoint) => MotionKeyframe[];
}

const EASING = {
  LINEAR: (t: number) => t,
  EASE_IN: (t: number) => t * t,
  EASE_OUT: (t: number) => 1 - Math.pow(1 - t, 2),
  EASE_IN_OUT: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

function cubicBezier(t: number, x1: number, y1: number, x2: number, y2: number) {
  const cubic = (a: number, b: number, c: number, tValue: number) => ((1 - tValue) ** 3) * a + 3 * ((1 - tValue) ** 2) * tValue * b + 3 * (1 - tValue) * tValue * tValue * c + tValue ** 3;
  const x = cubic(0, x1, x2, 1);
  const y = cubic(0, y1, y2, 1);
  return { x, y };
}

function evaluateEasing(progress: number, easing: MotionEasing) {
  if (typeof easing === "string") {
    return EASING[easing](progress);
  }
  const { x1, y1, x2, y2 } = easing;
  const sampleCount = 12;
  let t = progress;
  for (let i = 0; i < sampleCount; i += 1) {
    const x = cubicBezier(t, x1, y1, x2, y2).x;
    t -= (x - progress) / 3;
  }
  return cubicBezier(t, x1, y1, x2, y2).y;
}

function interpolateNumber(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolatePoint(a: MotionPoint, b: MotionPoint, t: number): MotionPoint {
  return { x: interpolateNumber(a.x, b.x, t), y: interpolateNumber(a.y, b.y, t) };
}

function interpolateCrop(a: CropDefinition, b: CropDefinition, t: number): CropDefinition {
  return {
    top: interpolateNumber(a.top, b.top, t),
    right: interpolateNumber(a.right, b.right, t),
    bottom: interpolateNumber(a.bottom, b.bottom, t),
    left: interpolateNumber(a.left, b.left, t),
  };
}

function interpolateMask(a: MaskDefinition, b: MaskDefinition, t: number): MaskDefinition {
  if (a.shape !== b.shape || a.shape === "custom" || b.shape === "custom") {
    return t < 0.5 ? a : b;
  }
  return { ...a, path: t < 0.5 ? a.path : b.path };
}

type MotionValue = MotionKeyframe["value"];

function interpolateMotionValue(a: MotionValue, b: MotionValue, t: number): MotionValue {
  if (typeof a === "number" && typeof b === "number") {
    return interpolateNumber(a, b, t);
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.map((item, index) => interpolateMotionValue(item, b[index], t) as MotionPoint);
  }
  if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    if ("x" in a && "y" in a && "x" in b && "y" in b) {
      return interpolatePoint(a as MotionPoint, b as MotionPoint, t);
    }
    if ("top" in a && "right" in a && "bottom" in a && "left" in a && "top" in b) {
      return interpolateCrop(a as CropDefinition, b as CropDefinition, t);
    }
    if ("shape" in a && "shape" in b) {
      return interpolateMask(a as MaskDefinition, b as MaskDefinition, t);
    }
  }
  return t < 0.5 ? a : b;
}

export function interpolateMotionKeyframes(keyframes: MotionKeyframe[] | undefined, timeMs: number) {
  if (!keyframes || keyframes.length === 0) return {};

  const grouped = keyframes.reduce<Partial<Record<MotionParameter, MotionKeyframe[]>>>((acc, item) => {
    acc[item.parameter] = acc[item.parameter] ?? [];
    acc[item.parameter]!.push(item);
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(grouped).map(([parameter, frames]) => {
      const sorted = [...frames].sort((a, b) => a.timeMs - b.timeMs);
      if (timeMs <= sorted[0].timeMs) {
        return [parameter, sorted[0].value];
      }
      if (timeMs >= sorted[sorted.length - 1].timeMs) {
        return [parameter, sorted[sorted.length - 1].value];
      }

      const earlierIndex = sorted.findIndex((frame) => frame.timeMs > timeMs) - 1;
      const a = sorted[earlierIndex];
      const b = sorted[earlierIndex + 1];
      const progress = (timeMs - a.timeMs) / Math.max(1, b.timeMs - a.timeMs);
      const eased = evaluateEasing(progress, a.easing);
      return [parameter, interpolateMotionValue(a.value, b.value, eased)];
    })
  );
}

export const MOTION_PRESETS: AnimationPreset[] = [
  {
    id: "fade_in",
    label: "Fade In",
    description: "Soft opacity reveal from 0% to 100%.",
    parameter: "opacity",
    keyframes: (durationMs) => [
      { id: "fade-in-start", parameter: "opacity", timeMs: 0, value: 0, easing: "EASE_OUT" },
      { id: "fade-in-end", parameter: "opacity", timeMs: durationMs, value: 1, easing: "EASE_IN" },
    ],
  },
  {
    id: "slide_up",
    label: "Slide Up",
    description: "Move from below into place with ease out.",
    parameter: "position",
    keyframes: (durationMs, baseValue = { x: 0.5, y: 0.5 } as MotionPoint) => [
      { id: "slide-up-start", parameter: "position", timeMs: 0, value: { x: (baseValue as MotionPoint).x, y: (baseValue as MotionPoint).y + 0.25 }, easing: "EASE_OUT" },
      { id: "slide-up-end", parameter: "position", timeMs: durationMs, value: baseValue, easing: "EASE_IN_OUT" },
    ],
  },
  {
    id: "zoom_in",
    label: "Zoom In",
    description: "Scale up from a smaller frame.",
    parameter: "scale",
    keyframes: (durationMs) => [
      { id: "zoom-in-start", parameter: "scale", timeMs: 0, value: 0.85, easing: "EASE_OUT" },
      { id: "zoom-in-end", parameter: "scale", timeMs: durationMs, value: 1, easing: "EASE_IN" },
    ],
  },
  {
    id: "spin_in",
    label: "Spin In",
    description: "Rotate into position from the edge.",
    parameter: "rotation",
    keyframes: (durationMs) => [
      { id: "spin-in-start", parameter: "rotation", timeMs: 0, value: -35, easing: "EASE_OUT" },
      { id: "spin-in-end", parameter: "rotation", timeMs: durationMs, value: 0, easing: "EASE_IN_OUT" },
    ],
  },
  {
    id: "blur_in",
    label: "Blur In",
    description: "Start blurred and sharpen over time.",
    parameter: "blur",
    keyframes: (durationMs) => [
      { id: "blur-in-start", parameter: "blur", timeMs: 0, value: 16, easing: "EASE_OUT" },
      { id: "blur-in-end", parameter: "blur", timeMs: durationMs, value: 0, easing: "EASE_IN" },
    ],
  },
];

export function getMotionStyle(keyframes: MotionKeyframe[] | undefined, timeMs: number) {
  const values = interpolateMotionKeyframes(keyframes, timeMs) as Partial<Record<MotionParameter, MotionValue>>;

  const style: Record<string, string> = {};
  const translateX = typeof values.position === "object" ? `${(values.position as MotionPoint).x * 100}%` : undefined;
  const translateY = typeof values.position === "object" ? `${(values.position as MotionPoint).y * 100}%` : undefined;
  const scale = typeof values.scale === "number" ? values.scale : 1;
  const rotation = typeof values.rotation === "number" ? values.rotation : 0;
  const opacity = typeof values.opacity === "number" ? values.opacity : 1;
  const blur = typeof values.blur === "number" ? values.blur : 0;

  style.transform = `translate(${translateX ?? "0"}, ${translateY ?? "0"}) scale(${scale}) rotate(${rotation}deg)`;
  style.opacity = String(opacity);
  style.filter = blur > 0 ? `blur(${blur}px)` : "none";

  if (values.crop) {
    const crop = values.crop as CropDefinition;
    style.clipPath = `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`;
  }
  if (values.mask) {
    const mask = values.mask as MaskDefinition;
    if (mask.shape === "ellipse") {
      style.clipPath = "ellipse(45% 45% at 50% 50%)";
    } else if (mask.shape === "rectangle") {
      style.clipPath = "inset(0%)";
    } else if (mask.path) {
      style.clipPath = `path('${mask.path}')`;
    }
  }

  if (values.motionPath) {
    const path = values.motionPath as MotionPoint[];
    const index = Math.min(path.length - 1, Math.max(0, Math.floor((path.length - 1) * ((timeMs % 1000) / 1000))));
    const point = path[index];
    style.transform = `translate(${point.x * 100}%, ${point.y * 100}%) scale(${scale}) rotate(${rotation}deg)`;
  }

  return style;
}

export function getPresetById(id: string) {
  return MOTION_PRESETS.find((preset) => preset.id === id) ?? null;
}
