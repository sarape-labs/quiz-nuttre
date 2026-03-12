import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  nombre: string;
  usuario: string;
  email: string;
  rol: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  getAuthHeaders: () => { Authorization: string } | {};
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  getAuthHeaders: () => ({}),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await fetch('/api/auth/me', { 
          headers: { ...headers },
          credentials: 'include' 
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else if (res.status === 401) {
          localStorage.removeItem('auth_token');
        }
      } catch (error) {
        console.error('Failed to fetch user', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = (userData: User, token: string) => {
    localStorage.setItem('auth_token', token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      const headers = getAuthHeaders();
      await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: { ...headers },
        credentials: 'include'
      });
      localStorage.removeItem('auth_token');
      setUser(null);
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
