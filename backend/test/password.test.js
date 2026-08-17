const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, verifyPassword } = require('../src/lib/password');

test('hashPassword creates a hash that verifies with the same password', async () => {
  const password = 'friendgroup123';
  const { hash, salt } = hashPassword(password);

  assert.notEqual(hash, password);
  assert.ok(salt.length > 0);
  assert.equal(verifyPassword(password, hash, salt), true);
  assert.equal(verifyPassword('wrong-password', hash, salt), false);
});
