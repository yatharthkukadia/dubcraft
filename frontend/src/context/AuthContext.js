import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const formatApiErrorDetail = (detail) => {
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        withCredentials: true,
      });
      setUser(data);
    } catch (error) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/auth/register`,
        { name, email, password },
        { withCredentials: true }
      );
      setUser(data);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: formatApiErrorDetail(e.response?.data?.detail) || e.message,
      };
    }
  };

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true }
      );
      setUser(data);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: formatApiErrorDetail(e.response?.data?.detail) || e.message,
      };
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
      setUser(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
