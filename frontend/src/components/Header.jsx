import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../context/UserContext.jsx';
import './Header.css';

export default function Header() {
  const { user, logout } = useUser();

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__brand">
          <span className="header__mark">10</span>
          <span className="header__wordmark">
            PICK<span className="header__wordmark-accent">&#39;</span>EM
          </span>
        </div>

        {user && (
          <nav className="header__nav">
            <NavLink to="/picks" className={({ isActive }) => (isActive ? 'is-active' : '')}>
              This Week
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? 'is-active' : '')}>
              Standings
            </NavLink>
            <button className="header__logout" onClick={logout}>
              {user.name} &middot; Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
