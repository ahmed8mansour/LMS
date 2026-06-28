export { RegisterForm } from "./components/RegisterForm";
export { UserAvater } from "./components/UserAvater";
export {LoginForm} from "./components/LoginForm"
export { GoogleLoginButton } from "./components/GoogleLoginButton";
export { GoogleRegisterButton } from "./components/GoogleRegisterButton";
export {FPsendOTPForm} from "./components/froget-password/SendOTPForm"
export {FPverifyOTPForm} from "./components/froget-password/verifyOTPForm";
export {ResetPasswordForm} from "./components/froget-password/ResetPasswordForm";
export { UserChangePassword } from "./components/dashboard/settings/UserChangePassword";
export { PasswordManager } from "./components/dashboard/settings/UserPasswordManager";
// Hooks
export { useGoogleLogin2 } from "./hooks/useGoogleLogin";
export {useGoogleRegister} from "./hooks/useGoogleRegister"
export { useResetPassword } from "./hooks/forget-password/useResetPassword";
export { useGoogleSetPasswordSendOTP } from "./hooks/forget-password/useGoogleSetPasswordSendOTP";
export { useGoogleSetPasswordVerifyOTP } from "./hooks/forget-password/useGoogleSetPasswordVerifyOTP";
export { useGoogleSetPasswordReset } from "./hooks/forget-password/useGoogleSetPasswordReset";
export {authAPI} from "./api/auth.api"
export { useProfile } from "./hooks/useProfile";
export { useLogout } from "./hooks/useLogout";