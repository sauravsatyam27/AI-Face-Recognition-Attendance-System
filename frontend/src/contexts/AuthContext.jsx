import React, { createContext, useState, useContext, useEffect } from 'react';
import api from "../utils/axios";
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authReady, setAuthReady] = useState(false); // ⭐ IMPORTANT

  /* =====================================================
     INITIAL AUTH CHECK
  ===================================================== */
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        api.defaults.headers.common['Authorization'] =
          `Bearer ${storedToken}`;

        setToken(storedToken);
        await fetchUser();
      } else {
        setLoading(false);
        setAuthReady(true); // ⭐ allow socket after auth check
      }
    };

    initAuth();
  }, []);

  /* =====================================================
     FETCH USER PROFILE
  ===================================================== */
  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/profile');
      console.log("✅ Fetched user profile:", response.data);

      setUser(response.data);

    } catch (error) {
      console.error(
        '❌ Failed to fetch user:',
        error.response?.data || error.message
      );

      // remove invalid token
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];

      setToken(null);
      setUser(null);

    } finally {
      setLoading(false);
      setAuthReady(true); // ⭐ VERY IMPORTANT
    }
  };

  /* =====================================================
     LOGIN
  ===================================================== */
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });

      // clear previous session completely
      localStorage.clear();

      const { token, user } = response.data;

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setToken(token);
      setUser(user);

      toast.success('Login successful!');

      // reload app cleanly
      window.location.href = '/dashboard';

      return { success: true };

    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      return { success: false };
    }
  };

  /* =====================================================
     REGISTER
  ===================================================== */
  const register = async (userData) => {
    try {
      console.log("📝 Registering user:", userData);

      const response = await api.post('/auth/register', userData);

      console.log("✅ Registration response:", response.data);

      localStorage.clear();

      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error("Invalid response from server");
      }

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setToken(token);
      setUser(user);

      toast.success('Registration successful!');

      // reload clean session
      window.location.href = '/dashboard';

      return { success: true };

    } catch (error) {
      console.error('❌ Registration error:', error);
      toast.error(error.response?.data?.message || 'Registration failed');
      return { success: false };
    }
  };

  /* =====================================================
     LOGOUT
  ===================================================== */
  const logout = () => {

    setUser(null);
    setToken(null);

    localStorage.clear(); // ⭐ clear everything
    delete api.defaults.headers.common['Authorization'];

    window.location.href = '/login';
  };

  /* =====================================================
     CONTEXT VALUE
  ===================================================== */
  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    authReady // ⭐ REQUIRED BY SOCKET CONTEXT
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};