import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { DEFAULT_PREFS, Prefs, parsePrefs, serializePrefs } from './prefsCodec';

// Synchronous on both platforms so App can seed its initial state from the cache
// without a loading flash (1 die -> N dice). Web has no document dir, so it uses localStorage.
const KEY = 'dados-animados-prefs';

function nativeFile() {
  return new File(Paths.document, 'prefs.json');
}

export function loadPrefs(): Prefs {
  try {
    if (Platform.OS === 'web') return parsePrefs(globalThis.localStorage?.getItem(KEY));
    const f = nativeFile();
    return f.exists ? parsePrefs(f.textSync()) : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    const raw = serializePrefs(prefs);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, raw);
    else nativeFile().write(raw);
  } catch {
    // Persistence is best-effort: a failed write must never break rolling dice.
  }
}
