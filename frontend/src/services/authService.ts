import api from './api';
import axios from 'axios';

// Login needs raw axios to avoid interceptor issues with FormData or base URL if different
// although here we can use the same instance if we want.
export const login = async (username: string, password: string) => {
  console.log('Attempting login for user:', username);
  
  // FastAPI OAuth2PasswordRequestForm expects x-www-form-urlencoded
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  try {
    console.log('Sending POST request to auth/login/');
    const response = await api.post(`auth/login/`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('Login response received:', response.status);
    
    if (response.data.access_token) {
      console.log('Login successful, storing token');
      localStorage.setItem('user', JSON.stringify(response.data));
    } else {
      console.warn('Login response missing access_token');
    }
    return response.data;
  } catch (err: any) {
    console.error('Login service error:', err.message);
    if (err.response) {
      console.error('Error status:', err.response.status);
      console.error('Error data:', err.response.data);
    }
    throw err;
  }
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
