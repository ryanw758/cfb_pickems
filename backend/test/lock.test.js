const test = require('node:test');
const assert = require('node:assert/strict');

const { isGameLocked } = require('../src/lib/week');

test('games lock at kickoff and remain locked after kickoff', () => {
  const beforeKickoff = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const afterKickoff = new Date(Date.now() - 60 * 1000).toISOString();

  assert.equal(isGameLocked(beforeKickoff), false);
  assert.equal(isGameLocked(afterKickoff), true);
});
