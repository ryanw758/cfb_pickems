const { BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { fetchWeekGamesWithSpreads } = require('../lib/espnClient');
const { getCurrentWeekId, getWeekEspnDateRange } = require('../lib/week');

const GAMES_TABLE = process.env.GAMES_TABLE;
const ESPN_GROUP_ID = process.env.ESPN_GROUP_ID || '80';
const NUM_GAMES_PER_WEEK = Number(process.env.NUM_GAMES_PER_WEEK || 10);

/**
 * Runs every Monday morning. Pulls this week's (Mon-Sun) FBS games,
 * picks the NUM_GAMES_PER_WEEK games with the smallest point spreads
 * (i.e. the closest / most competitive games), and stores them.
 */
exports.handler = async () => {
  const weekId = getCurrentWeekId();
  const { start, end } = getWeekEspnDateRange(weekId);

  const games = await fetchWeekGamesWithSpreads({ start, end, groupId: ESPN_GROUP_ID });

  if (games.length === 0) {
    console.warn(`No games with spreads found for week ${weekId} (${start}-${end})`);
    return { weekId, selected: 0 };
  }

  // "Relatively close point spread" = smallest |spread| first.
  const closest = [...games]
    .sort((a, b) => Math.abs(a.spread) - Math.abs(b.spread))
    .slice(0, NUM_GAMES_PER_WEEK);

  // DynamoDB BatchWrite caps at 25 items per call; 10 is safely under that,
  // but chunk anyway in case NUM_GAMES_PER_WEEK is raised later.
  const chunks = [];
  for (let i = 0; i < closest.length; i += 25) chunks.push(closest.slice(i, i + 25));

  for (const chunk of chunks) {
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [GAMES_TABLE]: chunk.map((game) => ({
            PutRequest: {
              Item: {
                weekId,
                gameId: game.gameId,
                ...game,
              },
            },
          })),
        },
      })
    );
  }

  console.log(`Stored ${closest.length} games for week ${weekId}`);
  return { weekId, selected: closest.length };
};
