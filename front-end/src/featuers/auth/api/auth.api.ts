import axiosInstance from '@/lib/axios';
import { RegisterFormData  , UserProfileFormData } from '../schemas/auth.schma';
import {  UserChangePasswordRequest , UserChangePasswordResponse ,   ForgetPasswordResetRequest , ForgetPasswordResetResponse , RefreshAccessTokenResponse , RegisterVerifyOTP , RegisterResendOTP , LoginBody, GoogleLoginRequest , ForgetPasswordSendOTPResponse , ForgetPasswordVerifyOTPResponse , GoogleRegisterRequest, GoogleAuthResponse, UserProfile, GoogleSetPasswordVerifyOTPRequest, GoogleSetPasswordResetRequest } from "../types/auth.types";
import axios from 'axios';
// post(url , body , config)
async function userRegister(requestBody: RegisterFormData){
    const {data} = await axiosInstance.post("/auth/user/register/sendOTP/",requestBody) 
    return data
}

async function userRegisterVerifyOTP(requestBody: RegisterVerifyOTP){
    const {data } = await axiosInstance.post("/auth/user/register/verifyOTP/",requestBody)
    return data
}

async function userRegisterResendOTP(requestBody: RegisterResendOTP){
    const {data} = await axiosInstance.post("/auth/user/resendOTP/",requestBody) 
    return data
}

// the cookies will be sent [axiosInstance interceptores]
async function userProfile() : Promise<UserProfile>{
    const {data} = await axiosInstance.get("/auth/user/profile/") 
    return data
}

// the cookies will be sent [axiosInstance interceptores]
async function userLogout(){
    const {data} = await axiosInstance.post("/auth/user/logout/") 
    return data
}


async function uploadToCloudinary(file: File): Promise<string> {
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


// the cookies will be sent [axiosInstance interceptores]
async function updateUserProfile(requestBody : UserProfileFormData): Promise<UserProfile> {
    let profilePictureUrl: string | undefined;
    
    if (requestBody.profile_picture instanceof FileList && requestBody.profile_picture.length > 0) {
        profilePictureUrl = await uploadToCloudinary(requestBody.profile_picture[0]);
    }


    const { data } = await axiosInstance.put('/auth/user/update/', {
        ...requestBody,
        profile_picture: profilePictureUrl, 
    });
    return data;
}


async function userLogin(requestBody: LoginBody){
    const {data} = await axiosInstance.post("/auth/user/login/",requestBody) 
    return data
}


// Google Login Authentication
async function googleLogin(requestBody: GoogleLoginRequest): Promise<GoogleAuthResponse> {
    const { data } = await axiosInstance.post("/auth/google/user/login/", requestBody);
    return data;
}



async function googleRegister(requestBody: GoogleRegisterRequest): Promise<GoogleAuthResponse> {
    const { data } = await axiosInstance.post("/auth/google/user/register/", requestBody);
    return data;
}


// ====================================================
// ====================================================


async function ForgetPasswordSendOTP(requestBody: {email : string} ): Promise<ForgetPasswordSendOTPResponse> {
    const { data } = await axiosInstance.post("/auth/user/forgetpassword/sendOTP/", requestBody);
    return data;
}


async function ForgetPasswordVerifyOTP(requestBody:RegisterVerifyOTP ): Promise<ForgetPasswordVerifyOTPResponse> {
    const { data } = await axiosInstance.post("/auth/user/forgetpassword/verifyOTP/", requestBody);
    return data;
}

async function ForgetPasswordReset(requestBody:ForgetPasswordResetRequest ): Promise<ForgetPasswordResetResponse> {
    const { data } = await axiosInstance.post("/auth/user/forgetpassword/SetNewPassword/", requestBody);
    return data;
}

async function GoogleSetPasswordSendOTP(): Promise<ForgetPasswordSendOTPResponse> {
    const { data } = await axiosInstance.post("/auth/google/user/setpassword/sendOTP/", {});
    return data;
}

async function GoogleSetPasswordVerifyOTP(requestBody:GoogleSetPasswordVerifyOTPRequest): Promise<ForgetPasswordVerifyOTPResponse> {
    const { data } = await axiosInstance.post("/auth/google/user/setpassword/verifyOTP/", requestBody);
    return data;
}

async function GoogleSetPasswordReset(requestBody:GoogleSetPasswordResetRequest): Promise<ForgetPasswordResetResponse> {
    const { data } = await axiosInstance.post("/auth/google/user/setpassword/SetPassword/", requestBody);
    return data;
}

async function RefreshAccessToken(): Promise<RefreshAccessTokenResponse> {
    const { data } = await axiosInstance.post("/auth/token/refresh/");
    return data;
}



// ============================

async function UserChangePassword(requestBody:UserChangePasswordRequest ): Promise<UserChangePasswordResponse> {
    const { data } = await axiosInstance.post("/auth/user/changepassword/", requestBody);
    return data;
}





// ============================
// ============================

export const authAPI ={
    normalRegister:userRegister,
    normalRegisterVerify:userRegisterVerifyOTP,
    normalRegisterResend:userRegisterResendOTP,
    userProfile:userProfile,
    userLogout:userLogout,
    normalLogin:userLogin,
    googleLogin:googleLogin,
    googleRegister:googleRegister,
    ForgetPasswordSendOTP:ForgetPasswordSendOTP,
    ForgetPasswordVerifyOTP:ForgetPasswordVerifyOTP,
    ForgetPasswordReset:ForgetPasswordReset,
    GoogleSetPasswordSendOTP:GoogleSetPasswordSendOTP,
    GoogleSetPasswordVerifyOTP:GoogleSetPasswordVerifyOTP,
    GoogleSetPasswordReset:GoogleSetPasswordReset,
    RefreshToken:RefreshAccessToken,
    updateUserProfile,
    UserChangePassword
}