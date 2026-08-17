import React, { createContext, useContext, useEffect, useState } from 'react';

const UserContext = createContext(null);
const STORAGE_KEY = 'cfb-pickem-user';

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const logout = () => setUser(null);

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>{children}</UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
}
