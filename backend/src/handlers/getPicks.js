const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, badRequest, serverError } = require('../lib/http');

const PICKS_TABLE = process.env.PICKS_TABLE;

/** GET /picks/{weekId}/{userName} */
exports.handler = async (event) => {
  try {
    const { weekId, userName } = event.pathParameters || {};
    if (!weekId || !userName) return badRequest('weekId and userName are required');

    const weekUser = `${weekId}#${userName}`;

    const { Items = [] } = await doc.send(
      new QueryCommand({
        TableName: PICKS_TABLE,
        KeyConditionExpression: 'weekUser = :wu',
        ExpressionAttributeValues: { ':wu': weekUser },
      })
    );

    return ok({ weekId, userName, picks: Items });
  } catch (err) {
    return serverError(err);
  }
};
