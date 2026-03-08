// export interface RegisterFromData {
//     username : string 
//     email : string 
//     password : string 
//     role : string 
// }

export interface RegisterVerifyOTP {
    email : string
    otp_code : string 
}


export interface RegisterResendOTP {
    email : string
}
export interface LoginBody {
    email : string,
    password : string
}



// ====================
export interface GoogleRegisterRequest {
    code: string;
    role: 'student' | 'instructor';
}
export interface GoogleLoginRequest {
    code: string;
}


export interface GoogleAuthResponse {
    message: string;
    user_data: UserData;
}


// ==============================

export interface ForgetPasswordSendOTP {
    email: string;
}

export interface ForgetPasswordSendOTPResponse {
    message: string;
    next_step: string;
}


export interface ForgetPasswordVerifyOTPResponse {
    message: string;
    next_step: string;
}



export interface ForgetPasswordResetResponse {
    message: string;
    user_data: string;
}

export interface ForgetPasswordResetRequest {
    new_password: string;
}




// ==============================


export interface RefreshAccessTokenResponse {
    message: string;
}




// resendOTP RESPONSE 
export interface ResendOTPResponse {
  message: string
  next_step: string
}

// verifyOTP RESPONSE 



export interface VerifyOTPResponse {
    message: string
    user_data: UserData
    tokens: Tokens
}

export interface UserData {
    id: number
    email: string
    username: string
    first_name: string
    last_name: string
    role: string
    is_active: boolean
    is_email_verified: boolean
    date_joined: string
    profile: any
}

export interface Tokens {
    refresh: string
    access: string
}
