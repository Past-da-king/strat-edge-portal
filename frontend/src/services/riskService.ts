import api from './api';

export const getRisks = async () => {
  const response = await api.get('risks/');
  return response.data;
};

export const getProjectRisks = async (projectId: number) => {
  const response = await api.get(`risks/project/${projectId}/`);
  return response.data;
};

const riskService = {
  getRisks,
  getProjectRisks
};

export default riskService;
