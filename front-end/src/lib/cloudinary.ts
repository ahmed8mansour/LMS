import axiosInstance from "./axios";
import axios from 'axios';

export default async function uploadToCloudinary(file: File): Promise<string> {
    const { data: sigData } = await axiosInstance.get('/auth/user/getCloudinarySignature/');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigData.api_key);
    formData.append('timestamp', sigData.timestamp);
    formData.append('signature', sigData.signature);
    
    const { data } = await axios.post(
        `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`,
        formData,
        { timeout: 60000 }
    );
    
    return data.secure_url; 
}