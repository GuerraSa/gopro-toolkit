// Run with: node test.js
const assert = require('assert');
const { applyFilters, computeDuplicateIds, validateFilter, normalizeItem, toSeconds, fromSeconds } = require('./gopro-toolkit.user.js');

const clip = (id, extra) => normalizeItem({ id, filename: 'GX010001.MP4', file_size: '1000', captured_at: '2024-06-01T10:00:00Z', type: 'Video', moments_count: '0', ...extra });

// Duplicates: same filename + size + capture time. The oldest upload is the keeper, never marked.
const library = [
  clip('newer', { created_at: '2024-06-03T00:00:00Z' }),
  clip('oldest', { created_at: '2024-06-01T00:00:00Z' }),
  clip('middle', { created_at: '2024-06-02T00:00:00Z' }),
  clip('other-size', { created_at: '2024-06-01T00:00:00Z', file_size: '2000' }),
];
const dups = computeDuplicateIds(library);
assert.deepStrictEqual([...dups].sort(), ['middle', 'newer']);
// Other filters on top of "duplicates only" can never reach the keeper.
assert.deepStrictEqual(applyFilters(library, { duplicatesOnly: 'true', types: 'Video' }, dups).map((i) => i.id).sort(), ['middle', 'newer']);
// Once the original is gone (fresh library), its twin is the keeper and is not marked.
assert.strictEqual(computeDuplicateIds(library.filter((i) => i.id !== 'oldest')).has('middle'), false);

// HiLight filters.
const tagged = [clip('none'), clip('one', { moments_count: '1' }), clip('three', { moments_count: '3' })];
const ids = (f) => applyFilters(tagged, f).map((i) => i.id);
assert.deepStrictEqual(ids({ hilights: 'with' }), ['one', 'three']);
assert.deepStrictEqual(ids({ hilights: 'without' }), ['none']);
assert.deepStrictEqual(ids({ minMoments: '3' }), ['three']);
assert.deepStrictEqual(ids({}), ['none', 'one', 'three']);
assert.ok(validateFilter({ hilights: 'without', minMoments: '2' }));

// HiLight times are milliseconds, including a tag at 0:00.
assert.strictEqual(fromSeconds(90), 90000);
assert.strictEqual(toSeconds(0), 0);
assert.strictEqual(toSeconds(fromSeconds(12.3456)), 12.346);

console.log('all tests passed');
