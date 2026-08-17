/**
 * The pick'em "week" runs Monday -> Sunday. weekId is the ISO date
 * (YYYY-MM-DD) of that week's Monday, e.g. "2026-09-07".
 *
 * Season weeks are indexed from 0, starting on the configured SEASON_START_DATE.
 * For example, if the season starts on 2026-08-30, then:
 * - 2026-08-30 -> week index 0
 * - 2026-09-06 -> week index 1
 */

const SEASON_START_DATE = process.env.SEASON_START_DATE || '2026-08-30';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Monday at 00:00 UTC of the week containing `date` (defaults to now). */
function mondayOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

function getSeasonStartDate() {
  return mondayOf(new Date(`${SEASON_START_DATE}T00:00:00Z`));
}

function getSeasonStartWeek() {
  return mondayOf(getSeasonStartDate());
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
  return toIsoDate(mondayOf(requestedWeek));
}

function getCurrentWeekId(date = new Date()) {
  if (!isSeasonStarted(date)) {
    return toIsoDate(getSeasonStartWeek());
  }

  const seasonWeekIndex = getSeasonWeekIndex(date);
  const weekStart = new Date(getSeasonStartWeek().getTime() + seasonWeekIndex * 7 * MILLISECONDS_PER_DAY);
  return toIsoDate(mondayOf(weekStart));
}

function isGameLocked(startTimeIso) {
  if (!startTimeIso) return false;
  const startTime = new Date(startTimeIso);
  if (Number.isNaN(startTime.getTime())) return false;
  return Date.now() >= startTime.getTime();
}

/** Returns { start, end } as YYYYMMDD strings for the ESPN scoreboard `dates` param. */
function getWeekEspnDateRange(weekId) {
  const monday = new Date(`${weekId}T00:00:00Z`);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  return { start: fmt(monday), end: fmt(sunday) };
}

module.exports = {
  toIsoDate,
  mondayOf,
  getSeasonStartDate,
  isSeasonStarted,
  getSeasonWeekIndex,
  getCurrentWeekId,
  clampWeekId,
  isGameLocked,
  getWeekEspnDateRange,
};
