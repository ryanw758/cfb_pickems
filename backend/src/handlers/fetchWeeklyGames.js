const { BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { fetchWeekGamesWithSpreads, selectWeeklyGames } = require('../lib/espnClient');
const { getCurrentWeekId, getWeekEspnDateRange, isSeasonStarted } = require('../lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const ESPN_GROUP_ID = process.env.ESPN_GROUP_ID || '80';
const NUM_GAMES_PER_WEEK = Number(process.env.NUM_GAMES_PER_WEEK || 10);
const FAVORITE_TEAM_SPREAD_THRESHOLD = 14;
const TOP_25_SPREAD_THRESHOLD = 10;
const MAX_BONUS_GAMES = 5;

async function getFavoriteTeams() {
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

function isFavoriteTeamGame(game, favoriteTeamIds) {
  return (
    (favoriteTeamIds.has(game.homeTeam.id) || favoriteTeamIds.has(game.awayTeam.id))
    && game.spread !== null
    && Math.abs(game.spread) <= FAVORITE_TEAM_SPREAD_THRESHOLD
  );
}

function isTop25Game(game) {
  return (
    (game.homeTeam.rank !== null || game.awayTeam.rank !== null)
    && game.spread !== null
    && Math.abs(game.spread) <= TOP_25_SPREAD_THRESHOLD
  );
}

function sortBySpread(games) {
  return [...games].sort((a, b) => {
    if (a.spread === null && b.spread !== null) return 1;
    if (a.spread !== null && b.spread === null) return -1;
    if (a.spread === null && b.spread === null) return 0;
    return Math.abs(a.spread) - Math.abs(b.spread);
  });
}

/**
 * Runs every Wednesday morning. Pulls this week's (Wed-Tue) FBS games,
 * selects up to NUM_GAMES_PER_WEEK games using priority-based logic:
 *
 *   1. Favorite-team games (spread at or under 14) — up to MAX_BONUS_GAMES
 *   2. Top-25 games (spread at or under 10)
 *   3. Remaining slots filled by smallest-spread games
 *
 * Only favorite-team games are used as bonus games; the rest fill to 10.
 */
exports.handler = async () => {
  if (!isSeasonStarted()) {
    console.log('Season has not started; skipping weekly game fetch.');
    return { selected: 0, skipped: true };
  }

  const weekId = getCurrentWeekId();
  const { start, end } = getWeekEspnDateRange(weekId);

  const [games, favoriteTeams] = await Promise.all([
    fetchWeekGamesWithSpreads({ start, end, groupId: ESPN_GROUP_ID }),
    getFavoriteTeams(),
  ]);

  if (games.length === 0) {
    console.warn(`No games found for week ${weekId} (${start}-${end})`);
    return { weekId, selected: 0 };
  }

  const selected = [];
  const selectedIds = new Set();

  const addGame = (game) => {
    if (selected.length >= NUM_GAMES_PER_WEEK) return;
    if (selectedIds.has(game.gameId)) return;
    selected.push(game);
    selectedIds.add(game.gameId);
  };

  // Priority 1: Favorite-team games (spread <= 14), up to MAX_BONUS_GAMES
  const favoriteGames = sortBySpread(games.filter((g) => isFavoriteTeamGame(g, favoriteTeams)));
  let favoriteCount = 0;
  for (const game of favoriteGames) {
    if (favoriteCount >= MAX_BONUS_GAMES) break;
    addGame(game);
    favoriteCount += 1;
  }

  // Priority 2: Top-25 games (spread <= 10)
  const top25Games = sortBySpread(games.filter((g) => isTop25Game(g)));
  for (const game of top25Games) {
    addGame(game);
  }

  // Priority 3: Fill remaining slots with smallest-spread games
  const remainingGames = sortBySpread(games);
  for (const game of remainingGames) {
    addGame(game);
  }

  console.log(`Week ${weekId}: ${selected.length} games selected (${favoriteCount} favorite-team bonus)`);

  // DynamoDB BatchWrite caps at 25 items per call
  const chunks = [];
  for (let i = 0; i < selected.length; i += 25) chunks.push(selected.slice(i, i + 25));

  for (const chunk of chunks) {
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [GAMES_TABLE]: chunk.map((game) => ({
            PutRequest: {
              Item: { weekId, gameId: game.gameId, ...game },
            },
          })),
        },
      })
    );
  }

  console.log(`Stored ${selected.length} games for week ${weekId}`);
  return { weekId, selected: selected.length, favoriteBonus: favoriteCount };
};
