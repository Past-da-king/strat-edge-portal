import api from './api';
import axios from 'axios';

// Login needs raw axios to avoid interceptor issues with FormData or base URL if different
// although here we can use the same instance if we want.
/**
 * Step 1 of 2. A correct password returns a CHALLENGE token, never a session -
 * two-factor is compulsory. The caller then goes to mfaSetup (first time) or
 * straight to mfaVerify.
 */
export const login = async (username: string, password: string) => {
  // FastAPI OAuth2PasswordRequestForm expects x-www-form-urlencoded
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  const response = await api.post(`auth/login/`, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return response.data as {
    mfa_required: boolean;
    mfa_enrolled: boolean;
    challenge_token: string;
    full_name?: string;
    username?: string;
  };
};

/** First-time enrolment: returns the QR image and the secret for manual entry. */
export const mfaSetup = async (challengeToken: string) => {
  const response = await api.post(`auth/mfa/setup/`, {}, {
    headers: { Authorization: `Bearer ${challengeToken}` }
  });
  return response.data as {
    secret: string;
    otpauth_uri: string;
    qr_data_uri: string;
    issuer: string;
  };
};

/** Step 2. A verified code is what finally signs the user in. */
export const mfaVerify = async (challengeToken: string, code: string) => {
  const response = await api.post(`auth/mfa/verify/`, { code }, {
    headers: { Authorization: `Bearer ${challengeToken}` }
  });
  if (response.data.access_token) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  return response.data;
};

/** Admin recovery: clears a user's authenticator so they enrol again. */
export const resetUserMfa = async (userId: number) => {
  const response = await api.post(`auth/users/${userId}/mfa/reset/`, {});
  return response.data;
};

/** Where Strat Edge ID wants the browser sent, plus the verifier to hold onto. */
export const ssoStart = async () => {
  const response = await api.get(`auth/sso/start/`);
  return response.data as { authorize_url: string; code_verifier: string; state: string };
};

export const ssoConfig = async () => {
  try {
    const response = await api.get(`auth/sso/config/`);
    return response.data as {
      enabled: boolean;
      id_base_url: string;
      local_sign_in_allowed?: boolean;
      policy_source?: string;
    };
  } catch {
    // Our own API is unreachable. Show every door rather than none — the
    // backend refuses a local sign-in it is not allowed to accept anyway.
    return { enabled: false, id_base_url: "", local_sign_in_allowed: true };
  }
};

/** Swap the one-time code for a portal session. */
export const ssoCallback = async (code: string, codeVerifier: string) => {
  const response = await api.post(`auth/sso/callback/`, { code, code_verifier: codeVerifier });
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

export const updateUserRole = async (userId: number, role: string) => {
  const response = await api.put(`auth/users/${userId}/status/`, { role });
  return response.data;
};

export const createUser = async (userData: any) => {
  const response = await api.post(`auth/users/`, userData);
  return response.data;
};

export const updateMyProfile = async (data: { username?: string, full_name?: string, password?: string, old_password?: string }) => {
  const response = await api.put(`auth/users/me/`, data);
  return response.data;
};

const authService = {
  login,
  ssoStart,
  ssoConfig,
  ssoCallback,
  mfaSetup,
  mfaVerify,
  resetUserMfa,
  logout,
  getCurrentUser,
  getUsers,
  updateUserStatus,
  updateUserRole,
  createUser,
  updateMyProfile
};

export default authService;
