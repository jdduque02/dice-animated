export interface Prefs {
  count: number;
  /** null until the user picks a color; App falls back to its first palette color. */
  lastColor: string | null;
}

export const MIN_DICE = 1;
export const MAX_DICE = 20;

export const DEFAULT_PREFS: Prefs = { count: 1, lastColor: null };

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Never throws: any corrupt/missing field falls back to its default, count is clamped. */
export function parsePrefs(raw: string | null | undefined): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const data = JSON.parse(raw);
    const n = Number(data?.count);
    const count = Number.isFinite(n) ? Math.min(MAX_DICE, Math.max(MIN_DICE, Math.round(n))) : DEFAULT_PREFS.count;
    const lastColor = typeof data?.lastColor === 'string' && HEX.test(data.lastColor) ? data.lastColor : null;
    return { count, lastColor };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function serializePrefs(prefs: Prefs): string {
  return JSON.stringify(prefs);
}
