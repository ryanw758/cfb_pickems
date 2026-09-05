const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const requestDetails = { path, options };
  console.log('[api request]', requestDetails);

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  console.log('[api response]', { path, status: res.status, data });

  if (!res.ok) {
    throw new Error(data.error || `Request to ${path} failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (name, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ name, password }) }),

  signup: (name, password, favoriteTeam, favoriteTeamId) =>
    request('/signup', { method: 'POST', body: JSON.stringify({ name, password, favoriteTeam, favoriteTeamId }) }),

  fetchFBSTeams: async () => {
    const CACHE_KEY = 'fbs_teams_cache_v3';
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed[0]?.conference) return parsed;
    }
    const conferences = await request('/teams');
    const valid = Array.isArray(conferences) ? conferences : [];
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(valid));
    return valid;
  },

  getCurrentWeekGames: () => request('/games/current'),
  getGamesByWeek: (weekId) => request(`/games/${encodeURIComponent(weekId)}`),

  submitPicks: (userName, weekId, picks) =>
    request('/picks', { method: 'POST', body: JSON.stringify({ userName, weekId, picks }) }),

  getPicks: (weekId, userName) =>
    request(`/picks/${encodeURIComponent(weekId)}/${encodeURIComponent(userName)}`),

  getLeaderboard: () => request('/leaderboard'),
};
