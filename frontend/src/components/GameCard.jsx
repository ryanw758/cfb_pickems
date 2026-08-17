import React from 'react';
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
export default function GameCard({ game, pickedSide, onPick, locked = false, result }) {
  const TeamButton = ({ side, team, accentVar }) => {
    const isPicked = pickedSide === side;
    return (
      <button
        type="button"
        className={`game-card__team${isPicked ? ' is-picked' : ''}`}
        style={{ '--team-accent': `var(${accentVar})` }}
        onClick={() => !locked && onPick(side)}
        disabled={locked}
        aria-pressed={isPicked}
      >
        {team.logo && <img src={team.logo} alt="" className="game-card__logo" />}
        <span className="game-card__team-name">{team.abbreviation}</span>
      </button>
    );
  };

  return (
    <div className={`game-card${locked ? ' is-locked' : ''}${result ? (result.correct ? ' is-correct' : ' is-incorrect') : ''}`}>
      <div className="game-card__meta">
        <span>{formatKickoff(game.startTime)}</span>
        <div className="game-card__meta-right">
          {locked && <span className="game-card__lock">Locked</span>}
          {game.spreadDetails && <span className="game-card__spread">{game.spreadDetails}</span>}
        </div>
      </div>

      <div className="game-card__matchup">
        <TeamButton side="away" team={game.awayTeam} accentVar="--color-away" />
        <span className="game-card__at">@</span>
        <TeamButton side="home" team={game.homeTeam} accentVar="--color-home" />
      </div>

      {result && (
        <div className="game-card__result">
          Final: {game.awayTeam.abbreviation} {game.awayScore} &ndash; {game.homeTeam.abbreviation}{' '}
          {game.homeScore} &middot; {result.correct ? 'Correct' : 'Missed'}
        </div>
      )}
    </div>
  );
}
