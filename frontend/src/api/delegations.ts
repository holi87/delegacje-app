import apiClient from './client';

export async function listDelegations(params?: { status?: string; page?: number; limit?: number }) {
  const response = await apiClient.get('/delegations', { params });
  return response.data;
}

export async function getDelegation(id: string) {
  const response = await apiClient.get(`/delegations/${id}`);
  return response.data;
}

export async function createDelegation(data: any) {
  const response = await apiClient.post('/delegations', data);
  return response.data;
}

export async function updateDelegation(id: string, data: any) {
  const response = await apiClient.patch(`/delegations/${id}`, data);
  return response.data;
}

export async function deleteDelegation(id: string) {
  await apiClient.delete(`/delegations/${id}`);
}

export async function submitDelegation(id: string) {
  const response = await apiClient.post(`/delegations/${id}/submit`);
  return response.data;
}

export async function settleDelegation(id: string) {
  const response = await apiClient.post(`/delegations/${id}/settle`);
  return response.data;
}

export async function reopenDelegation(id: string) {
  const response = await apiClient.post(`/delegations/${id}/reopen`);
  return response.data;
}

export async function calculateDelegation(id: string) {
  const response = await apiClient.post(`/delegations/${id}/calculate`);
  return response.data;
}

export async function downloadDelegationPdf(id: string) {
  const response = await apiClient.get(`/delegations/${id}/pdf`, {
    responseType: 'blob',
  });
  return response.data;
}
