const test = require('node:test');
const assert = require('node:assert/strict');

const { getSeasonWeekIndex, isSeasonStarted, getSeasonStartDate, getWeekEspnDateRange } = require('../src/lib/week');

test('season start date is normalized to the first Wednesday of the season', () => {
  assert.equal(getSeasonStartDate().toISOString().slice(0, 10), '2026-08-26');
});

test('season week starts at 0 on Wednesday and advances every seven days', () => {
  assert.equal(getSeasonWeekIndex(new Date('2026-08-26T00:00:00Z')), 0);
  assert.equal(getSeasonWeekIndex(new Date('2026-09-01T12:00:00Z')), 0);
  assert.equal(getSeasonWeekIndex(new Date('2026-09-02T00:00:00Z')), 1);
});

test('season is not active before the configured start date', () => {
  assert.equal(isSeasonStarted(new Date('2026-08-25T12:00:00Z')), false);
  assert.equal(isSeasonStarted(new Date('2026-08-26T00:00:00Z')), true);
});

test('ESPN range covers Wednesday through the following Tuesday', () => {
  assert.deepEqual(getWeekEspnDateRange('2026-08-26'), {
    start: '20260826',
    end: '20260901',
  });
});
