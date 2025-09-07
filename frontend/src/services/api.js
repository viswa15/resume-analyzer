// frontend/src/services/api.js
import axios from 'axios';

// Create an Axios instance with a base URL.
// This means we don't have to type 'http://localhost:3001' for every request.

const API_URL = process.env.VITE_BASE_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Uploads a resume file to the backend.
 * @param {File} file - The resume file to upload.
 * @returns {Promise<object>} The analysis data from the backend.
 */
export const uploadResume = async (file) => {
  const formData = new FormData();
  formData.append('resume', file);

  // For file uploads, we need to set the Content-Type header to multipart/form-data
  const response = await apiClient.post('/resumes/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Fetches the list of all previously uploaded resumes.
 * @returns {Promise<Array>} A list of resume records.
 */
export const getAllResumes = async () => {
  const response = await apiClient.get('/resumes/');
  return response.data;
};

/**
 * Fetches the full details for a single resume by its ID.
 * @param {number} id - The ID of the resume to fetch.
 * @returns {Promise<object>} The full resume analysis object.
 */
export const getResumeById = async (id) => {
  const response = await apiClient.get(`/resumes/${id}`);
  return response.data;
};