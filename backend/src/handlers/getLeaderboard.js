const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { doc } = require('../lib/dynamo');
const { ok, serverError } = require('../lib/http');

const PICKS_TABLE = process.env.PICKS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

/**
 * GET /leaderboard -> season-long standings, aggregated from every graded pick.
 *
 * Users without graded picks still appear with a 0 score so the scoreboard
 * remains visible before any week is finalized.
 */
exports.handler = async () => {
  try {
    const users = new Map();
    let ExclusiveStartKey;
    do {
      const res = await doc.send(new ScanCommand({ TableName: USERS_TABLE, ExclusiveStartKey }));
      for (const user of res.Items || []) {
        const userName = user.name || user.userName;
        if (!userName) continue;
        users.set(userName, { userName, total: 0, weeks: new Map() });
      }
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const standings = new Map();
    const weekSet = new Set();

    let picksExclusiveStartKey;
    do {
      const res = await doc.send(
        new ScanCommand({ TableName: PICKS_TABLE, ExclusiveStartKey: picksExclusiveStartKey })
      );

      for (const pick of res.Items || []) {
        if (pick.correct === null || pick.correct === undefined) continue;

        weekSet.add(pick.weekId);

        const entry = standings.get(pick.userName) || {
          userName: pick.userName,
          total: 0,
          weeks: new Map(),
        };

        entry.total += pick.correct ? 1 : 0;

        const weekEntry = entry.weeks.get(pick.weekId) || { correct: 0, total: 0 };
        weekEntry.total += 1;
        if (pick.correct) weekEntry.correct += 1;
        entry.weeks.set(pick.weekId, weekEntry);

        standings.set(pick.userName, entry);
      }

      picksExclusiveStartKey = res.LastEvaluatedKey;
    } while (picksExclusiveStartKey);

    for (const [userName, entry] of standings.entries()) {
      if (!users.has(userName)) {
        users.set(userName, { userName, total: 0, weeks: new Map() });
      }

      const current = users.get(userName);
      current.total = entry.total;
      for (const [weekId, weekEntry] of entry.weeks.entries()) {
        current.weeks.set(weekId, { correct: weekEntry.correct, total: weekEntry.total });
      }
    }

    const weeks = [...weekSet].sort();

    const leaderboard = [...users.values()]
      .map((entry) => {
        const weeklyScores = {};
        for (const weekId of weeks) {
          const weekData = entry.weeks.get(weekId);
          weeklyScores[weekId] = weekData ? weekData.correct : 0;
        }

        return {
          userName: entry.userName,
          total: entry.total,
          weeks: weeklyScores,
          winPct: weeks.length ? entry.total / Math.max(1, weeks.reduce((sum, weekId) => sum + (entry.weeks.get(weekId)?.total || 0), 0)) : 0,
        };
      })
      .sort((a, b) => b.total - a.total || b.winPct - a.winPct);

    return ok({ leaderboard, weeks });
  } catch (err) {
    return serverError(err);
  }
};
