const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, badRequest, serverError } = require('../lib/http');
const { hashPassword, verifyPassword } = require('../lib/password');

const USERS_TABLE = process.env.USERS_TABLE;

/**
 * POST /login { "name": "Jordan", "password": "secret" }
 *
 * Accept a simple password for a friend group. The password is hashed
 * with a per-user salt before being stored in DynamoDB.
 */
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const name = (body.name || '').trim();
    const password = (body.password || '').trim();

    if (!name) return badRequest('name is required');
    if (!password) return badRequest('password is required');

    const { Item: existing } = await doc.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { name } })
    );

    if (existing) {
      const passwordMatches = verifyPassword(password, existing.passwordHash, existing.passwordSalt);
      if (!passwordMatches) return badRequest('invalid password');

      const user = {
        ...existing,
        passwordHash: undefined,
        passwordSalt: undefined,
      };
      return ok(user);
    }

    const { hash, salt } = hashPassword(password);
    const user = {
      name,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };

    await doc.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));

    const safeUser = {
      name,
      createdAt: user.createdAt,
    };

    return ok(safeUser);
  } catch (err) {
    return serverError(err);
  }
};
