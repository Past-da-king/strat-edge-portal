import axios from 'axios';

const API_URL = 'http://localhost:8000/risks';

const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {};
};

export const getRisks = async () => {
  const response = await axios.get(API_URL, { headers: getAuthHeader() });
  return response.data;
};

export const getProjectRisks = async (projectId: number) => {
  const response = await axios.get(`${API_URL}/project/${projectId}`, { headers: getAuthHeader() });
  return response.data;
};

const riskService = {
  getRisks,
  getProjectRisks
};

export default riskService;
