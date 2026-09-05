import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useUser } from '../context/UserContext.jsx';
import logo from '../../public/icon.png';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [conferences, setConferences] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const allTeams = conferences.flatMap((c) => c.teams);
      const selected = allTeams.find((t) => t.name === favoriteTeam);
      const user =
        mode === 'signup'
          ? await api.signup(name.trim(), password.trim(), selected?.name, selected?.id)
          : await api.login(name.trim(), password.trim());

      setUser(user);
      navigate('/picks');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    api.fetchFBSTeams().then(setConferences).catch(() => {});
  }, []);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setFavoriteTeam('');
    setError(null);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-card__logo-side">
          <img src={logo} alt="Pick'em" className="login-card__logo" />
        </div>

        <div className="login-card__form-side">
          <div className="login__mode-toggle" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === 'signup' ? 'login__toggle is-active' : 'login__toggle'}
              onClick={() => handleModeChange('signup')}
            >
              Create account
            </button>
            <button
              type="button"
              className={mode === 'login' ? 'login__toggle is-active' : 'login__toggle'}
              onClick={() => handleModeChange('login')}
            >
              Sign in
            </button>
          </div>

          <h2 className="login__title">
            {mode === 'signup' ? 'Kickoff time.' : 'Back in the game.'}
          </h2>
          <p className="login__subtitle">
            {mode === 'signup'
              ? 'Create your account.'
              : 'Sign in to your account.'}
          </p>

          <form className="login__form" onSubmit={handleSubmit}>
            <label className="login__field">
              <span>Username</span>
              <input
                className="login__input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>

            <label className="login__field">
              <span>Password</span>
              <input
                className="login__input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {mode === 'signup' && (
              <label className="login__field">
                <span>Favorite team (optional)</span>
                <select
                  className="login__input login__select"
                  value={favoriteTeam}
                  onChange={(e) => setFavoriteTeam(e.target.value)}
                >
                  <option value="">No favorite</option>
                  {conferences.map(({ conference, teams = [] }) => (
                    <optgroup key={conference} label={conference}>
                      {teams.map(({ id, name: teamName }) => (
                        <option key={id} value={teamName}>{teamName}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}

            <button
              className="login__submit"
              type="submit"
              disabled={loading || !name.trim() || !password.trim()}
            >
              {loading ? 'Loading...' : 'Submit'}
            </button>
          </form>

          {error && <p className="login__error">{error}</p>}
        </div>
      </div>
    </div>
  );
}