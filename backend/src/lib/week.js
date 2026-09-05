/**
 * The pick'em "week" runs Wednesday -> Tuesday. weekId is the ISO date
 * (YYYY-MM-DD) of that week's Wednesday, e.g. "2026-09-09".
 *
 * Season weeks are indexed from 0, starting on the configured SEASON_START_DATE.
 * For example, if the season starts on 2026-08-30, then the first week
 * starts on Wednesday 2026-08-26.
 */

const SEASON_START_DATE = process.env.SEASON_START_DATE || '2026-08-30';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Wednesday at 00:00 UTC of the week containing `date` (defaults to now). */
function wednesdayOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday, 3 = Wednesday, ...
  const diffToWednesday = day >= 3 ? 3 - day : -4 - day;
  d.setUTCDate(d.getUTCDate() + diffToWednesday);
  return d;
}

function getSeasonStartDate() {
  return wednesdayOf(new Date(`${SEASON_START_DATE}T00:00:00Z`));
}

function getSeasonStartWeek() {
  return wednesdayOf(getSeasonStartDate());
}

function isSeasonStarted(date = new Date()) {
  return date.getTime() >= getSeasonStartDate().getTime();
}

function getSeasonWeekIndex(date = new Date()) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const seasonStartWeek = getSeasonStartWeek();

  if (target < seasonStartWeek) return -1;

  const diffDays = Math.floor((target.getTime() - seasonStartWeek.getTime()) / MILLISECONDS_PER_DAY);
  return Math.floor(diffDays / 7);
}

function clampWeekId(weekId) {
  const requestedWeek = new Date(`${weekId}T00:00:00Z`);
  const seasonStartWeek = getSeasonStartWeek();
  if (requestedWeek.getTime() < seasonStartWeek.getTime()) {
    return toIsoDate(seasonStartWeek);
  }
  return toIsoDate(wednesdayOf(requestedWeek));
}

function getCurrentWeekId(date = new Date()) {
  if (!isSeasonStarted(date)) {
    return toIsoDate(getSeasonStartWeek());
  }

  const seasonWeekIndex = getSeasonWeekIndex(date);
  const weekStart = new Date(getSeasonStartWeek().getTime() + seasonWeekIndex * 7 * MILLISECONDS_PER_DAY);
  return toIsoDate(wednesdayOf(weekStart));
}

function isGameLocked(startTimeIso) {
  if (!startTimeIso) return false;
  const startTime = new Date(startTimeIso);
  if (Number.isNaN(startTime.getTime())) return false;
  return Date.now() >= startTime.getTime();
}

/** Returns { start, end } as YYYYMMDD strings for the ESPN scoreboard `dates` param.
 *  Extends through the following Tuesday to capture Monday night games.
 */
function getWeekEspnDateRange(weekId) {
  const wednesday = new Date(`${weekId}T00:00:00Z`);
  const nextWednesday = new Date(wednesday);
  nextWednesday.setUTCDate(nextWednesday.getUTCDate() + 7); // Through following Tuesday (inclusive)

  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  return { start: fmt(wednesday), end: fmt(nextWednesday) };
}

module.exports = {
  toIsoDate,
  wednesdayOf,
  getSeasonStartDate,
  isSeasonStarted,
  getSeasonWeekIndex,
  getCurrentWeekId,
  clampWeekId,
  isGameLocked,
  getWeekEspnDateRange,
};
