import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import './Leaderboard.css';

const formatWeekLabel = (weekId) => {
  if (!weekId) return 'Week';
  const baseDate = new Date('2026-08-26T00:00:00Z');
  const monday = new Date(`${weekId}T00:00:00Z`);
  const diffWeeks = Math.floor((monday.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
  return `W${diffWeeks}`;
};

const formatRankLabel = (rank) => {
  const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th');
  return `${rank}${suffix}`;
};

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(() => new Set());

  const toggleRow = (userName) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) next.delete(userName);
      else next.add(userName);
      return next;
    });
  };

  useEffect(() => {
    let isCurrent = true;
    let hasLoaded = false;

    const loadLeaderboard = async () => {
      try {
        const { leaderboard: board, weeks: allWeeks = [] } = await api.getLeaderboard();
        if (!isCurrent) return;
        setLeaderboard(board);
        setWeeks(allWeeks);
        setStatus('ready');
        hasLoaded = true;
      } catch (err) {
        if (!isCurrent) return;
        console.error('Failed to refresh leaderboard:', err);
        if (!hasLoaded) {
          setError(err.message);
          setStatus('error');
        }
      }
    };

    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 60_000);

    return () => {
      isCurrent = false;
      clearInterval(interval);
    };
  }, []);

  if (status === 'loading') return null;
  if (status === 'error') return <p className="leaderboard__status leaderboard__status--error">{error}</p>;

  return (
    <div className="leaderboard">

      <div className="leaderboard__scroll">
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th>Rank</th>
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
                  <td className={`leaderboard__rank leaderboard__rank--${i < 3 ? ['gold', 'silver', 'bronze'][i] : 'other'}`}>
                    {formatRankLabel(i + 1)}
                  </td>
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

      <div className="leaderboard__mobile-list">
        {leaderboard.length === 0 ? (
          <p className="leaderboard__mobile-empty">No users yet.</p>
        ) : (
          leaderboard.map((row, i) => {
            const isExpanded = expandedRows.has(row.userName);
            return (
              <div className={`leaderboard__mobile-card${isExpanded ? ' is-expanded' : ''}`} key={row.userName}>
                <button
                  type="button"
                  className="leaderboard__mobile-summary"
                  onClick={() => toggleRow(row.userName)}
                  aria-expanded={isExpanded}
                >
                  <span className={`leaderboard__rank leaderboard__rank--${i < 3 ? ['gold', 'silver', 'bronze'][i] : 'other'}`}>
                    {formatRankLabel(i + 1)}
                  </span>
                  <span className="leaderboard__mobile-name">{row.userName}</span>
                  <span className="leaderboard__total">{row.total}</span>
                  <span className="leaderboard__mobile-toggle" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                </button>

                {isExpanded && (
                  <div className="leaderboard__mobile-detail">
                    {weeks.map((weekId) => (
                      <React.Fragment key={`${row.userName}-${weekId}`}>
                        <span className="leaderboard__detail-label">{formatWeekLabel(weekId)}</span>
                        <span className="leaderboard__detail-value">{row.weeks[weekId] ?? 0}</span>
                      </React.Fragment>
                    ))}
                    <span className="leaderboard__detail-label leaderboard__detail-label--total">Total</span>
                    <span className="leaderboard__detail-value leaderboard__detail-value--total">{row.total}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
