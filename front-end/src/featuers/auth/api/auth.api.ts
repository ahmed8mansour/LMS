import axios from '@/lib/axios';
import { RegisterFormData  } from '../schemas/auth.schma';
import { ForgetPasswordResetRequest , ForgetPasswordResetResponse , RefreshAccessTokenResponse , RegisterVerifyOTP , RegisterResendOTP , LoginBody, GoogleLoginRequest , ForgetPasswordSendOTPResponse , ForgetPasswordVerifyOTPResponse , GoogleRegisterRequest, GoogleAuthResponse  } from "../types/auth.types";

// post(url , body , config)
async function userRegister(requestBody: RegisterFormData){
    const {data} = await axios.post("/auth/user/register/sendOTP/",requestBody) 
    return data
}

async function userRegisterVerifyOTP(requestBody: RegisterVerifyOTP){
    const {data } = await axios.post("/auth/user/register/verifyOTP/",requestBody)
    return data
}

async function userRegisterResendOTP(requestBody: RegisterResendOTP){
    const {data} = await axios.post("/auth/user/resendOTP/",requestBody) 
    return data
}

// the cookies will be sent [axios interceptores]
async function userProfile(){
    const {data} = await axios.get("/auth/user/profile/") 
    return data
}

// the cookies will be sent [axios interceptores]
async function userLogout(){
    const {data} = await axios.post("/auth/user/logout/") 
    return data
}



async function userLogin(requestBody: LoginBody){
    const {data} = await axios.post("/auth/user/login/",requestBody) 
    return data
}


// Google Login Authentication
async function googleLogin(requestBody: GoogleLoginRequest): Promise<GoogleAuthResponse> {
    const { data } = await axios.post("/auth/google/user/login/", requestBody);
    return data;
}



async function googleRegister(requestBody: GoogleRegisterRequest): Promise<GoogleAuthResponse> {
    const { data } = await axios.post("/auth/google/user/register/", requestBody);
    return data;
}


// ====================================================
// ====================================================


async function ForgetPasswordSendOTP(requestBody: {email : string} ): Promise<ForgetPasswordSendOTPResponse> {
    const { data } = await axios.post("/auth/user/forgetpassword/sendOTP/", requestBody);
    return data;
}


async function ForgetPasswordVerifyOTP(requestBody:RegisterVerifyOTP ): Promise<ForgetPasswordVerifyOTPResponse> {
    const { data } = await axios.post("/auth/user/forgetpassword/verifyOTP/", requestBody);
    return data;
}

async function ForgetPasswordReset(requestBody:ForgetPasswordResetRequest ): Promise<ForgetPasswordResetResponse> {
    const { data } = await axios.post("/auth/user/forgetpassword/SetNewPassword/", requestBody);
    return data;
}

async function RefreshAccessToken(): Promise<RefreshAccessTokenResponse> {
    const { data } = await axios.post("/auth/token/refresh/");
    return data;
}



// ============================
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
    RefreshToken:RefreshAccessToken,
}