import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import Login from './pages/Login.jsx';
import Picks from './pages/Picks.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import { useUser } from './context/UserContext.jsx';

function RequireUser({ children }) {
  const { user } = useUser();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useUser();

  return (
    <>
      <Header />
      <main className="app-shell">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/picks" replace /> : <Login />} />
          <Route
            path="/picks"
            element={
              <RequireUser>
                <Picks />
              </RequireUser>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <RequireUser>
                <Leaderboard />
              </RequireUser>
            }
          />
          <Route path="*" element={<Navigate to={user ? '/picks' : '/login'} replace />} />
        </Routes>
      </main>
    </>
  );
}
