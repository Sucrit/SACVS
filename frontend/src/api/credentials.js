export async function fetchHomeRolesAndFeatures() {
  const response = await axios.get(`${API_BASE_URL}/home/roles-features`);
  return response.data;
}
import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api';

export async function fetchStudentCredentials() {
  const response = await axios.get(`${API_BASE_URL}/credentials/student`);
  return response.data;
}

export async function fetchRegistrarCredentials() {
  const response = await axios.get(`${API_BASE_URL}/credentials`);
  return response.data;
}
