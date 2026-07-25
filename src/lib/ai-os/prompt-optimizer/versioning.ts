export const OPTIMIZATION_VERSION = "1.0.0";
export const OPTIMIZER_SCHEMA_VERSION = "1.0.0";

export function generateOptimizationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `opt_${ts}_${rand}`;
}
