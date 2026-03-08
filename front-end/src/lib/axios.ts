import axios from 'axios';
import { authAPI } from '@/featuers/auth';

// const PUBLIC_ENDPOINTS = [
//     '/auth/user/register/',
//     '/auth/user/login/',
//     '/auth/user/register/verifyOTP/',
// ];



const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_DEVELOPMENT_BACKEND_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true
});

let isRefreshing = false;
let refreshSubscribers: any[] = [];

function subscribeTokenRefresh(cb: () => void) {
    refreshSubscribers.push(cb);
}
function onRefreshed() {
    refreshSubscribers.forEach((cb) => cb());
    refreshSubscribers = [];
}


axiosInstance.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config;

        if (!error.response) {
        return Promise.reject(error);
        }

        const status = error.response.status;

        if (status !== 401) {
        return Promise.reject(error);
        }

        // لا تحاول refresh إذا كان request refresh نفسه
        if (originalRequest.url.includes("/auth/token/refresh/")) {
        return Promise.reject(error);
        }

        // منع retry أكثر من مرة
        if (originalRequest._retry) {
        return Promise.reject(error);
        }

        originalRequest._retry = true;

        // إذا refresh شغال بالفعل → انتظر
        if (isRefreshing) {
        return new Promise((resolve) => {
            subscribeTokenRefresh(() => {
            resolve(axiosInstance(originalRequest));
            });
        });
        }

        isRefreshing = true;

        try {
            await axiosInstance.post("/auth/token/refresh/");

            isRefreshing = false;

            onRefreshed();

            return axiosInstance(originalRequest);

        } catch (refreshError) {

            isRefreshing = false;

            return Promise.reject(refreshError);
        }
    }
);


export default axiosInstance;