import api from './api';
import axios from 'axios';

// Login needs raw axios to avoid interceptor issues with FormData or base URL if different
// although here we can use the same instance if we want.
export const login = async (username: string, password: string) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);

  // Still absolute because it doesn't use the 'api' instance
  const response = await axios.post(`/api/auth/login/`, formData);
  if (response.data.access_token) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (e) {
    return null;
  }
};

export const getUsers = async () => {
  const response = await api.get(`auth/users/`);
  return response.data;
};

export const updateUserStatus = async (userId: number, status: string) => {
  const response = await api.put(`auth/users/${userId}/status/`, { status });
  return response.data;
};

export const createUser = async (userData: any) => {
  const response = await api.post(`auth/users/`, userData);
  return response.data;
};

const authService = {
  login,
  logout,
  getCurrentUser,
  getUsers,
  updateUserStatus,
  createUser
};

export default authService;
