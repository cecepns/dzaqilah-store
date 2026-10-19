// export const API_BASE_URL = 'http://localhost:5000/api'
// export const API_BASE_URL = 'https://api.kingcreativestudio.my.id/dzaqilah-store/api'
export const API_BASE_URL =
  import.meta.env?.VITE_API_URL ||
  import.meta.env?.API_BASE_URL ||
  'https://api.dzaqilah-store.my.id/api';