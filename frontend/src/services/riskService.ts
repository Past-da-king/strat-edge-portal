import api from './api';

// With a project id, only that project's risks (archived or not, as on its own
// page); without, the risks on every live project you are on.
export const getRisks = async (projectId?: number) => {
  const params = projectId ? { project_id: projectId, include_archived: true } : undefined;
  const response = await api.get('risks/', { params });
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
