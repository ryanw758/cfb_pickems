const { QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { fetchScoreboard, parseEvent } = require('../lib/espnClient');
const { getCurrentWeekId, getWeekEspnDateRange } = require('../lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const PICKS_TABLE = process.env.PICKS_TABLE;

exports.handler = async () => {
  const weekId = getCurrentWeekId();
  const { Items: storedGames = [] } = await doc.send(
    new QueryCommand({
      TableName: GAMES_TABLE,
      KeyConditionExpression: 'weekId = :weekId',
      ExpressionAttributeValues: { ':weekId': weekId },
    })
  );

  if (storedGames.length === 0) return { weekId, refreshed: 0 };

  const { start, end } = getWeekEspnDateRange(weekId);
  const events = await fetchScoreboard({ start, end, groupId: process.env.ESPN_GROUP_ID || '80' });
  const gamesById = new Map(events.map(parseEvent).filter(Boolean).map((game) => [game.gameId, game]));
  const completedGameIds = new Set(
    [...gamesById.values()].filter((game) => game.completed).map((game) => game.gameId)
  );
  const picksByGame = new Map();

  if (completedGameIds.size > 0) {
    const { Items: picks = [] } = await doc.send(
      new QueryCommand({
        TableName: PICKS_TABLE,
        IndexName: 'byWeek',
        KeyConditionExpression: 'weekId = :weekId',
        ExpressionAttributeValues: { ':weekId': weekId },
      })
    );

    for (const pick of picks) {
      const gamePicks = picksByGame.get(pick.gameId) || [];
      gamePicks.push(pick);
      picksByGame.set(pick.gameId, gamePicks);
    }
  }

  const updatedAt = new Date().toISOString();
  let refreshed = 0;
  let graded = 0;

  for (const storedGame of storedGames) {
    const latestGame = gamesById.get(storedGame.gameId);
    if (!latestGame) continue;

    await doc.send(
      new UpdateCommand({
        TableName: GAMES_TABLE,
        Key: { weekId, gameId: storedGame.gameId },
        UpdateExpression:
          'SET homeScore = :homeScore, awayScore = :awayScore, homeTeam = :homeTeam, awayTeam = :awayTeam, venue = :venue, #status = :status, statusState = :statusState, statusDetail = :statusDetail, period = :period, displayClock = :displayClock, completed = :completed, liveUpdatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':homeScore': latestGame.homeScore,
          ':awayScore': latestGame.awayScore,
          ':homeTeam': latestGame.homeTeam,
          ':awayTeam': latestGame.awayTeam,
          ':venue': latestGame.venue,
          ':status': latestGame.status,
          ':statusState': latestGame.statusState || null,
          ':statusDetail': latestGame.statusDetail || null,
          ':period': latestGame.period,
          ':displayClock': latestGame.displayClock,
          ':completed': latestGame.completed,
          ':updatedAt': updatedAt,
        },
      })
    );
    refreshed += 1;

    if (!latestGame.completed) continue;

    const winner = latestGame.homeScore === latestGame.awayScore
      ? null
      : latestGame.homeScore > latestGame.awayScore
        ? 'home'
        : 'away';

    for (const pick of picksByGame.get(storedGame.gameId) || []) {
      await doc.send(
        new UpdateCommand({
          TableName: PICKS_TABLE,
          Key: { weekUser: pick.weekUser, gameId: pick.gameId },
          UpdateExpression: 'SET correct = :correct',
          ExpressionAttributeValues: {
            ':correct': winner !== null && pick.pickedSide === winner,
          },
        })
      );
      graded += 1;
    }
  }

  return { weekId, refreshed, graded };
};