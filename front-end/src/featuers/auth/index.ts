import { authAPI } from "./api/auth.api";
export { RegisterForm } from "./components/RegisterForm";
export { UserAvater } from "./components/UserAvater";
export {LoginForm} from "./components/LoginForm"
export { GoogleLoginButton } from "./components/GoogleLoginButton";
export { GoogleRegisterButton } from "./components/GoogleRegisterButton";
export {FPsendOTPForm} from "./components/froget-password/SendOTPForm"
export {FPverifyOTPForm} from "./components/froget-password/verifyOTPForm";
export {ResetPasswordForm} from "./components/froget-password/ResetPasswordForm";
// Hooks
export { useGoogleLogin2 } from "./hooks/useGoogleLogin";
export {useGoogleRegister} from "./hooks/useGoogleRegister"
export { useResetPassword } from "./hooks/forget-password/useResetPassword";
export {authAPI} from "./api/auth.api"