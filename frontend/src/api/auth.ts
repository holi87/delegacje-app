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

export interface RefreshResponse {
  accessToken: string;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  };
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    defaultVehicle: string | null;
    vehiclePlate: string | null;
    vehicleCapacity: string | null;
  } | null;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', data);
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function refreshAccessToken(): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>('/auth/refresh');
  return response.data;
}

export async function getMe(): Promise<MeResponse> {
  const response = await apiClient.get<MeResponse>('/auth/me');
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
