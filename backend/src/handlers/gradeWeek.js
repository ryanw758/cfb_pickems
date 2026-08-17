const { QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { fetchScoreboard, parseEvent } = require('../lib/espnClient');
const { getCurrentWeekId, getWeekEspnDateRange } = require('../lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const PICKS_TABLE = process.env.PICKS_TABLE;

/**
 * Runs Sunday night. For the current week:
 *  1. Re-fetches final scores from ESPN and updates the Games table.
 *  2. Determines each game's winner.
 *  3. Marks every stored pick correct/incorrect.
 *
 * NOTE: if your schedule has games that finish Monday night, consider
 * moving this to Tuesday morning, or running it twice (Sun night + Mon
 * night) -- it's safe to re-run since it just overwrites results.
 */
exports.handler = async () => {
  const weekId = getCurrentWeekId();

  // --- 1. Get this week's stored games ---
  const { Items: storedGames = [] } = await doc.send(
    new QueryCommand({
      TableName: GAMES_TABLE,
      KeyConditionExpression: 'weekId = :w',
      ExpressionAttributeValues: { ':w': weekId },
    })
  );

  if (storedGames.length === 0) {
    console.warn(`No games stored for week ${weekId}; nothing to grade.`);
    return { weekId, graded: 0 };
  }

  // --- 2. Refresh final scores from ESPN ---
  const { start, end } = getWeekEspnDateRange(weekId);
  const events = await fetchScoreboard({ start, end });
  const finalById = new Map(events.map(parseEvent).filter(Boolean).map((g) => [g.gameId, g]));

  const winners = new Map(); // gameId -> 'home' | 'away' | null (not final / tie)

  for (const game of storedGames) {
    const latest = finalById.get(game.gameId);
    if (!latest || !latest.completed) {
      console.warn(`Game ${game.gameId} (${game.shortName}) is not final yet; skipping.`);
      continue;
    }

    await doc.send(
      new UpdateCommand({
        TableName: GAMES_TABLE,
        Key: { weekId, gameId: game.gameId },
        UpdateExpression: 'SET homeScore = :hs, awayScore = :as_, #st = :st, completed = :c',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':hs': latest.homeScore,
          ':as_': latest.awayScore,
          ':st': latest.status,
          ':c': true,
        },
      })
    );

    if (latest.homeScore === latest.awayScore) {
      winners.set(game.gameId, null); // tie -- TODO: decide how ties should be scored
    } else {
      winners.set(game.gameId, latest.homeScore > latest.awayScore ? 'home' : 'away');
    }
  }

  // --- 3. Grade every pick made this week ---
  const { Items: picks = [] } = await doc.send(
    new QueryCommand({
      TableName: PICKS_TABLE,
      IndexName: 'byWeek',
      KeyConditionExpression: 'weekId = :w',
      ExpressionAttributeValues: { ':w': weekId },
    })
  );

  let graded = 0;
  for (const pick of picks) {
    if (!winners.has(pick.gameId)) continue; // game not final -- leave pick ungraded
    const winner = winners.get(pick.gameId);
    const correct = winner !== null && pick.pickedSide === winner;

    await doc.send(
      new UpdateCommand({
        TableName: PICKS_TABLE,
        Key: { weekUser: pick.weekUser, gameId: pick.gameId },
        UpdateExpression: 'SET correct = :c',
        ExpressionAttributeValues: { ':c': correct },
      })
    );
    graded += 1;
  }

  console.log(`Graded ${graded} picks for week ${weekId}`);
  return { weekId, graded };
};
