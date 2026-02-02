import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
console.log('API_BASE_URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  //withCredentials: true,
  withCredentials: false,
  // headers: {
  //    'Content-Type': 'application/json',
  // },
});

// Add request interceptor
// api.interceptors.request.use(
//   (config) => {
//     console.log('API Request:', config.method?.toUpperCase(), config.url, config.data);
//     return config;
//   },
//   (error) => {
//     console.error('API Request Error:', error);
//     return Promise.reject(error);
//   }
// );

api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('access_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(
      'API Request:',
      config.method?.toUpperCase(),
      config.url,
      config.data,
      'TOKEN:',
      token ? 'YES' : 'NO'
    );

    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url, response.data);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.response?.data, error.message);
    return Promise.reject(error);
  }
);

export default api;