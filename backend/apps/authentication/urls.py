from django.urls import path
from .views import (UserRegisterSendOTPView , 
                    UserLogoutView , UserProfileView
                    , UserProfileUpdateView ,GoogleLoginAPIView , 
                    UserLoginView , UserSetPasswordView , 
                    UserChangePasswordView , UserRegisterVerifyOTPView , 
                    UserResendOTPView , UserForgetPasswordSendOTPView,
                    UserForgetPasswordVerifyOTPView,
                    UserForgetPasswordSetnewoneView,
                    GoogleSetPasswordSendOTPView,
                    GoogleSetPasswordVerifyOTPView,
                    GoogleSetPasswordNewPasswordView
                    )

from rest_framework_simplejwt.views import TokenObtainPairView , TokenRefreshView 

urlpatterns = [

    path('user/register/verifyOTP/' , UserRegisterVerifyOTPView.as_view() , name="user_verifyOTP"),
    path('user/register/sendOTP/' , UserRegisterSendOTPView.as_view() , name="user_register"),
    path('user/resendOTP/' , UserResendOTPView.as_view() , name="user_verifyOTP"),
    path('user/login/' , UserLoginView.as_view() , name="user_login"),
    path('user/logout/' , UserLogoutView.as_view() , name="user_login"),


    path('user/forgetpassword/sendOTP/' , UserForgetPasswordSendOTPView.as_view() , name="user_forget_password"),
    path('user/forgetpassword/resendOTP/' , UserForgetPasswordSendOTPView.as_view() , name="user_forget_passwordresend"),
    path('user/forgetpassword/verifyOTP/' , UserForgetPasswordVerifyOTPView.as_view() , name="user_forget_passwordverify"),
    path('user/forgetpassword/SetNewPassword/' , UserForgetPasswordSetnewoneView.as_view() , name="user_forget_passwordsetnew"),
    
    

    path('user/profile/' , UserProfileView.as_view() , name="user_profile"),
    path('user/update/' , UserProfileUpdateView.as_view() , name="user_update_profile"),
    path('user/changepassword/' , UserChangePasswordView.as_view() , name="google_changepassword"),
    


    path('google/user/register/' , GoogleLoginAPIView.as_view() , name="google_register"),
    path('google/user/login/' , GoogleLoginAPIView.as_view() , name="google_login"),
    path('google/user/setpassword/sendOTP/' , GoogleSetPasswordSendOTPView.as_view() , name="google_setpassword_sendotp"),
    path('google/user/setpassword/verifyOTP/' , GoogleSetPasswordVerifyOTPView.as_view() , name="google_setpassword_verifyotp"),
    path('google/user/setpassword/SetPassword/' , GoogleSetPasswordNewPasswordView.as_view() , name="google_setpassword_setnew"),


    path('token/refresh/' , TokenRefreshView.as_view() , name="token_refresh"),

]
