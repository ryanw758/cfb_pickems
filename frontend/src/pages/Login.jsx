import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useUser } from '../context/UserContext.jsx';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
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
      const user =
        mode === 'signup'
          ? await api.signup(name.trim(), password.trim())
          : await api.login(name.trim(), password.trim());

      setUser(user);
      navigate('/picks');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = mode === 'signup' ? 'Create account' : 'Sign in';

  return (
    <div className="login-shell">
      <section className="login-panel login-panel--brand">
        <div className="login-panel__content">
          <p className="login-panel__eyebrow">College football pick'em</p>
          <h1 className="login-panel__title">Enter the pool.</h1>
          <p className="login-panel__text">
            Track the week, submit picks, and run the friendly rivalry all season long.
          </p>
          <div className="login-panel__stats">
            <div>
              <strong>10</strong>
              <span>games</span>
            </div>
            <div>
              <strong>1</strong>
              <span>league</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>trash talk</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-panel login-panel--form">
        <div className="login-card">
          <div className="login__mode-toggle" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === 'signup' ? 'login__toggle is-active' : 'login__toggle'}
              onClick={() => setMode('signup')}
            >
              Create account
            </button>
            <button
              type="button"
              className={mode === 'login' ? 'login__toggle is-active' : 'login__toggle'}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
          </div>

          <h2 className="login__title">
            {mode === 'signup' ? 'Welcome in.' : 'Back in the game.'}
          </h2>
          <p className="login__subtitle">
            {mode === 'signup'
              ? 'Create your password and join the pool.'
              : 'Sign in with your name and password.'}
          </p>

          <form className="login__form" onSubmit={handleSubmit}>
            <label className="login__field">
              <span>Name</span>
              <input
                className="login__input"
                type="text"
                placeholder="Your name"
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
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <button
              className="login__submit"
              type="submit"
              disabled={loading || !name.trim() || !password.trim()}
            >
              {loading ? 'Loading...' : buttonLabel}
            </button>
          </form>

          {error && <p className="login__error">{error}</p>}
        </div>
      </section>
    </div>
  );
}
