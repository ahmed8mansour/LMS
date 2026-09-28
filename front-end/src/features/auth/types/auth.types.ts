// export interface RegisterFromData {
//     username : string 
//     email : string 
//     password : string 
//     role : string 
// }

export interface UserProfile {
    id: number
    specific_data: SpecificData
    last_login: string
    profile_picture: string
    username: string
    first_name: string
    last_name: string
    email: string
    role: UserRole
    is_active: boolean
    is_email_verified: boolean
    date_joined: string
    has_usable_password: boolean
}

export type UserRole = 'student' | 'instructor' | 'admin'

// `specific_data` is the role-dependent profile row. Students have no extra fields,
// instructors carry the public bio, and a staff account with no profile row gets null.
export interface InstructorSpecificData {
    title: string
    about: string
    students_count: number
}

export type StudentSpecificData = Record<string, never>

export type SpecificData = InstructorSpecificData | StudentSpecificData | null

// Narrowing helper: the only safe way to read title/about off a UserProfile.
export function getInstructorProfile(user?: Pick<UserProfile, 'role' | 'specific_data'>): InstructorSpecificData | null {
    if (!user || user.role !== 'instructor' || !user.specific_data) return null
    return user.specific_data as InstructorSpecificData
}



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
    user_data: UserData;
}

export interface ForgetPasswordResetRequest {
    new_password: string;
}

export interface GoogleSetPasswordVerifyOTPRequest {
    otp_code: string;
}

export interface GoogleSetPasswordResetRequest {
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
    profile: SpecificData
}




// ===============================

export interface UserChangePasswordRequest {
    old_password: string;
    new_password: string;
    new_password_confirm: string;
}

export interface UserChangePasswordResponse {
    message: string;
}
