import api from './api';

// --- Project Endpoints ---
export const getProjects = async () => {
  const response = await api.get('/projects/');
  return response.data;
};

export const getProject = async (id: number) => {
  const response = await api.get(`/projects/${id}/`);
  return response.data;
};

export const getProjectMetrics = async (id: number) => {
  const response = await api.get(`/projects/${id}/metrics/`);
  return response.data;
};

export const getBurndownData = async (id: number) => {
  const response = await api.get(`/projects/${id}/burndown/`);
  return response.data;
};

export const getTaskBurndownData = async (id: number) => {
  const response = await api.get(`/projects/${id}/task-burndown/`);
  return response.data;
};

export const getExecutiveSummary = async (id: number) => {
  const response = await api.get(`/projects/${id}/summary/`);
  return response.data;
};

export const createProject = async (project: any) => {
  const response = await api.post('/projects/', project);
  return response.data;
};

export const downloadProjectPDF = async (id: number, projectName: string) => {
  const response = await api.get(`/reports/${id}/pdf/`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Report_${projectName}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// --- Admin Endpoints ---
export const updateProjectPM = async (projectId: number, newPmId: number) => {
  const response = await api.put(`/admin/projects/${projectId}/pm/`, { new_pm_id: newPmId });
  return response.data;
};

export const updateProjectTeam = async (projectId: number, userIds: number[]) => {
  const response = await api.put(`/admin/projects/${projectId}/team/`, { user_ids: userIds });
  return response.data;
};

export const bulkUpdateTaskAssignments = async (assignments: { task_id: number, user_id: number | null }[]) => {
  const response = await api.put(`/admin/tasks/assignments/`, { assignments });
  return response.data;
};

export const getAuditLogs = async (limit: number = 100) => {
  const response = await api.get(`/admin/audit/?limit=${limit}`);
  return response.data;
};

export const downloadFullBackup = async () => {
  const response = await api.get(`/admin/backup/`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `system_backup_${new Date().toISOString().split('T')[0]}.zip`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const restoreBackup = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/admin/restore/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

const projectService = {
  getProjects,
  getProject,
  getProjectMetrics,
  getBurndownData,
  getTaskBurndownData,
  getExecutiveSummary,
  createProject,
  downloadProjectPDF,
  updateProjectPM,
  updateProjectTeam,
  bulkUpdateTaskAssignments,
  getAuditLogs,
  downloadFullBackup,
  restoreBackup
};

export default projectService;
