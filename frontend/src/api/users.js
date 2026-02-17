import axios from 'axios';
import { ENV } from '@/config/env.js';

const API_BASE_URL = ENV.GATEWAY_URL;

export async function fetchCurrentUser(token, signal) {
  const response = await axios.get(`${API_BASE_URL}/users/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  });
  return response.data;
}
