import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 90000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return Promise.reject({ response: { data: { message: "Request timed out. Please try again." } } });
    }
    if (!error.response) {
      return Promise.reject({ response: { data: { message: "Cannot connect to server. Make sure backend is running." } } });
    }
    if (error.response.status === 429) {
      const retryAfter = error.response.headers?.["retry-after"];
      const seconds = retryAfter ? ` Please try again in about ${retryAfter} seconds.` : "";
      return Promise.reject({
        ...error,
        response: {
          ...error.response,
          data: {
            ...error.response.data,
            message: (error.response.data?.message || "Too many requests. Please try again later.") + seconds,
          },
        },
      });
    }
    return Promise.reject(error);
  }
);

export default API;
