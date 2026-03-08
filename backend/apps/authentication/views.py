from django.shortcuts import render
from django.http import HttpResponse
from rest_framework.response import Response
from datetime import datetime, timedelta


from rest_framework import mixins, permissions , generics
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from .utils import CookieJWTAuthentication

from rest_framework import status

from .models import CustomUser

from .serializers import   GoogleLoginSerializer,GoogleRegisterSerializer, UserForgetPasswordSetnewoneSerializer ,UserForgetPasswordVerifyOTPSerializer, CustomUserRegisterSendOTPSerializer , UserDataSerializer  , UserLoginSerializer , UserSetPasswordSerializer , UserChangePasswordSerializer , UserRegisterVerifyOTPSerializer , UserResnedOTPSerializer , UserForgetPasswordSendOTPSerializer, GoogleSetPasswordSendOTPSerializer, GoogleSetPasswordVerifyOTPSerializer, GoogleSetPasswordNewPasswordSerializer
from .utils import send_otp_email, set_jwt_cookies, clear_jwt_cookies, CookieJWTAuthentication, set_password_reset_token_cookie, clear_password_reset_token_cookie
# Create your views here.

# social login imports
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from allauth.socialaccount.helpers import complete_social_login
from allauth.socialaccount.models import SocialLogin
from allauth.socialaccount.providers.oauth2.views import OAuth2LoginView

from django.conf import settings

from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import get_user_model
import requests

class UserRegisterSendOTPView(APIView):
    # body: {
#     username:
#     email:
#     password:
#     role:
# }

    def post(self, request):
        print(request.data)
        serializer = CustomUserRegisterSendOTPSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            print(serializer.data)
            return Response(serializer.data , status=status.HTTP_201_CREATED)
        else:
            errors = serializer.errors
            messages = []

            for field, field_errors in errors.items():
                for err in field_errors:
                    messages.append(str(err))

            return Response( {"error": messages}, status=400)

class UserRegisterVerifyOTPView(APIView):
    # body: {
    #     email:
    #     otp_code:
    # }

    def post(self, request):
        serializer = UserRegisterVerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save()
            response = Response(result , status=status.HTTP_201_CREATED)
            # Set JWT cookies
            user = serializer.validated_data['user']
            response = set_jwt_cookies(response, user)
            print("JWT cookies set:", response.cookies)
            return response
        else:
            error = serializer.errors 
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

class UserForgetPasswordSendOTPView(APIView):
    # {body : 'email'}
    def post(self , request):
        serializer = UserForgetPasswordSendOTPSerializer(data = request.data)
        if serializer.is_valid():
            result = serializer.save()
            response =  Response(result , status= status.HTTP_200_OK)
            response = clear_password_reset_token_cookie(response)
            return response
        else:
            error = serializer.errors
            return Response(error , status=status.HTTP_400_BAD_REQUEST)

class UserForgetPasswordVerifyOTPView(APIView):
    # {body : 'email' , 'otp_code'}
    def post(self , request):
        serializer = UserForgetPasswordVerifyOTPSerializer(data = request.data)
        if serializer.is_valid():
            result = serializer.save()
            response = Response(result , status= status.HTTP_200_OK)
            # Set reset token as HttpOnly cookie
            reset_token = serializer.context.get('reset_token')
            if reset_token:
                response = set_password_reset_token_cookie(response, reset_token)
            return response
        else:
            error = serializer.errors
            return Response(error , status=status.HTTP_400_BAD_REQUEST)

class UserForgetPasswordSetnewoneView(APIView):
    # {body : 'new_password'}
    # Gets reset_token from cookies
    def post(self , request):
        # Get reset token from cookies
        reset_token = request.COOKIES.get('password_reset_token', None)
        
        serializer = UserForgetPasswordSetnewoneSerializer(
            data=request.data,
            context={'reset_token': reset_token}
        )
        if serializer.is_valid():
            result = serializer.save()
            response = Response(result , status=status.HTTP_200_OK)
            # Clear reset token cookie after successful password reset
            response = clear_password_reset_token_cookie(response)
            # Set JWT cookies for auto-login
            user = serializer.validated_data['user']
            response = set_jwt_cookies(response, user)
            return response
        else:
            error = serializer.errors
            return Response(error , status=status.HTTP_400_BAD_REQUEST)

class UserResendOTPView(APIView):
    # {body : 'email'}
    def post(self , request):
        serializer = UserResnedOTPSerializer(data = request.data )
        if serializer.is_valid():
            result = serializer.save()
            return Response(result , status= status.HTTP_200_OK)
        else:
            error = serializer.errors
            return Response(error , status=status.HTTP_400_BAD_REQUEST)

class UserLogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]
    
    def post(self, request):
        # 1 - blacklist the refresh token :
        refresh_token = request.COOKIES.get('refresh_token', None)
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception as e:
                pass
        
        response = Response(
            {'message': 'You have logged out successfully'},
            status=status.HTTP_200_OK
        )
        
        # 2 - Clear JWT cookies
        response = clear_jwt_cookies(response)
        return response

class UserProfileView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def get(self , request):
        user = request.user
        serializer = UserDataSerializer(user)
        return Response(serializer.data , status= status.HTTP_200_OK)

class UserProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    # body:{data}
    # header:{access token}

    def put(self , request):
        user = request.user
        serizalizer = UserDataSerializer(instance= user , data= request.data , partial=True)
        if serizalizer.is_valid():
            serizalizer.save()
            return Response(serizalizer.data , status=status.HTTP_200_OK)
        return Response(serizalizer.errors , status= status.HTTP_404_NOT_FOUND)
    

class UserLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self , request):
        serializer = UserLoginSerializer(data=request.data , context ={'request': request} )
        if serializer.is_valid():
            user_data = serializer.create(serializer.validated_data)
            response = Response(user_data, status=status.HTTP_200_OK)
            # Set JWT cookies
            user = serializer.validated_data['user']
            response = set_jwt_cookies(response, user)
            return response
        else:
            return Response(serializer.errors , status=status.HTTP_400_BAD_REQUEST)
        
# ======================================
# ======================================
# ======================================

class UserChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    # header {access_token}
    # body{old_password , new_password , new_password_confirm}
    def post(self ,request):
        serializer = UserChangePasswordSerializer( data = request.data , context= {'request' : request})
        if serializer.is_valid():
            result = serializer.save()
            return Response(result , status=status.HTTP_200_OK)
        
        return Response(serializer.errors , status=status.HTTP_400_BAD_REQUEST)

class UserSetPasswordView(APIView):
    permission_classes= [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    # post :
    # header:{access_token}
    # body:{password}

    def post(self , request):
        serializer = UserSetPasswordSerializer(data = request.data , context = {'request' : request})
        if serializer.is_valid():
            result = serializer.save()
            return Response(result , status= status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class GoogleRegisterAPIView(APIView):
    """
    POST /auth/google/register/

    Body:
    {
        "code": "<authorization_code_from_google>",
        "role": "student" | "instructor"
    }

    Response (201):
    {
        "message": "Account created via Google successfully.",
        "user_data": { ... }
    }
    Tokens → HttpOnly Cookies
    """

    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = GoogleRegisterSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            response = Response(
                serializer.data,
                status=status.HTTP_200_OK
            )
            # Set JWT cookies
            user = serializer.context['user']
            
            response = set_jwt_cookies(response, user)
            return response
        else:
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )


class GoogleLoginAPIView(APIView):
    """
    POST /auth/google/login/

    Body:
    {
        "code": "<authorization_code_from_google>"
    }

    Response (200):
    {
        "message": "Google login successful.",
        "user_data": { ... }
    }
    Tokens → HttpOnly Cookies
    """

    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            response = Response(
                serializer.data,
                status=status.HTTP_200_OK
            )
            # Set JWT cookies
            user = serializer.context['user']
            response = set_jwt_cookies(response, user)
            return response
        else:
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )


# ======================================
# Google User Set Password OTP Flow
# ======================================

class GoogleSetPasswordSendOTPView(APIView):
    """
    Send OTP to Google user's email for password setup
    
    Authentication: Required (JWT token from Google login)
    Body: {} (empty - uses authenticated user)
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def post(self, request):
        serializer = GoogleSetPasswordSendOTPSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            result = serializer.save()
            return Response(result, status=status.HTTP_200_OK)
        else:
            error = serializer.errors
            return Response(error, status=status.HTTP_400_BAD_REQUEST)


class GoogleSetPasswordVerifyOTPView(APIView):
    """
    Verify OTP for Google user password setup
    
    Authentication: Required (JWT token from Google login)
    Body: {
        "otp_code": "123456"
    }
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        serializer = GoogleSetPasswordVerifyOTPSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            result = serializer.save()
            return Response(result, status=status.HTTP_200_OK)
        else:
            error = serializer.errors
            return Response(error, status=status.HTTP_400_BAD_REQUEST)


class GoogleSetPasswordNewPasswordView(APIView):
    """
    Set new password for Google user after OTP verification
    
    Authentication: Required (JWT token from Google login)
    Body: {
        "new_password": "password123",
        "new_password_confirm": "password123"
    }
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        serializer = GoogleSetPasswordNewPasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            result = serializer.save()
            response = Response(result, status=status.HTTP_200_OK)
            # Set JWT cookies (refresh tokens for password-authenticated login)
            user = serializer.validated_data['user']
            response = set_jwt_cookies(response, user)
            return response
        else:
            error = serializer.errors
            return Response(error, status=status.HTTP_400_BAD_REQUEST)


class TokenRefreshCookieView(APIView):
    """
    Custom token refresh view that uses HttpOnly cookies.
    
    - Gets refresh token from cookies
    - Generates new access token
    - Sets new access token in cookies
    - Returns success message (no tokens in body)
    
    No authentication required - uses refresh token from cookies instead.
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        try:
            # Get refresh token from HttpOnly cookie
            refresh_token = request.COOKIES.get('refresh_token')
            if not refresh_token:
                return Response(
                    {'error': 'Refresh token not found in cookies'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Validate and refresh the token
            refresh = RefreshToken(refresh_token)
            new_access_token = str(refresh.access_token)
            cookie_settings = settings.JWT_COOKIE_SETTINGS
            # Create response with success message
            response = Response(
                {'message': 'Token refreshed successfully'},
                status=status.HTTP_200_OK
            )
            
            # Set the new access token in cookie
            access_token_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=15))
            
            response.set_cookie(
                key='access_token',
                value=new_access_token,
                expires=datetime.utcnow() + access_token_lifetime,
                **cookie_settings
            )
            
            return response
            
        except Exception as e:
            print(f"TokenError: {str(e)}")
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )