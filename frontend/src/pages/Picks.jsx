import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useUser } from '../context/UserContext.jsx';
import GameCard from '../components/GameCard.jsx';
import './Picks.css';

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const mondayOf = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
};

const addWeeks = (isoWeek, delta) => {
  const d = new Date(`${isoWeek}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return toIsoDate(d);
};

const maxVisibleWeek = Number(import.meta.env.VITE_NUM_WEEKS || 15);

const formatWeekLabel = (weekId) => {
  if (!weekId) return null;

  const baseDate = new Date('2026-08-24T00:00:00Z');
  const monday = mondayOf(new Date(`${weekId}T00:00:00Z`));
  const diffWeeks = Math.floor((monday.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const weekNumber = Math.max(1, diffWeeks + 1);

  return `Week ${weekNumber}`;
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
  const [status, setStatus] = useState('loading'); // loading | ready | saving | saved | error
  const [error, setError] = useState(null);
  const loadRequestId = useRef(0);

  const loadWeek = async (weekIdToLoad) => {
    const requestId = ++loadRequestId.current;
    setSelectedWeek(weekIdToLoad);
    setStatus('loading');
    setError(null);

    try {
      const { weekId: resolvedWeekId, games: weekGames } = await api
        .getGamesByWeek(weekIdToLoad)
        .catch(() => ({ weekId: weekIdToLoad, games: [] }));

      if (requestId !== loadRequestId.current) return;

      setSelectedWeek(resolvedWeekId || weekIdToLoad);
      setGames(weekGames || []);

      const { picks } = await api.getPicks(resolvedWeekId || weekIdToLoad, user.name).catch(() => ({ picks: [] }));

      if (requestId !== loadRequestId.current) return;

      const nextSelections = {};
      const nextResults = {};
      for (const pick of picks) {
        nextSelections[pick.gameId] = pick.pickedSide;
        if (pick.correct !== null && pick.correct !== undefined) {
          nextResults[pick.gameId] = { correct: pick.correct };
        }
      }

      setSelections(nextSelections);
      setResults(nextResults);
      setStatus('ready');
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      setError(err.message);
      setStatus('error');
    }
  };

  useEffect(() => {
    let active = true;
    const requestId = ++loadRequestId.current;

    (async () => {
      try {
        const { weekId: currentWeek } = await api.getCurrentWeekGames();
        if (!active || requestId !== loadRequestId.current) return;
        await loadWeek(currentWeek);
      } catch (err) {
        if (!active || requestId !== loadRequestId.current) return;
        setError(err.message);
        setStatus('error');
      }
    })();

    return () => {
      active = false;
      loadRequestId.current += 1;
    };
  }, [user.name]);

  const handlePick = (gameId, side) => {
    setSelections((prev) => ({ ...prev, [gameId]: side }));
  };

  const handleSubmit = async () => {
    setStatus('saving');
    setError(null);
    try {
      const picks = games
        .map((g) => ({ gameId: g.gameId, pickedSide: selections[g.gameId] }))
        .filter((p) => p.pickedSide);
      await api.submitPicks(user.name, picks);
      setStatus('saved');
    } catch (err) {
      setError(err.message);
      setStatus('ready');
    }
  };

  const currentWeekNumber = selectedWeek ? Number(formatWeekLabel(selectedWeek).replace('Week ', '')) : 0;

  const handlePrev = () => {
    if (!selectedWeek || currentWeekNumber <= 1) return;
    loadWeek(addWeeks(selectedWeek, -1));
  };

  const handleNext = () => {
    if (!selectedWeek || currentWeekNumber >= maxVisibleWeek) return;
    loadWeek(addWeeks(selectedWeek, 1));
  };

  if (status === 'loading') return <p className="picks__status">Loading this week's games...</p>;
  if (status === 'error') return <p className="picks__status picks__status--error">{error}</p>;

  const pickedCount = games.filter((g) => selections[g.gameId]).length;
  const allPicked = pickedCount === games.length && games.length > 0;
  const isGraded = Object.keys(results).length > 0;

  return (
    <div className="picks">
      <div className="picks__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="picks__nav" onClick={handlePrev} disabled={!selectedWeek || currentWeekNumber <= 1}>
            &larr;
          </button>
          <h1 className="picks__title">{selectedWeek ? formatWeekLabel(selectedWeek) : 'Loading...'}</h1>
          <button className="picks__nav" onClick={handleNext} disabled={!selectedWeek || currentWeekNumber >= maxVisibleWeek}>
            &rarr;
          </button>
        </div>
        <p className="picks__subtitle">
          {isGraded
            ? `${Object.values(results).filter((r) => r.correct).length} / ${games.length} correct`
            : `${pickedCount} / ${games.length} picked`}
        </p>
      </div>

      {games.length === 0 && (
        <div className="picks__empty-state">
          <p className="picks__status picks__status--muted">Check back soon...</p>
          <p className="picks__empty-copy">
            {selectedWeek ? `Games for this week have not been chosen yet` : 'There are no games chosen for this week yet.'}
          </p>
        </div>
      )}

      <div className="picks__list">
        {games.map((game) => (
          <GameCard
            key={game.gameId}
            game={game}
            pickedSide={selections[game.gameId]}
            onPick={(side) => handlePick(game.gameId, side)}
            locked={isGraded || isKickoffLocked(game)}
            result={results[game.gameId]}
          />
        ))}
      </div>

      {!isGraded && games.length > 0 && (
        <div className="picks__footer">
          <button
            className="picks__submit"
            onClick={handleSubmit}
            disabled={!allPicked || status === 'saving'}
          >
            {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Picks saved' : 'Submit picks'}
          </button>
          {!allPicked && <span className="picks__hint">Pick all {games.length} games to submit</span>}
          {error && <span className="picks__hint picks__hint--error">{error}</span>}
        </div>
      )}
    </div>
  );
}
