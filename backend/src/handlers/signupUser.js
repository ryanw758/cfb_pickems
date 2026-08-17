const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, badRequest, serverError } = require('../lib/http');
const { hashPassword } = require('../lib/password');

const USERS_TABLE = process.env.USERS_TABLE;

/**
 * POST /signup { "name": "Jordan", "password": "secret" }
 *
 * Creates a new user with a hashed password, or rejects duplicates.
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
      return badRequest('user already exists');
    }

    const { hash, salt } = hashPassword(password);
    const user = {
      name,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };

    await doc.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));

    return ok({ name, createdAt: user.createdAt });
  } catch (err) {
    return serverError(err);
  }
};
