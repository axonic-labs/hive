import { createContext, useContext, useState, useCallback } from 'react';
import { apiPost, getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../api/client';

interface UserInfo {
  id: string;
  name: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (apiKey: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  logout: () => {},
  checkAuth: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const key = getStoredApiKey();
    if (!key) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const info = await apiPost<UserInfo>('/auth/verify');
      setUser(info);
    } catch {
      setUser(null);
      clearStoredApiKey();
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (apiKey: string): Promise<boolean> => {
    setStoredApiKey(apiKey);
    try {
      const info = await apiPost<UserInfo>('/auth/verify');
      setUser(info);
      return true;
    } catch {
      clearStoredApiKey();
      setUser(null);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredApiKey();
    setUser(null);
  }, []);

  return { user, loading, login, logout, checkAuth };
}
