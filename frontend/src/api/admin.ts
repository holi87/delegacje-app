import apiClient from './client';

// Rates
export async function getDomesticRates() {
  const response = await apiClient.get('/admin/rates/domestic');
  return response.data;
}

export async function createDomesticRate(data: any) {
  const response = await apiClient.post('/admin/rates/domestic', data);
  return response.data;
}

export async function updateDomesticRate(id: string, data: any) {
  const response = await apiClient.patch(`/admin/rates/domestic/${id}`, data);
  return response.data;
}

export async function getMileageRates() {
  const response = await apiClient.get('/admin/rates/mileage');
  return response.data;
}

export async function createMileageRate(data: any) {
  const response = await apiClient.post('/admin/rates/mileage', data);
  return response.data;
}

export async function updateMileageRate(id: string, data: any) {
  const response = await apiClient.patch(`/admin/rates/mileage/${id}`, data);
  return response.data;
}

// Company
export async function getCompanyInfo() {
  const response = await apiClient.get('/admin/company');
  return response.data;
}

export async function updateCompanyInfo(data: any) {
  const response = await apiClient.patch('/admin/company', data);
  return response.data;
}

// Users
export async function listUsers(params?: { page?: number; limit?: number }) {
  const response = await apiClient.get('/users', { params });
  return response.data;
}

export async function getUser(id: string) {
  const response = await apiClient.get(`/users/${id}`);
  return response.data;
}

export async function createUser(data: any) {
  const response = await apiClient.post('/users', data);
  return response.data;
}

export async function updateUser(id: string, data: any) {
  const response = await apiClient.patch(`/users/${id}`, data);
  return response.data;
}

export async function deactivateUser(id: string) {
  await apiClient.delete(`/users/${id}`);
}
