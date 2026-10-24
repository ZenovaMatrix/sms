import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('edu_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((userData, token) => {
    localStorage.setItem('edu_token', token);
    localStorage.setItem('edu_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('edu_token');
    localStorage.removeItem('edu_user');
    setUser(null);
  }, []);

  const isAuthenticated = !!user;
  const role = user?.role || null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, role }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
