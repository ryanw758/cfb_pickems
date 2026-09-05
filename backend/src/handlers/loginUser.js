const { GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, badRequest, serverError } = require('../lib/http');
const { hashPassword, verifyPassword } = require('../lib/password');

const USERS_TABLE = process.env.USERS_TABLE;

/**
 * POST /login { "name": "Jordan", "password": "secret", "favoriteTeam": "Texas" }
 *
 * Accept a simple password for a friend group. The password is hashed
 * with a per-user salt before being stored in DynamoDB.
 *
 * favoriteTeam is required when creating a new user, optional on
 * subsequent logins (send it to update the pick).
 */
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const name = (body.name || '').trim();
    const password = (body.password || '').trim();
    const favoriteTeam = (body.favoriteTeam || '').trim();

    if (!name) return badRequest('Username is required');
    if (!password) return badRequest('Password is required');

    const { Item: existing } = await doc.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { name } })
    );

    if (existing) {
      const passwordMatches = verifyPassword(password, existing.passwordHash, existing.passwordSalt);
      if (!passwordMatches) return badRequest('Incorrect password');

      // Allow updating favorite team on an existing account; otherwise keep it.
      let user = existing;
      if (favoriteTeam && favoriteTeam !== existing.favoriteTeam) {
        user = { ...existing, favoriteTeam };
        await doc.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));
      }

      const safeUser = {
        name: user.name,
        favoriteTeam: user.favoriteTeam,
        createdAt: user.createdAt,
      };
      return ok(safeUser);
    }

    const { hash, salt } = hashPassword(password);
    const user = {
      name,
      passwordHash: hash,
      passwordSalt: salt,
      favoriteTeam,
      createdAt: new Date().toISOString(),
    };

    await doc.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));

    const safeUser = {
      name,
      favoriteTeam,
      createdAt: user.createdAt,
    };

    return ok(safeUser);
  } catch (err) {
    return serverError(err);
  }
};