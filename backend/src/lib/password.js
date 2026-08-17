const crypto = require('crypto');

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha256';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex');

  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;

  const candidateHash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch (err) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
