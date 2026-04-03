'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiJson } from '../lib/api';

type AuthUser = { id: string; email: string; name: string };

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  const clearExpensesPageMonthState = () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem('bw_expenses_month');
  };

  const clearSession = () => {
    localStorage.removeItem('bw_token');
    localStorage.removeItem('bw_user');
    clearExpensesPageMonthState();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshUser = async () => {
    const t = localStorage.getItem('bw_token');
    if (!t) {
      clearSession();
      return;
    }

    try {
      // If your apiJson automatically attaches the token, you can use:
      // const me = await apiJson('/api/profile/me');
      // Otherwise pass it explicitly:
      const me = await apiJson('/api/profile/me', {
        headers: { Authorization: `Bearer ${t}` },
      });

      const nextUser = (me?.user ?? me) as AuthUser;
      setUser(nextUser);
      localStorage.setItem('bw_user', JSON.stringify(nextUser));
      setIsAuthenticated(true);
      setToken(t);
    } catch {
      clearSession();
    }
  };

  useEffect(() => {
    // Restore session quickly from localStorage
    const t = localStorage.getItem('bw_token');
    const u = localStorage.getItem('bw_user');

    if (t) setToken(t);
    if (u) {
      try {
        setUser(JSON.parse(u));
      } catch {
        // ignore
      }
    }

    // If token exists, validate/refresh from backend so user info is accurate
    if (t) {
      refreshUser().finally(() => setIsInitialized(true));
      return;
    }

    setIsAuthenticated(false);
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    // Fresh login should reset expenses page month back to current real-world month.
    clearExpensesPageMonthState();
    const data = await apiJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const nextToken = data?.token as string | undefined;
    const nextUser = data?.user as AuthUser | undefined;
    if (!nextToken || !nextUser) throw new Error('Login failed');

    localStorage.setItem('bw_token', nextToken);
    localStorage.setItem('bw_user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setIsAuthenticated(true);

    // Refresh to ensure user info matches backend
    await refreshUser();

    router.push('/expenses');
  };

  const register = async (email: string, password: string, name: string) => {
    // Fresh registration/login should reset expenses page month back to current real-world month.
    clearExpensesPageMonthState();
    const data = await apiJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });

    const nextToken = data?.token as string | undefined;
    const nextUser = data?.user as AuthUser | undefined;
    if (!nextToken || !nextUser) throw new Error('Registration failed');

    localStorage.setItem('bw_token', nextToken);
    localStorage.setItem('bw_user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setIsAuthenticated(true);

    await refreshUser();

    router.push('/expenses');
  };

  const logout = () => {
    clearSession();
    router.push('/login');
  };

  if (!isInitialized) return null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}