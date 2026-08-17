const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, serverError } = require('../lib/http');
const { getCurrentWeekId, clampWeekId } = require('../lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;

/**
 * GET /games/current -> this week's 10 selected games
 * GET /games/{weekId} -> games for the specified week
 */
exports.handler = async (event) => {
  try {
    const requestedWeek = event && event.pathParameters && event.pathParameters.weekId;
    const weekId = requestedWeek ? clampWeekId(requestedWeek) : getCurrentWeekId();

    const { Items = [] } = await doc.send(
      new QueryCommand({
        TableName: GAMES_TABLE,
        KeyConditionExpression: 'weekId = :w',
        ExpressionAttributeValues: { ':w': weekId },
      })
    );

    Items.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return ok({ weekId, games: Items });
  } catch (err) {
    return serverError(err);
  }
};
