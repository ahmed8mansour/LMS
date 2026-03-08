from django.core.mail import send_mail
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from datetime import datetime, timedelta
import requests
from rest_framework import serializers


# ============================================================
#  Helper مسؤول فقط عن التواصل مع Google API
# ============================================================


def exchange_code_for_user_info(code: str) -> dict:
    """
    1- Exchange the authorization code for an access token 
    2- retrieve user info from Google. (using the access token)
    """
    token_url = settings.GET_GOOGLE_ACCESS_TOKEN_URL
    token_data = {
        "code": code,
        "client_id": settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["client_id"],
        "client_secret": settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["secret"],
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    try:
        token_response = requests.post(token_url, data=token_data, timeout=10)
        token_json = token_response.json()
    except requests.RequestException as e:
        raise serializers.ValidationError(
            {"network_error": f"Failed to communicate with Google: {str(e)}"}
        )

    if "error" in token_json:
        raise serializers.ValidationError(
            {"google_error": token_json.get("error_description", "Failed to exchange code")}
        )

    access_token = token_json.get("access_token")

    try:
        user_info_response = requests.get(
            settings.GET_GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        user_info = user_info_response.json()
    except requests.RequestException as e:
        raise serializers.ValidationError(
            {"network_error": f"Failed to get user info from Google: {str(e)}"}
        )

    if "error" in user_info:
        raise serializers.ValidationError(
            {"google_error": "Failed to get user info from Google"}
        )

    if not user_info.get("email"):
        raise serializers.ValidationError(
            {"email": "Email not provided by Google"}
        )

    return user_info




# ==============================
# Custom JWT Authentication
# ==============================

class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that supports both:
    1. HttpOnly cookies (access_token)
    2. Authorization header (Bearer token) - for backward compatibility
    
    Priority: Authorization header > HttpOnly cookies
    """
    
    def authenticate(self, request):
        """
        Extract JWT from cookies or Authorization header and authenticate.
        """
        # First, try to get token from Authorization header (preferred for flexibility)
        raw_token = self.get_header(request)
        # If no header token, try to get from cookies
        if raw_token is None:
            raw_token = request.COOKIES.get('access_token', None)
            
            if raw_token is None:
                return None  # No authentication info provided
        
        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken as exc:
            raise AuthenticationFailed(_('Invalid token.')) from exc
        return self.get_user(validated_token), validated_token


# ==============================
# Cookie Utility Functions
# ==============================


def set_jwt_cookies(response, user):
    """
    Set access and refresh tokens as HttpOnly cookies in the response.
    
    Args:
        response: The HTTP response object
        user: The authenticated user object
    
    Returns:
        The response with cookies set
    """
    cookie_settings = settings.JWT_COOKIE_SETTINGS
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)
    
    # Calculate cookie expiration times
    access_token_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=15))
    refresh_token_lifetime = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME', timedelta(days=7))
    
    # Set access token cookie
    response.set_cookie(
        key='access_token',
        value=access_token,
        expires=datetime.utcnow() + access_token_lifetime,
        **cookie_settings
    )
    
    # Set refresh token cookie
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        expires=datetime.utcnow() + refresh_token_lifetime,
        **cookie_settings

    )
    
    return response


def set_password_reset_token_cookie(response, reset_token):
    """
    Set password reset token as HttpOnly cookie in the response.
    
    Args:
        response: The HTTP response object
        reset_token: The PasswordResetToken object
    
    Returns:
        The response with the token cookie set
    """
    cookie_settings = settings.JWT_COOKIE_SETTINGS
    
    # Use token expiration time
    expires = reset_token.expires_at
    
    response.set_cookie(
        key='password_reset_token',
        value=reset_token.token,
        expires=expires,
        **cookie_settings
    )
    
    return response


def clear_jwt_cookies(response):
    """
    Clear JWT cookies from the response (used for logout).
    
    Args:
        response: The HTTP response object
    
    Returns:
        The response with cookies cleared
    """
    response.delete_cookie(
        key='access_token',
        path='/',
        samesite='Lax',
    )
    response.delete_cookie(
        key='refresh_token',
        path='/',
        samesite='Lax',
    )
    return response


def clear_password_reset_token_cookie(response):
    """
    Clear password reset token cookie from the response.
    
    Args:
        response: The HTTP response object
    
    Returns:
        The response with the token cookie cleared
    """
    response.delete_cookie(
        key='password_reset_token',
        path='/',
        samesite='Lax',
    )
    return response


def send_otp_email(user, otp_code, purpose='registration'):

    subject_map = {
        'registration': 'Verify Your Email - OTP Code',
        'password_reset': 'Reset Your Password - OTP Code',
        'login': 'Two-Factor Authentication - OTP Code',
    }
    
    subject = subject_map.get(purpose, 'Your OTP Code')
    
    
    plain_message = f"""
    Hello {user.first_name or user.username}!
    
    Your OTP code is: {otp_code}
    
    This code will expire in 10 minutes     .
    If you didn't request this code, please ignore this email.
    """

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False