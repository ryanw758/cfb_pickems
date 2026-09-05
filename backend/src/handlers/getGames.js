const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, serverError } = require('../lib/http');
const { getCurrentWeekId, clampWeekId } = require('../lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const PICKS_TABLE = process.env.PICKS_TABLE;

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

    const { Items: picks = [] } = await doc.send(
      new QueryCommand({
        TableName: PICKS_TABLE,
        IndexName: 'byWeek',
        KeyConditionExpression: 'weekId = :w',
        ExpressionAttributeValues: { ':w': weekId },
      })
    );
    const accuracyByGame = new Map();

    for (const pick of picks) {
      if (pick.correct === null || pick.correct === undefined) continue;
      const accuracy = accuracyByGame.get(pick.gameId) || { correct: 0, total: 0 };
      accuracy.total += 1;
      if (pick.correct) accuracy.correct += 1;
      accuracyByGame.set(pick.gameId, accuracy);
    }

    for (const game of Items) {
      const accuracy = accuracyByGame.get(game.gameId);
      if (accuracy) game.pickAccuracy = accuracy;
    }

    Items.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return ok({ weekId, games: Items });
  } catch (err) {
    return serverError(err);
  }
};
