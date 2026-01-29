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

export async function fetchInstitutionCredentials() {
  const response = await axios.get(`${API_BASE_URL}/credentials/institution`);
  return response.data;
}
