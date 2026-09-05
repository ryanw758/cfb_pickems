#!/usr/bin/env node
require('dotenv').config();

const { BatchWriteCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../src/lib/dynamo');
const { fetchWeekGamesWithSpreads, fetchScoreboard, parseEvent, selectWeeklyGames } = require('../src/lib/espnClient');
const { getWeekEspnDateRange } = require('../src/lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const PICKS_TABLE = process.env.PICKS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const ESPN_GROUP_ID = process.env.ESPN_GROUP_ID || '80';
const NUM_GAMES_PER_WEEK = Number(process.env.NUM_GAMES_PER_WEEK || 10);
const FAVORITE_TEAM_SPREAD_THRESHOLD = 15;
const MAX_BONUS_GAMES = 5;

async function getFavoriteTeamIds() {
  const ids = new Set();
  let ExclusiveStartKey;
  do {
    const res = await doc.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: 'favoriteTeamId',
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) {
      if (item.favoriteTeamId) ids.add(String(item.favoriteTeamId));
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return ids;
}

async function fetchWeek(weekId) {
  const { start, end } = getWeekEspnDateRange(weekId);
  console.log(`Fetching games for week ${weekId} (${start} -> ${end})`);
  const [games, favoriteTeamIds] = await Promise.all([
    fetchWeekGamesWithSpreads({ start, end, groupId: ESPN_GROUP_ID }),
    getFavoriteTeamIds(),
  ]);

  if (!games || games.length === 0) {
    console.warn('No games returned from ESPN for that week');
    return { weekId, selected: 0 };
  }

  const base = selectWeeklyGames(games, NUM_GAMES_PER_WEEK);
  const baseIds = new Set(base.map((g) => g.gameId));

  const bonusGames = favoriteTeamIds.size > 0
    ? games
        .filter((g) => {
          if (baseIds.has(g.gameId)) return false;
          const hasFav = favoriteTeamIds.has(g.homeTeam.id) || favoriteTeamIds.has(g.awayTeam.id);
          const withinSpread = g.spread === null || Math.abs(g.spread) <= FAVORITE_TEAM_SPREAD_THRESHOLD;
          return hasFav && withinSpread;
        })
        .sort((a, b) => {
          if (a.spread === null && b.spread !== null) return 1;
          if (a.spread !== null && b.spread === null) return -1;
          if (a.spread === null && b.spread === null) return 0;
          return Math.abs(a.spread) - Math.abs(b.spread);
        })
        .slice(0, MAX_BONUS_GAMES)
    : [];

  const selected = [...base, ...bonusGames];
  console.log(`${base.length} base games + ${bonusGames.length} bonus games = ${selected.length} total`);
  if (favoriteTeamIds.size > 0) console.log('Favorite team IDs:', [...favoriteTeamIds]);

  const chunks = [];
  for (let i = 0; i < selected.length; i += 25) chunks.push(selected.slice(i, i + 25));

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
  console.log(`Stored ${selected.length} games for week ${weekId}`);
  return { weekId, selected: selected.length, bonus: bonusGames.length };
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
