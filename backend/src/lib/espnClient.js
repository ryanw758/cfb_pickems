/**
 * Thin client around ESPN's public (unofficial, undocumented) college
 * football endpoints. No API key required, but these endpoints can change
 * without notice -- keep an eye on them if games stop showing up.
 */

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
const SUMMARY_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary';

/**
 * Fetch every FBS game scheduled between `start` and `end` (YYYYMMDD strings).
 * ESPN groups its scoreboard by week automatically, but passing an explicit
 * date range keeps this correct even around bye weeks / bowl season.
 */
async function fetchScoreboard({ start, end, groupId = '80' }) {
  const url = `${SCOREBOARD_URL}?dates=${start}-${end}&groups=${groupId}&limit=200`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.events || [];
}

/**
 * The scoreboard payload sometimes includes odds inline; when it doesn't,
 * fall back to the per-game summary endpoint's "pickcenter" odds.
 */
async function fetchSpreadForEvent(eventId) {
  const res = await fetch(`${SUMMARY_URL}?event=${eventId}`);
  if (!res.ok) return null;
  const data = await res.json();
  const pick = (data.pickcenter && data.pickcenter[0]) || null;
  if (!pick || typeof pick.spread !== 'number') return null;
  return pick.spread;
}

function parseTeamRank(competitor) {
  const rawRank = competitor.rank ?? competitor.curatedRank?.current ?? competitor.team?.rank;
  const rank = Number(rawRank);
  return Number.isInteger(rank) && rank >= 1 && rank <= 25 ? rank : null;
}

function parseTeamColor(color) {
  return typeof color === 'string' && /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : null;
}

/** Normalizes a raw ESPN scoreboard event into the shape we store. */
function parseEvent(event) {
  const competition = event.competitions && event.competitions[0];
  if (!competition) return null;

  const home = competition.competitors.find((c) => c.homeAway === 'home');
  const away = competition.competitors.find((c) => c.homeAway === 'away');
  if (!home || !away) return null;

  const inlineOdds = competition.odds && competition.odds[0];

  return {
    gameId: event.id,
    startTime: event.date,
    shortName: event.shortName, // e.g. "TEX @ OU"
    venue: competition.venue?.fullName || null,
    neutralSite: Boolean(competition.neutralSite),
    homeTeam: {
      id: home.team.id,
      name: home.team.displayName,
      abbreviation: home.team.abbreviation,
      logo: home.team.logo,
      rank: parseTeamRank(home),
      color: parseTeamColor(home.team.color),
    },
    awayTeam: {
      id: away.team.id,
      name: away.team.displayName,
      abbreviation: away.team.abbreviation,
      logo: away.team.logo,
      rank: parseTeamRank(away),
      color: parseTeamColor(away.team.color),
    },
    // Positive spread favors home team is ESPN convention-dependent; we
    // just store the magnitude for "closeness" and the human-readable
    // details string (e.g. "OU -3.5") for display.
    spread: inlineOdds && typeof inlineOdds.spread === 'number' ? inlineOdds.spread : null,
    spreadDetails: inlineOdds ? inlineOdds.details : null,
    status: competition.status.type.name, // e.g. STATUS_SCHEDULED, STATUS_FINAL
    statusState: competition.status.type.state,
    statusDetail: competition.status.type.shortDetail || competition.status.type.detail,
    period: Number.isInteger(competition.status.period) ? competition.status.period : null,
    displayClock: competition.status.displayClock || null,
    completed: Boolean(competition.status.type.completed),
    homeScore: home.score !== undefined ? Number(home.score) : null,
    awayScore: away.score !== undefined ? Number(away.score) : null,
  };
}

/**
 * Fetches the full week's slate, normalizes it, and backfills any missing
 * spreads via the summary endpoint. Games without a usable spread are still
 * returned so callers can use them to fill the weekly game limit.
 */
async function fetchWeekGamesWithSpreads({ start, end, groupId }) {
  const events = await fetchScoreboard({ start, end, groupId });
  const games = events.map(parseEvent).filter(Boolean);

  const withSpreads = await Promise.all(
    games.map(async (game) => {
      if (game.spread === null) {
        // TODO: this fires one request per game missing inline odds --
        // fine for a weekly cron, but add a concurrency limit if ESPN
        // starts rate-limiting.
        game.spread = await fetchSpreadForEvent(game.gameId);
      }
      return game;
    })
  );

  return withSpreads;
}

function selectWeeklyGames(games, limit) {
  return [...games]
    .sort((a, b) => {
      if (a.spread === null && b.spread !== null) return 1;
      if (a.spread !== null && b.spread === null) return -1;
      if (a.spread === null && b.spread === null) return 0;
      return Math.abs(a.spread) - Math.abs(b.spread);
    })
    .slice(0, limit);
}

module.exports = {
  fetchScoreboard,
  fetchSpreadForEvent,
  parseEvent,
  fetchWeekGamesWithSpreads,
  selectWeeklyGames,
};
