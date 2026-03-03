import apiClient from './client';

export interface Profile {
  firstName: string;
  lastName: string;
  position: string;
  defaultVehicle?: string | null;
  vehiclePlate?: string | null;
}

export async function getProfile(): Promise<Profile> {
  const response = await apiClient.get('/profile');
  return response.data;
}

export async function updateProfile(data: Partial<Profile>): Promise<Profile> {
  const response = await apiClient.patch('/profile', data);
  return response.data;
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.patch('/profile/password', data);
}
