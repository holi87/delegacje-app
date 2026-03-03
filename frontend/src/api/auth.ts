import apiClient from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    profile: { firstName: string; lastName: string; position: string } | null;
  };
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', data);
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getMe() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

export async function checkSetupStatus(): Promise<{ needsSetup: boolean }> {
  const response = await apiClient.get('/setup/status');
  return response.data;
}

export interface SetupInitData {
  company: {
    name: string;
    nip: string;
    address: string;
    postalCode: string;
    city: string;
  };
  admin: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    position: string;
  };
  rates: { useDefaults: boolean };
}

export async function initSetup(data: SetupInitData) {
  const response = await apiClient.post('/setup/init', data);
  return response.data;
}
