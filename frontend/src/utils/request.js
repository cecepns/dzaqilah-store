import { api } from './api';
import { API_BASE_URL } from './config';

export const get = async (url, params = {}) => {
  const response = await api.get(url, { params });
  return response.data;
};

export const post = async (url, data = {}) => {
  const response = await api.post(url, data);
  return response.data;
};

export const postForm = async (url, formData) => {
  const response = await api.post(url, formData);
  return response.data;
};

export const putForm = async (url, formData) => {
  const response = await api.put(url, formData);
  return response.data;
};

export const put = async (url, data = {}) => {
  const response = await api.put(url, data);
  return response.data;
};

export const del = async (url) => {
  const response = await api.delete(url);
  return response.data;
};

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

export const formatDate = (date) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Terjadi kesalahan';

export const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const baseUrl = API_BASE_URL || 'http://localhost:5000/api';
  const serverOrigin = baseUrl.replace(/\/api\/?$/, '');
  return `${serverOrigin}${path.startsWith('/') ? path : `/${path}`}`;
};
