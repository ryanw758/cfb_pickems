import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../context/UserContext.jsx';
import logo from '../../public/icon.png';
import './Header.css';

export default function Header() {
  const { user, logout } = useUser();
  const [showRules, setShowRules] = useState(false);

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__brand">
          <img src={logo} alt="Pick'em" className="header__logo" />
        </div>

        {user && (
          <nav className="header__nav">
            <NavLink to="/picks" className={({ isActive }) => (isActive ? 'is-active' : '')}>
              My Picks
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? 'is-active' : '')}>
              Standings
            </NavLink>
            <button type="button" className="header__nav--rules" onClick={() => setShowRules(true)}>
              Rules
            </button>
            <button className="header__logout" onClick={logout}>
              {user.name} &middot; Log out
            </button>
          </nav>
        )}
      </div>

      {showRules && (
        <div className="rules-overlay" onClick={() => setShowRules(false)} role="dialog" aria-modal="true">
          <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rules-modal__close" onClick={() => setShowRules(false)} aria-label="Close">
              &times;
            </button>
            <h2 className="rules-modal__title">Game Rules & Payouts</h2>
            <p>Each week in the regular season, 10-15 random games are selected. Choose one team who you predict will win each game. </p>
            <p>You are awarded one point for each correct pick. Player scores are displayed on the Standings page.</p>
            <p>Conference championship games will have their own special week, as will the post season.</p>
            <p>After the national championship game has concluded, all correct picks are tallied and winners are announced.</p>
            <p>Payout for the winners is as follows:</p>
            <p>🥇 1st Place: 70% of the pot</p>
            <p>🥈 2nd Place: 30% of the pot</p>
            <p>🥉 3rd Place: Refund buy-in</p>
          </div>
        </div>
      )}
    </header>
  );
}
