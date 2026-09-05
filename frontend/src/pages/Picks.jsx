import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useUser } from '../context/UserContext.jsx';
import GameCard from '../components/GameCard.jsx';
import './Picks.css';

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const wednesdayOf = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diffToWednesday = day >= 3 ? 3 - day : -4 - day;
  d.setUTCDate(d.getUTCDate() + diffToWednesday);
  return d;
};

const addWeeks = (isoWeek, delta) => {
  const d = new Date(`${isoWeek}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return toIsoDate(d);
};

const seasonStartDate = new Date(`${import.meta.env.VITE_SEASON_START_DATE || '2026-08-26'}T00:00:00Z`);
const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
const maxVisibleWeek = Number(import.meta.env.VITE_NUM_WEEKS || 15);

const getWeekNumber = (weekId) => {
  const wednesday = wednesdayOf(new Date(`${weekId}T00:00:00Z`));
  return Math.floor((wednesday.getTime() - seasonStartDate.getTime()) / millisecondsPerWeek);
};

const getCurrentWeekNumber = (date = new Date()) => Math.max(0, getWeekNumber(toIsoDate(wednesdayOf(date))));

const getMaxAllowedWeek = (date = new Date()) => {
  const seasonStarted = date.getTime() >= seasonStartDate.getTime();
  return seasonStarted ? Math.min(maxVisibleWeek, getCurrentWeekNumber(date) + 1) : 0;
};

const FETCH_UTC_DAY = Number(import.meta.env.VITE_FETCH_UTC_DAY ?? 3);  // 3 = Wednesday
const FETCH_UTC_HOUR = Number(import.meta.env.VITE_FETCH_UTC_HOUR ?? 2); // 02:00 UTC = 9pm EDT

const getNextFetchTime = (now = new Date()) => {
  const nextFetch = new Date(now);
  const currentDay = nextFetch.getUTCDay();
  const daysToFetch = currentDay <= FETCH_UTC_DAY ? FETCH_UTC_DAY - currentDay : 7 - currentDay + FETCH_UTC_DAY;
  nextFetch.setUTCDate(nextFetch.getUTCDate() + daysToFetch);
  nextFetch.setUTCHours(FETCH_UTC_HOUR, 0, 0, 0);
  if (nextFetch <= now) nextFetch.setUTCDate(nextFetch.getUTCDate() + 7);
  const seasonFirstFetch = new Date(seasonStartDate);
  const seasonStartDay = seasonFirstFetch.getUTCDay();
  const seasonDaysToFetch = seasonStartDay <= FETCH_UTC_DAY
    ? FETCH_UTC_DAY - seasonStartDay
    : 7 - seasonStartDay + FETCH_UTC_DAY;
  seasonFirstFetch.setUTCDate(seasonFirstFetch.getUTCDate() + seasonDaysToFetch);
  seasonFirstFetch.setUTCHours(FETCH_UTC_HOUR, 0, 0, 0);
  return now < seasonFirstFetch ? seasonFirstFetch : nextFetch;
};

const formatCountdownTo = (targetTime, now = new Date()) => {
  const target = new Date(targetTime);
  if (Number.isNaN(target.getTime())) return 'Slate complete';
  const remaining = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}D ${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}M ${String(seconds).padStart(2, '0')}S`;
};

const formatCountdown = (now = new Date()) => formatCountdownTo(getNextFetchTime(now), now);

const formatWeekLabel = (weekId) => {
  if (!weekId) return null;
  return `Week ${getWeekNumber(weekId) + 1}`;
};

const formatRank = (rank) => {
  const suffix = rank % 100 >= 11 && rank % 100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th');
  return `${rank}${suffix}`;
};

const isKickoffLocked = (game) => {
  if (!game?.startTime) return false;
  const kickoff = new Date(game.startTime);
  if (Number.isNaN(kickoff.getTime())) return false;
  return Date.now() >= kickoff.getTime();
};

export default function Picks() {
  const { user } = useUser();
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [games, setGames] = useState([]);
  const [selections, setSelections] = useState({}); // gameId -> 'home' | 'away'
  const [results, setResults] = useState({}); // gameId -> { correct }
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [countdown, setCountdown] = useState(() => formatCountdown());
  const [nextKickoffCountdown, setNextKickoffCountdown] = useState('Slate complete');
  const [seasonStats, setSeasonStats] = useState(null);
  const [flipPhase, setFlipPhase] = useState('idle'); // idle | out | pre-in | in
  const [flipDirection, setFlipDirection] = useState('next'); // next | prev
  const loadRequestId = useRef(0);
  const saveTimeoutId = useRef(null);
  const touchStart = useRef(null);
  const weekCache = useRef({});
  const [currentWeekHasGames, setCurrentWeekHasGames] = useState(null); // null = unknown, true/false once checked
  const isFlipping = useRef(false);
  const nextGame = games.find((game) => !game.completed && new Date(game.startTime).getTime() > Date.now());

  const fetchWeekData = async (weekIdToLoad) => {
    const { weekId: resolvedWeekId, games: weekGames } = await api
      .getGamesByWeek(weekIdToLoad)
      .catch(() => ({ weekId: weekIdToLoad, games: [] }));

    const finalWeekId = resolvedWeekId || weekIdToLoad;
    const { picks } = await api.getPicks(finalWeekId, user.name).catch(() => ({ picks: [] }));

    const nextSelections = {};
    const nextResults = {};
    for (const pick of picks) {
      nextSelections[pick.gameId] = pick.pickedSide;
      if (pick.correct !== null && pick.correct !== undefined) {
        nextResults[pick.gameId] = { correct: pick.correct };
      }
    }

    return { weekId: finalWeekId, games: weekGames || [], selections: nextSelections, results: nextResults };
  };

  const applyWeekData = (data) => {
    setSelectedWeek(data.weekId);
    setGames(data.games);
    setSelections(data.selections);
    setResults(data.results);
  };

  // The date-based ceiling always allows one week of lookahead, but that lookahead
  // week should only be navigable once the current week's games have actually gone live.
  const computeEffectiveMaxAllowedWeek = () => {
    const dateBasedMax = getMaxAllowedWeek();
    const currentCalendarWeek = getCurrentWeekNumber();
    if (dateBasedMax <= currentCalendarWeek) return dateBasedMax;
    return currentWeekHasGames ? dateBasedMax : currentCalendarWeek;
  };

  useEffect(() => {
    let active = true;
    const currentCalendarWeek = getCurrentWeekNumber();
    const currentWeekId = addWeeks(toIsoDate(seasonStartDate), currentCalendarWeek);

    const cached = weekCache.current[currentWeekId];
    if (cached) {
      setCurrentWeekHasGames(cached.games.length > 0);
      return undefined;
    }

    fetchWeekData(currentWeekId)
      .then((data) => {
        if (!active) return;
        weekCache.current[data.weekId] = data;
        setCurrentWeekHasGames(data.games.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setCurrentWeekHasGames(false);
      });

    return () => {
      active = false;
    };
  }, [user.name]);

  const loadWeek = async (weekIdToLoad) => {
    const maxAllowedWeek = computeEffectiveMaxAllowedWeek();
    const requestedWeekNumber = getWeekNumber(weekIdToLoad);
    const clampedWeekNumber = Math.min(maxAllowedWeek, Math.max(0, requestedWeekNumber));
    const resolvedWeekToLoad = addWeeks(toIsoDate(seasonStartDate), clampedWeekNumber);
    const requestId = ++loadRequestId.current;
    localStorage.setItem('selectedWeek', resolvedWeekToLoad);
    setSelectedWeek(resolvedWeekToLoad);

    const cached = weekCache.current[resolvedWeekToLoad];
    if (cached) {
      applyWeekData(cached);
      setStatus('ready');

      // Refresh in the background in case anything changed since it was cached
      fetchWeekData(resolvedWeekToLoad)
        .then((data) => {
          if (requestId !== loadRequestId.current) return;
          weekCache.current[data.weekId] = data;
          applyWeekData(data);
        })
        .catch((err) => console.error('Failed to refresh cached week:', err));

      return;
    }

    setStatus('loading');

    try {
      const data = await fetchWeekData(resolvedWeekToLoad);
      if (requestId !== loadRequestId.current) return;

      weekCache.current[data.weekId] = data;
      applyWeekData(data);
      setStatus('ready');
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      console.error('Failed to load week:', err);
      setStatus('error');
    }
  };

  useEffect(() => {
    let active = true;
    const requestId = ++loadRequestId.current;

    (async () => {
      try {
        const storedWeek = localStorage.getItem('selectedWeek');
        const weekToLoad = storedWeek || (await api.getCurrentWeekGames()).weekId;
        if (!active || requestId !== loadRequestId.current) return;
        await loadWeek(weekToLoad);
      } catch (err) {
        if (!active || requestId !== loadRequestId.current) return;
        console.error('Failed to load initial week:', err);
        setStatus('error');
      }
    })();

    return () => {
      active = false;
      loadRequestId.current += 1;
    };
  }, [user.name]);

  // Prefetch every remaining week in the background so navigation reads from cache
  useEffect(() => {
    let active = true;
    const maxAllowedWeek = getMaxAllowedWeek();
    const seasonStartIso = toIsoDate(seasonStartDate);

    for (let weekNumber = 0; weekNumber <= maxAllowedWeek; weekNumber += 1) {
      const weekId = addWeeks(seasonStartIso, weekNumber);
      if (weekCache.current[weekId]) continue;

      fetchWeekData(weekId)
        .then((data) => {
          if (!active) return;
          weekCache.current[data.weekId] = data;
        })
        .catch((err) => console.error(`Failed to prefetch week ${weekNumber}:`, err));
    }

    return () => {
      active = false;
    };
  }, [user.name]);

  useEffect(() => {
    let active = true;

    api.getLeaderboard()
      .then(({ leaderboard }) => {
        if (!active) return;
        const rank = leaderboard.findIndex((entry) => entry.userName === user.name) + 1;
        const entry = leaderboard[rank - 1];
        setSeasonStats(entry ? { rank, total: entry.total, winPct: entry.winPct } : null);
      })
      .catch((err) => console.error('Failed to load season stats:', err));

    return () => {
      active = false;
    };
  }, [user.name]);

  const handlePick = (gameId, side) => {
    console.log('handlePick called:', gameId, side);
    setSelections((prev) => ({ ...prev, [gameId]: side }));
  };

  // Keep the cache in sync with whatever is currently on screen for this week
  useEffect(() => {
    if (!selectedWeek || status !== 'ready') return;
    weekCache.current[selectedWeek] = { weekId: selectedWeek, games, selections, results };
  }, [selectedWeek, status, games, selections, results]);

  // Auto-save picks with debouncing
  const pendingSave = useRef(null); // { selections, weekId, userName }

  const flushSave = async (saveSelections, weekId, userName) => {
    if (!saveSelections || !weekId || Object.keys(saveSelections).length === 0) return;
    try {
      const picks = Object.entries(saveSelections)
        .filter(([gameId]) => {
          const game = games.find((g) => g.gameId === gameId);
          return game && !isKickoffLocked(game);
        })
        .map(([gameId, pickedSide]) => ({ gameId, pickedSide }));
      if (picks.length === 0) return;
      await api.submitPicks(userName, weekId, picks);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save picks:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    if (status !== 'ready' || !selectedWeek || Object.keys(selections).length === 0) return;

    clearTimeout(saveTimeoutId.current);
    setSaveStatus('saving');
    pendingSave.current = { selections, weekId: selectedWeek, userName: user.name };

    saveTimeoutId.current = setTimeout(() => {
      pendingSave.current = null;
      flushSave(selections, selectedWeek, user.name);
    }, 500);

    return () => clearTimeout(saveTimeoutId.current);
  }, [selections, selectedWeek, status, user.name]);

  // Flush immediately when the app is backgrounded on mobile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!pendingSave.current) return;
      clearTimeout(saveTimeoutId.current);
      const { selections: s, weekId, userName } = pendingSave.current;
      pendingSave.current = null;
      flushSave(s, weekId, userName);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (games.length > 0) return undefined;
    const interval = setInterval(() => setCountdown(formatCountdown()), 1000);
    return () => clearInterval(interval);
  }, [games.length]);

  useEffect(() => {
    if (!nextGame) {
      setNextKickoffCountdown('Slate complete');
      return undefined;
    }

    const updateCountdown = () => setNextKickoffCountdown(formatCountdownTo(nextGame.startTime));
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextGame?.startTime]);

  useEffect(() => {
    if (!selectedWeek || selectedWeek !== toIsoDate(wednesdayOf(new Date()))) return undefined;

    const refreshLiveGames = async () => {
      try {
        const [{ games: latestGames }, { picks }] = await Promise.all([
          api.getGamesByWeek(selectedWeek),
          api.getPicks(selectedWeek, user.name),
        ]);
        setGames(latestGames || []);

        const latestResults = {};
        for (const pick of picks || []) {
          if (pick.correct !== null && pick.correct !== undefined) {
            latestResults[pick.gameId] = { correct: pick.correct };
          }
        }
        setResults(latestResults);
      } catch (err) {
        console.error('Failed to refresh live game and pick data:', err);
      }
    };

    const interval = setInterval(refreshLiveGames, 60_000);
    return () => clearInterval(interval);
  }, [selectedWeek, user.name]);

  // Monitor for upcoming kickoffs and re-check lock status
  useEffect(() => {
    const upcomingGames = games.filter((g) => {
      const kickoff = new Date(g.startTime).getTime();
      const now = Date.now();
      return kickoff - now < 5 * 60 * 1000; // Within 5 minutes of kickoff
    });

    if (upcomingGames.length === 0) return;

    const interval = setInterval(() => {
      setGames([...games]); // Trigger re-check
    }, 1000);

    return () => clearInterval(interval);
  }, [games]);

  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [swipeHintVisible, setSwipeHintVisible] = useState(false);
  const [showChevronHint, setShowChevronHint] = useState(false);
  const [chevronHintVisible, setChevronHintVisible] = useState(false);

  useEffect(() => {
    if (games.length === 0 || localStorage.getItem('cfb-pickem-swipe-hint-seen')) return undefined;

    localStorage.setItem('cfb-pickem-swipe-hint-seen', 'true');
    setShowSwipeHint(true);
    const visibleTimeout = setTimeout(() => setSwipeHintVisible(true), 30);
    const hideTimeout = setTimeout(() => setSwipeHintVisible(false), 3000);
    const unmountTimeout = setTimeout(() => setShowSwipeHint(false), 3400);

    return () => {
      clearTimeout(visibleTimeout);
      clearTimeout(hideTimeout);
      clearTimeout(unmountTimeout);
    };
  }, [games.length]);

  useEffect(() => {
    if (games.length === 0 || localStorage.getItem('cfb-pickem-chevron-hint-seen')) return undefined;

    setShowChevronHint(true);
    const visibleTimeout = setTimeout(() => setChevronHintVisible(true), 30);
    const hideTimeout = setTimeout(() => {
      setChevronHintVisible(false);
      localStorage.setItem('cfb-pickem-chevron-hint-seen', 'true');
    }, 3500);
    const unmountTimeout = setTimeout(() => setShowChevronHint(false), 3850);

    return () => {
      clearTimeout(visibleTimeout);
      clearTimeout(hideTimeout);
      clearTimeout(unmountTimeout);
    };
  }, [games.length]);

  const currentWeekNumber = selectedWeek ? getWeekNumber(selectedWeek) : 0;

  const goPrev = () => {
    if (!selectedWeek || currentWeekNumber <= 0) return;
    loadWeek(addWeeks(selectedWeek, -1));
  };

  const maxAllowedWeek = computeEffectiveMaxAllowedWeek();

  const goNext = () => {
    if (!selectedWeek || currentWeekNumber >= maxAllowedWeek) return;
    loadWeek(addWeeks(selectedWeek, 1));
  };

  const canGoPrevious = currentWeekNumber > 0;
  const canGoNext = currentWeekNumber < maxAllowedWeek;

  const runWeekTransition = async (direction) => {
    if (isFlipping.current) return;
    if (direction === 'next' && !canGoNext) return;
    if (direction === 'prev' && !canGoPrevious) return;

    isFlipping.current = true;
    setFlipDirection(direction);
    setFlipPhase('out');
    await new Promise((resolve) => setTimeout(resolve, 30));

    if (direction === 'next') goNext(); else goPrev();

    setFlipPhase('pre-in');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    setFlipPhase('in');
    await new Promise((resolve) => setTimeout(resolve, 40));

    setFlipPhase('idle');
    isFlipping.current = false;
  };

  const handlePrev = () => runWeekTransition('prev');
  const handleNext = () => runWeekTransition('next');

  if (status === 'loading') return null;
  if (status === 'error') return <p className="picks__status picks__status--error">Failed to load this week's games</p>;

  const isGraded = Object.keys(results).length > 0;
  const completedGameCount = games.filter((game) => game.completed).length;
  const liveGameCount = games.filter((game) => game.statusState === 'in').length;
  const upcomingGameCount = games.length - completedGameCount - liveGameCount;
  const weekCorrectCount = Object.values(results).filter((result) => result.correct).length;
  const weekTitle = selectedWeek ? formatWeekLabel(selectedWeek) : 'Week Snapshot';

  const dismissSwipeHint = () => {
    if (!showSwipeHint) return;
    setSwipeHintVisible(false);
    localStorage.setItem('cfb-pickem-swipe-hint-seen', 'true');
    setTimeout(() => setShowSwipeHint(false), 350);
  };

  const dismissChevronHint = () => {
    if (!showChevronHint) return;
    setChevronHintVisible(false);
    localStorage.setItem('cfb-pickem-chevron-hint-seen', 'true');
    setTimeout(() => setShowChevronHint(false), 350);
  };

  const handleTouchStart = (event) => {
    dismissSwipeHint();
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    const minSwipeDistance = 50;
    if (Math.abs(deltaX) < minSwipeDistance || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) handleNext();
    else handlePrev();
  };

  return (
    <div className="picks" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {canGoPrevious && (
        <button className="picks__page-nav picks__page-nav--previous" onClick={() => { dismissChevronHint(); handlePrev(); }} aria-label="Previous week" />
      )}
      {canGoNext && (
        <button className="picks__page-nav picks__page-nav--next" onClick={() => { dismissChevronHint(); handleNext(); }} aria-label="Next week" />
      )}
      {showChevronHint && (
        <div className={`picks__chevron-hint-overlay${chevronHintVisible ? ' is-visible' : ''}`} role="status">
          <div className="picks__chevron-hint-content">
            <span className="picks__chevron-hint-emoji" aria-hidden="true">{'\u{1F446}'}</span>
            <p>Click to change weeks</p>
          </div>
        </div>
      )}
      {showSwipeHint && (
        <div className={`picks__swipe-hint-overlay${swipeHintVisible ? ' is-visible' : ''}`} role="status">
          <div className="picks__swipe-hint-content">
            <span className="picks__swipe-hint-emoji" aria-hidden="true">👉</span>
            <span className="picks__swipe-hint-arrow" aria-hidden="true">&rarr;</span>
            <p>Swipe to change weeks</p>
          </div>
        </div>
      )}
      {games.length > 0 && (
        <div className="picks__info">
          <p>Make your picks below.</p>
          <p>No submit necessary.</p>
          <p>Selections are locked in at kickoff.</p>
        </div>
      )}
      <div className="picks__mobile-rails">
        <details className="picks__mobile-rail">
          <summary>{weekTitle}</summary>
          <dl>
            <div><dt>Final</dt><dd>{completedGameCount}</dd></div>
            <div><dt>Live</dt><dd>{liveGameCount}</dd></div>
            <div><dt>Upcoming</dt><dd>{upcomingGameCount}</dd></div>
            <div><dt># Correct</dt><dd>{weekCorrectCount}</dd></div>
            {nextGame && (
              <div><dt>Next kickoff</dt><dd>{nextKickoffCountdown}</dd></div>
            )}
          </dl>
        </details>
        <details className="picks__mobile-rail">
          <summary>Season Stats</summary>
          <dl>
            <div><dt>Rank</dt><dd>{seasonStats?.rank ? formatRank(seasonStats.rank) : '-'}</dd></div>
            <div><dt># Correct</dt><dd>{seasonStats?.total ?? 0}</dd></div>
            <div><dt>Pick Rate</dt><dd>{seasonStats ? `${Math.round(seasonStats.winPct * 100)}%` : '-'}</dd></div>
          </dl>
        </details>
      </div>

      <div className="picks__stage">
      <div className={`picks__content is-flip-${flipPhase} is-flip-${flipDirection}`}>
        <aside className="picks__week-snapshot" aria-label="Week snapshot">
          <p className="picks__week-snapshot-title">{weekTitle}</p>
          <dl>
            <div><dt>Final</dt><dd>{completedGameCount}</dd></div>
            <div><dt>Live</dt><dd>{liveGameCount}</dd></div>
            <div><dt>Upcoming</dt><dd>{upcomingGameCount}</dd></div>
            <div><dt># Correct</dt><dd>{weekCorrectCount}</dd></div>
          </dl>
          {nextGame && (
            <>
              <p className="picks__next-kickoff-label">Next kickoff</p>
              <p className="picks__next-kickoff" aria-live="polite">{nextKickoffCountdown}</p>
            </>
          )}
        </aside>
        {games.length > 0 ? (
          <div className="picks__list">
            {games.map((game) => (
              <GameCard
                key={game.gameId}
                game={game}
                pickedSide={selections[game.gameId]}
                onPick={(side) => handlePick(game.gameId, side)}
                locked={isKickoffLocked(game) || game.completed}
                result={results[game.gameId]}
              />
            ))}
          </div>
        ) : (
          <div className="picks__empty-state">
            <p className="picks__status picks__status--muted">Check back soon...</p>
            <p className="picks__empty-copy">
              {selectedWeek ? `Games for this week have not been chosen yet` : 'There are no games chosen for this week yet.'}
            </p>
            <p className="picks__countdown-label">Picks open in</p>
            <p className="picks__countdown" aria-live="polite">{countdown}</p>
          </div>
        )}
        <aside className="picks__season-stats" aria-label="Season statistics">
          <p className="picks__season-stats-title">Season Stats</p>
          <dl>
            <div><dt>Rank</dt><dd>{seasonStats?.rank ? formatRank(seasonStats.rank) : '-'}</dd></div>
            <div><dt># Correct</dt><dd>{seasonStats?.total ?? 0}</dd></div>
            <div><dt>Pick Rate</dt><dd>{seasonStats ? `${Math.round(seasonStats.winPct * 100)}%` : '-'}</dd></div>
          </dl>
        </aside>
      </div>
      </div>
    </div>
  );
}
