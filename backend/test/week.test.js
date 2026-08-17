const test = require('node:test');
const assert = require('node:assert/strict');

const { getSeasonWeekIndex, isSeasonStarted, getSeasonStartDate } = require('../src/lib/week');

test('season start date is normalized to the first Monday of the season', () => {
  assert.equal(getSeasonStartDate().toISOString().slice(0, 10), '2026-08-24');
});

test('season week starts at 0 when the configured start date is reached', () => {
  assert.equal(getSeasonWeekIndex(new Date('2026-08-30T00:00:00Z')), 0);
  assert.equal(getSeasonWeekIndex(new Date('2026-09-05T12:00:00Z')), 0);
  assert.equal(getSeasonWeekIndex(new Date('2026-09-06T12:00:00Z')), 1);
});

test('season is not active before the configured start date', () => {
  assert.equal(isSeasonStarted(new Date('2026-08-23T12:00:00Z')), false);
  assert.equal(isSeasonStarted(new Date('2026-08-24T00:00:00Z')), true);
});
