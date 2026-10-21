import assert from 'node:assert/strict';
import { parsePrefs, serializePrefs, DEFAULT_PREFS } from '../src/storage/prefsCodec.ts';

assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
assert.deepEqual(parsePrefs(''), DEFAULT_PREFS);
assert.deepEqual(parsePrefs('{not json'), DEFAULT_PREFS);
assert.equal(parsePrefs('{"count":0}').count, 1);
assert.equal(parsePrefs('{"count":99}').count, 20);
assert.equal(parsePrefs('{"count":"x"}').count, 1);
assert.equal(parsePrefs('{"count":4}').count, 4);
assert.equal(parsePrefs('{"count":2,"lastColor":"red"}').lastColor, null);
const p = { count: 4, lastColor: '#e53935' };
assert.deepEqual(parsePrefs(serializePrefs(p)), p);
console.log('checkPrefs OK');
