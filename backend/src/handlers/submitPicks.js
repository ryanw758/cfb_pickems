const { QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, badRequest, serverError } = require('../lib/http');
const { getCurrentWeekId, isGameLocked } = require('../lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const PICKS_TABLE = process.env.PICKS_TABLE;

/**
 * POST /picks
 * {
 *   "userName": "Jordan",
 *   "picks": [
 *     { "gameId": "401628123", "pickedSide": "home" },
 *     ...
 *   ]
 * }
 *
 * Overwrites any existing picks for this user/week (so re-submitting
 * before kickoff just replaces the previous picks).
 *
 * TODO: reject/ignore picks for games that have already started, once
 * you decide the lock-picks-at-kickoff rule.
 */
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const userName = (body.userName || '').trim();
    const picks = Array.isArray(body.picks) ? body.picks : [];

    if (!userName) return badRequest('userName is required');
    if (picks.length === 0) return badRequest('picks must be a non-empty array');

    const weekId = getCurrentWeekId();

    const { Items: weekGames = [] } = await doc.send(
      new QueryCommand({
        TableName: GAMES_TABLE,
        KeyConditionExpression: 'weekId = :w',
        ExpressionAttributeValues: { ':w': weekId },
      })
    );
    const validGameIds = new Set(weekGames.map((g) => g.gameId));

    for (const pick of picks) {
      if (!validGameIds.has(pick.gameId)) {
        return badRequest(`gameId ${pick.gameId} is not part of week ${weekId}`);
      }
      if (pick.pickedSide !== 'home' && pick.pickedSide !== 'away') {
        return badRequest(`pickedSide must be "home" or "away" (game ${pick.gameId})`);
      }

      const game = weekGames.find((item) => item.gameId === pick.gameId);
      if (game && isGameLocked(game.startTime)) {
        return badRequest(`picks for game ${pick.gameId} are locked at kickoff`);
      }
    }

    const weekUser = `${weekId}#${userName}`;

    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [PICKS_TABLE]: picks.map((pick) => ({
            PutRequest: {
              Item: {
                weekUser,
                gameId: pick.gameId,
                weekId,
                userName,
                pickedSide: pick.pickedSide,
                correct: null, // graded on Sunday night
                submittedAt: new Date().toISOString(),
              },
            },
          })),
        },
      })
    );

    return ok({ weekId, userName, saved: picks.length });
  } catch (err) {
    return serverError(err);
  }
};
