export async function fetchHomeRolesAndFeatures() {
  // Adjust endpoint as needed for your backend
  const response = await axios.get(`${API_BASE_URL}/home/roles-features`);
  return response.data;
}
import axios from 'axios';

// You may want to set this to your gateway or user-service endpoint
const API_BASE_URL = 'http://localhost:4000/';


export async function fetchStudentCredentials() {
  const response = await axios.get(`${API_BASE_URL}/credentials/student`);
  return response.data;
}

export async function fetchInstitutionCredentials() {
  const response = await axios.get(`${API_BASE_URL}/credentials/institution`);
  return response.data;
}
