from django.core.mail import send_mail
from django.conf import settings


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