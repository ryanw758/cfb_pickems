import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './Leaderboard.css';

const formatWeekLabel = (weekId) => {
  if (!weekId) return 'Week';
  const baseDate = new Date('2026-08-24T00:00:00Z');
  const monday = new Date(`${weekId}T00:00:00Z`);
  const diffWeeks = Math.floor((monday.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  return `W${Math.max(1, diffWeeks + 1)}`;
};

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { leaderboard: board, weeks: allWeeks = [] } = await api.getLeaderboard();
        setLeaderboard(board);
        setWeeks(allWeeks);
        setStatus('ready');
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    })();
  }, []);

  if (status === 'loading') return <p className="leaderboard__status">Loading standings...</p>;
  if (status === 'error') return <p className="leaderboard__status leaderboard__status--error">{error}</p>;

  return (
    <div className="leaderboard">
      <h1 className="leaderboard__title">Standings</h1>

      <div className="leaderboard__scroll">
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              {weeks.map((weekId) => (
                <th key={weekId}>{formatWeekLabel(weekId)}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={weeks.length + 3}>No users yet.</td>
              </tr>
            ) : (
              leaderboard.map((row, i) => (
                <tr key={row.userName}>
                  <td className="leaderboard__rank">{i + 1}</td>
                  <td>{row.userName}</td>
                  {weeks.map((weekId) => (
                    <td key={`${row.userName}-${weekId}`} className="leaderboard__cell">
                      {row.weeks[weekId] ?? 0}
                    </td>
                  ))}
                  <td className="leaderboard__total">{row.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
