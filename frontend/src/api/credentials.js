import axios from 'axios';
import { ENV } from '@/config/env.js';

const API_BASE_URL = ENV.GATEWAY_URL;

export async function fetchHomeRolesAndFeatures() {
  const response = await axios.get(`${API_BASE_URL}/home/roles-features`);
  return response.data;
}

export async function fetchStudentCredentials(clerkId) {
  const response = await axios.get(`${API_BASE_URL}/credentials/student`, {
    params: clerkId ? { clerkId } : undefined,
  });
  return response.data;
}

export async function fetchRegistrarCredentials() {
  const response = await axios.get(`${API_BASE_URL}/credentials`);
  return response.data;
}

export async function createCredential(payload) {
  const response = await axios.post(`${API_BASE_URL}/credentials`, payload);
  return response.data;
}
