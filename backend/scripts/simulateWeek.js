#!/usr/bin/env node
const { BatchWriteCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../src/lib/dynamo');
const { fetchWeekGamesWithSpreads, fetchScoreboard, parseEvent } = require('../src/lib/espnClient');
const { getWeekEspnDateRange } = require('../src/lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const PICKS_TABLE = process.env.PICKS_TABLE;
const ESPN_GROUP_ID = process.env.ESPN_GROUP_ID || '80';
const NUM_GAMES_PER_WEEK = Number(process.env.NUM_GAMES_PER_WEEK || 10);

async function fetchWeek(weekId) {
  const { start, end } = getWeekEspnDateRange(weekId);
  console.log(`Fetching games for week ${weekId} (${start} -> ${end})`);
  const games = await fetchWeekGamesWithSpreads({ start, end, groupId: ESPN_GROUP_ID });
  if (!games || games.length === 0) {
    console.warn('No games returned from ESPN for that week');
    return { weekId, selected: 0 };
  }

  const closest = [...games]
    .sort((a, b) => Math.abs(a.spread) - Math.abs(b.spread))
    .slice(0, NUM_GAMES_PER_WEEK);

  const chunks = [];
  for (let i = 0; i < closest.length; i += 25) chunks.push(closest.slice(i, i + 25));

  for (const chunk of chunks) {
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [GAMES_TABLE]: chunk.map((game) => ({
            PutRequest: { Item: { weekId, gameId: game.gameId, ...game } },
          })),
        },
      })
    );
  }
  console.log(`Stored ${closest.length} games for week ${weekId}`);
  return { weekId, selected: closest.length };
}

async function gradeWeek(weekId) {
  console.log(`Grading picks for week ${weekId}`);
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

  const { start, end } = getWeekEspnDateRange(weekId);
  const events = await fetchScoreboard({ start, end });
  const finalById = new Map(events.map(parseEvent).filter(Boolean).map((g) => [g.gameId, g]));

  const winners = new Map();
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
      winners.set(game.gameId, null);
    } else {
      winners.set(game.gameId, latest.homeScore > latest.awayScore ? 'home' : 'away');
    }
  }

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
    if (!winners.has(pick.gameId)) continue;
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
}

async function main() {
  const [, , weekIdArg, action = 'both'] = process.argv;
  if (!weekIdArg) {
    console.error('Usage: node simulateWeek.js <weekId YYYY-MM-DD> [fetch|grade|both]');
    process.exit(1);
  }
  const weekId = weekIdArg;

  try {
    if (action === 'fetch' || action === 'both') await fetchWeek(weekId);
    if (action === 'grade' || action === 'both') await gradeWeek(weekId);
    console.log('Done.');
  } catch (err) {
    console.error('Error during simulation:', err);
    process.exit(2);
  }
}

main();
