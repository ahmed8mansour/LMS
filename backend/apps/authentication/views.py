from django.shortcuts import render
from django.http import HttpResponse
from rest_framework.response import Response


from rest_framework import mixins, permissions , generics
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication


from rest_framework import status

from .models import CustomUser

from .serializers import  UserForgetPasswordSetnewoneSerializer ,UserForgetPasswordVerifyOTPSerializer, CustomUserRegisterSendOTPSerializer , UserProfileSerializer , GoogleOAuthSerializer , UserLoginSerializer , UserSetPasswordSerializer , UserChangePasswordSerializer , UserRegisterVerifyOTPSerializer , UserResnedOTPSerializer , UserForgetPasswordSendOTPSerializer, GoogleSetPasswordSendOTPSerializer, GoogleSetPasswordVerifyOTPSerializer, GoogleSetPasswordNewPasswordSerializer
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
        serializer = CustomUserRegisterSendOTPSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data , status=status.HTTP_201_CREATED)
        else:
            error = serializer.errors 
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

class UserRegisterVerifyOTPView(APIView):
    # body: {
    #     email:
    #     otp_code:
    # }

    def post(self, request):
        serializer = UserRegisterVerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            result =serializer.save()
            return Response(result , status=status.HTTP_201_CREATED)
        else:
            error = serializer.errors 
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

class UserForgetPasswordSendOTPView(APIView):
    # {body : 'email'}
    def post(self , request):
        serializer = UserForgetPasswordSendOTPSerializer(data = request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(result , status= status.HTTP_200_OK)
        else:
            error = serializer.errors
            return Response(error , status=status.HTTP_400_BAD_REQUEST)

class UserForgetPasswordVerifyOTPView(APIView):
    # {body : 'email' , 'otp_code'}
    def post(self , request):
        serializer = UserForgetPasswordVerifyOTPSerializer(data = request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(result , status= status.HTTP_200_OK)
        else:
            error = serializer.errors
            return Response(error , status=status.HTTP_400_BAD_REQUEST)

class UserForgetPasswordSetnewoneView(APIView):
    # {body : 'email' , 'new_password'}
    def post(self , request):
        serializer = UserForgetPasswordSetnewoneSerializer(data = request.data)
        if serializer.is_valid():
            result = serializer.save()
            return Response(result , status= status.HTTP_200_OK)
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
    authentication_classes = [JWTAuthentication]
    # body : {refresh:""}
    # header : acces token
    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"error_message": "Refresh token not provided"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'success_message': 'You have logged out successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error_message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    # header:{access token}
    def get(self , request):
        user = request.user
        if user : 
            try:
                serializer = UserProfileSerializer(user)
                return Response(serializer.data , status= status.HTTP_200_OK)
            except serializer.errors: 
                return Response(serializer.errors , status=status.HTTP_404_NOT_FOUND)
        else :
            Response({'error':"User Is Not Found"}, status=status.HTTP_404_NOT_FOUND)

class UserProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    # body:{data}
    # header:{access token}

    def put(self , request):
        user = request.user
        serizalizer = UserProfileSerializer(instance= user , data= request.data , partial=True)
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
            return Response(user_data, status=status.HTTP_200_OK)
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

class GoogleLoginAPIView(APIView):
    """
    Google OAuth Login/Register
    
    Body: {
        "code": "authorization_code_from_google",
        "role":"student"
    }
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = GoogleOAuthSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            return Response(
                serializer.data,
                status=status.HTTP_200_OK
            )
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
            return Response(result, status=status.HTTP_200_OK)
        else:
            error = serializer.errors
            return Response(error, status=status.HTTP_400_BAD_REQUEST)