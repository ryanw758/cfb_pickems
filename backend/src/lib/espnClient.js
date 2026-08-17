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
    homeTeam: {
      id: home.team.id,
      name: home.team.displayName,
      abbreviation: home.team.abbreviation,
      logo: home.team.logo,
    },
    awayTeam: {
      id: away.team.id,
      name: away.team.displayName,
      abbreviation: away.team.abbreviation,
      logo: away.team.logo,
    },
    // Positive spread favors home team is ESPN convention-dependent; we
    // just store the magnitude for "closeness" and the human-readable
    // details string (e.g. "OU -3.5") for display.
    spread: inlineOdds && typeof inlineOdds.spread === 'number' ? inlineOdds.spread : null,
    spreadDetails: inlineOdds ? inlineOdds.details : null,
    status: competition.status.type.name, // e.g. STATUS_SCHEDULED, STATUS_FINAL
    completed: Boolean(competition.status.type.completed),
    homeScore: home.score !== undefined ? Number(home.score) : null,
    awayScore: away.score !== undefined ? Number(away.score) : null,
  };
}

/**
 * Fetches the full week's slate, normalizes it, and backfills any missing
 * spreads via the summary endpoint. Only games that have a usable spread
 * are returned, since spread is what we sort by.
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

  return withSpreads.filter((g) => g.spread !== null);
}

module.exports = { fetchScoreboard, fetchSpreadForEvent, parseEvent, fetchWeekGamesWithSpreads };
