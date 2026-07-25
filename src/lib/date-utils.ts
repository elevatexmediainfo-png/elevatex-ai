// Shared by anything that needs UTC calendar boundaries for "today"/"this
// month" windows (budget enforcement, cost dashboards) — using the server's
// local timezone here would make a provider's daily budget reset at a
// different wall-clock moment depending on deployment region.
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
