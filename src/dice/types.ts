export type DieType = 'd4' | 'd5' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export const DIE_TYPES: DieType[] = ['d4', 'd5', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

export const DIE_SIDES: Record<DieType, number> = {
  d4: 4,
  d5: 5,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export type IconType = 'skull' | 'fire' | 'water' | 'earth' | 'light' | 'dark' | 'cat' | 'dog' | 'bird' | 'fish';
export const ICON_TYPES: IconType[] = [
  'skull',
  'fire',
  'water',
  'earth',
  'light',
  'dark',
  'cat',
  'dog',
  'bird',
  'fish',
];

export type FaceStyle =
  | { kind: 'numbers' }
  | { kind: 'pips' }
  | { kind: 'icon'; icons: (IconType | null)[] }
  | { kind: 'photo'; uris: (string | null)[] };

/** Icon/photo faces show a drawing instead of a number, so their rolled "value" (used
 * internally to pick which face is up) isn't meaningful to display anywhere. */
export function hasNumericValue(faceStyle: FaceStyle): boolean {
  return faceStyle.kind !== 'icon' && faceStyle.kind !== 'photo';
}

export interface DieInstanceConfig {
  id: string;
  type: DieType;
  color: string;
  faceStyle: FaceStyle;
  /** Optional user-given label (e.g. "Ataque", "Jugador 2") shown instead of the die
   * type on its card and in the results list. */
  name?: string;
}
