import React from 'react';
import cfbBackground from '../assets/CFB_Background.png';
import './GameCard.css';

function formatKickoff(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * `pickedSide` is 'home' | 'away' | undefined.
 * `onPick(side)` is called when a team button is clicked.
 * `result` (optional) is the graded pick, e.g. { correct: true }.
 */
export default function GameCard({ game, pickedSide, onPick, locked = false, result: gradedResult }) {
  const hasFinalScore = game.homeScore !== null && game.homeScore !== undefined
    && game.awayScore !== null && game.awayScore !== undefined;
  const result = gradedResult || (game.completed && pickedSide && hasFinalScore
    ? {
        correct: game.homeScore !== game.awayScore
          && pickedSide === (game.homeScore > game.awayScore ? 'home' : 'away'),
      }
    : undefined);
  const pickAccuracy = game.pickAccuracy?.total
    ? Math.round((game.pickAccuracy.correct / game.pickAccuracy.total) * 100)
    : null;
  const winningTeamAbbreviation = game.completed && hasFinalScore && game.homeScore !== game.awayScore
    ? game.homeScore > game.awayScore ? game.homeTeam.abbreviation : game.awayTeam.abbreviation
    : null;
  const scoreLabel = (score) => (score !== null && score !== undefined ? score : '--');
  const footerLabel = game.completed
    ? 'Final'
    : game.statusState === 'in'
      ? (game.period ? `Q${game.period}` : 'Live')
      : 'Pregame';
  const pickStatus = result
    ? result.correct
      ? { icon: '✓', label: 'Correct', tone: 'correct' }
      : { icon: '✗', label: 'Incorrect', tone: 'incorrect' }
    : game.statusState === 'in'
      ? { icon: '🔒', label: 'Locked', tone: 'locked' }
      : { icon: '✏️', label: 'Open' };

  const metaParts = [];
  if (game.statusState === 'in') metaParts.push('Live');
  if (game.statusDetail) {
    metaParts.push(game.statusDetail);
  } else {
    if (game.completed) metaParts.push('Final');
    if (game.statusState === 'in' && game.period) metaParts.push(`Q${game.period}`);
    if (game.statusState === 'in' && game.displayClock) metaParts.push(game.displayClock);
  }
  const metaLabel = (game.statusState === 'in' || game.completed)
    ? metaParts.join(' ')
    : formatKickoff(game.startTime);

  const TeamButton = ({ side, team }) => {
    const isPicked = pickedSide === side;
    const isLoser = winningTeamAbbreviation !== null && team.abbreviation !== winningTeamAbbreviation;
    return (
      <button
        type="button"
        className={`game-card__team${isPicked ? ' is-picked' : ''}${isLoser ? ' is-loser' : ''}`}
        style={{ '--team-color': team.color || 'var(--color-outline-neutral)', '--bg-image': `url(${cfbBackground})` }}
        title={team.name || team.displayName || team.abbreviation}
        aria-label={team.name || team.displayName || team.abbreviation}
        onClick={() => !locked && onPick(side)}
        disabled={locked}
        aria-pressed={isPicked}
      >
        {team.logo && <img src={team.logo} alt="" className="game-card__logo" />}
        <span className="game-card__team-name">
          {team.rank && <span className="game-card__rank">{team.rank}</span>}
          <span className="game-card__team-name-full">{team.name || team.displayName || team.abbreviation}</span>
          <span className="game-card__team-name-abbr">{team.abbreviation}</span>
        </span>
        {isPicked && (
          <span className={`game-card__team-ribbon${pickStatus.tone ? ` is-${pickStatus.tone}` : ''}`} aria-hidden="true">
            <span className="game-card__team-ribbon-icon">{pickStatus.icon}</span>
          </span>
        )}
      </button>
    );
  };

  const TeamRow = ({ side, team }) => (
    <div className="game-card__team-row">
      <span className="game-card__team-label">{side === 'home' ? 'HOME' : 'AWAY'}</span>
      <TeamButton side={side} team={team} />
    </div>
  );

  return (
    <div className={`game-card${locked ? ' is-locked' : ''}${result ? (result.correct ? ' is-correct' : ' is-incorrect') : ''}`}>
      <div className={`game-card__meta${game.statusState === 'in' ? ' is-live' : ''}`}>
        <span className="game-card__date">
          {metaLabel}
          {game.venue && <span className="game-card__venue">{game.venue}</span>}
        </span>
        <div className="game-card__meta-right">
          {pickAccuracy !== null && winningTeamAbbreviation && (
            <span className="game-card__pick-accuracy">{pickAccuracy}% picked {winningTeamAbbreviation}</span>
          )}
          {game.neutralSite && game.statusState !== 'in' && !game.completed && (
            <span className="game-card__neutral">Neutral</span>
          )}
          {game.spreadDetails && <span className="game-card__spread">{game.spreadDetails}</span>}
        </div>
      </div>

      <div className="game-card__matchup">
        <TeamRow side="away" team={game.awayTeam} />
        <TeamRow side="home" team={game.homeTeam} />
      </div>

      <div className={`game-card__result${result ? (result.correct ? ' is-correct' : ' is-incorrect') : ''}`}>
        {footerLabel}: {game.awayTeam.abbreviation} <span className="game-card__result-score">{scoreLabel(game.awayScore)}</span> &ndash; {game.homeTeam.abbreviation} <span className="game-card__result-score">{scoreLabel(game.homeScore)}</span>
        {result && (
          <span className={`game-card__result-verdict${result.correct ? ' is-correct' : ' is-incorrect'}`}>
            {' '}· {result.correct ? 'Correct' : 'Missed'}
          </span>
        )}
      </div>
    </div>
  );
}