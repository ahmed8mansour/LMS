from rest_framework import serializers
from .models import CustomUser , EmailOTP, StudentProfile, InstructorProfile, AdminProfile
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from django.conf import settings
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import authenticate
from rest_framework import status
from .utils import send_otp_email
from django.forms.models import model_to_dict

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = ['id']


class InstructorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstructorProfile
        fields = ['id', 'title', 'about']


class AdminProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminProfile
        fields = ['id']


class UserDataSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 
                'role', 'is_active', 'is_email_verified', 'date_joined' , 'can_change_password', 'profile']
        read_only_fields = fields
    
    def get_profile(self, obj):
        """Return the appropriate profile based on user role"""
        if obj.role == 'student':
            try:
                profile = StudentProfile.objects.get(user=obj)
                return StudentProfileSerializer(profile).data
            except StudentProfile.DoesNotExist:
                return None
        elif obj.role == 'instructor':
            try:
                profile = InstructorProfile.objects.get(user=obj)
                return InstructorProfileSerializer(profile).data
            except InstructorProfile.DoesNotExist:
                return None
        elif obj.role == 'admin':
            try:
                profile = AdminProfile.objects.get(user=obj)
                return AdminProfileSerializer(profile).data
            except AdminProfile.DoesNotExist:
                return None
        return None  

class CustomUserRegisterSendOTPSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        exclude = ['groups', 'user_permissions','is_staff' , 'is_superuser']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        role= validated_data['role']
        
        print(validated_data)
        if role == 'student':
            user = CustomUser.objects.create_user(**validated_data)
        elif role == 'instructor':
            user = CustomUser.objects.create_instructor(**validated_data)
        elif role == 'admin':
            user = CustomUser.objects.create_superuser(**validated_data)
        else:
            raise serializers.ValidationError({'error_message': 'role not provided'})
        
        user.is_active = False
        user.is_email_verified = False
        user.save()
        otp = EmailOTP.create_otp(user , purpose='registration')
        send_otp_email(user , otp.code , purpose='registration')

        self.context['user'] = user
        self.context['otp_sent'] = True
        return user
        # refresh = RefreshToken.for_user(user)
        # self.context['refresh'] = refresh
        # return user

    def to_representation(self, instance):

        data = super().to_representation(instance)
        print(data)
        print(data)
        response_data={
            'message':'Registration successful! Please check your email for OTP.' ,
            'user_data':data,
            'next_step': 'verify_otp',
            'otp_sent': self.context.get('otp_sent', False)
        }
        return response_data
        # refresh = self.context['refresh']

        # response_data = {
        #     'message' : 'Register done successfully',
        #     'user_data':data , 
        #     'tokens':{
        #         'refresh':str(refresh),
        #         'access':str(refresh.access_token),
        #     }
        # }
        
        # return response_data

# only for registration > not requiers JWT
class UserResnedOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, data):
        email = data.get('email')
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({
                'error':'User Not Found'
            })
        
        user = CustomUser.objects.get(email=email)
        last_otp = EmailOTP.objects.filter(user=user, purpose='registration').latest('created_at')

        if user.is_active and user.is_email_verified:
            raise serializers.ValidationError({
                "error":'This account is already verified'
            })
        if last_otp.is_valid():
            raise serializers.ValidationError({
                'error':"Your OTP hasn't expired , please use it"
            })
        return data
    
    def save(self):

        email = self.validated_data['email']
        user = CustomUser.objects.get(email=email)
        new_otp = EmailOTP.create_otp(user=user , purpose='registration')
        send_otp_email(user=user , otp_code=new_otp.code ,purpose='registration' )

        response_data={
            'message':'Resent OTP successful! Please check your email for OTP.' ,
            'next_step': 'verify_otp',
            
        }

        return response_data


class UserRegisterVerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)

    def validate(self, data):
        email = data.get('email')
        otp_code = data.get('otp_code')

        try : 
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({
                'error':'User Not Found'
            })
        
        try:
            otp = EmailOTP.objects.get(user=user, code=otp_code, purpose='registration', is_used=False)
        except EmailOTP.DoesNotExist:
            raise serializers.ValidationError({
                'error':'Invalid OTP code'
            })
        
        if not otp.is_valid():
            raise serializers.ValidationError({
                'error':'OTP CODE has expired. Please request a new one.'
            })
        
        data['user'] = user
        data['otp'] = otp
        return data
    
    def save(self, **kwargs):
        user = self.validated_data['user']
        otp = self.validated_data['otp']

        user.is_active = True
        user.is_email_verified = True
        user.save()

        otp.is_used = True
        otp.save()
        user_data = UserDataSerializer(user).data

        refresh = RefreshToken.for_user(user=user)
        return {
            'message':'Email verified successfully! You can now login',
            'user_data':user_data,
            'tokens':{
                'refresh':str(refresh),
                'access':str(refresh.access_token),
            }
        }



# ==================
# ==================
# ==================
class UserForgetPasswordSendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, data):
        email = data.get('email')
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({
                'error':'User Is Not Found'
            })

        if not user.has_usable_password():
            raise serializers.ValidationError({
                'error':"Sign in with google then set a password"
            })

        return super().validate(data)
    
    
    def save(self, **kwargs):
        email = self.validated_data['email']
        user = CustomUser.objects.get(email=email)
        otp_code = EmailOTP.create_otp(user=user , purpose='forget_password')
        send_otp_email(user=user , otp_code=otp_code.code , purpose='forget_password')
        return {
            'message':'Please Check ur Email , and Fill the OTP to change ur password',
            'next_step':"fill the otp then add new password"
        }

class UserForgetPasswordVerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)

    def validate(self, data):
        email = data.get('email')
        otp_code = data.get('otp_code')

        try:
            user = CustomUser.objects.get(email = email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({
                'error':'User Is Not Found'
            })
        
        try:
            otp = EmailOTP.objects.get(user=user, code=otp_code, purpose='forget_password', is_used=False)
        except EmailOTP.DoesNotExist:
            raise serializers.ValidationError({
                'error':'Invalid OTP code'
            })
        
        if not otp.is_valid():
            raise serializers.ValidationError({
                'error':'OTP CODE has expired. Please request a new one.'
            })
        data['user'] = user
        return data
    
    def save(self, **kwargs):
        user = self.validated_data['user']
        data= UserDataSerializer(user).data
        user.can_change_password = True
        data = UserDataSerializer(user).data
        user.save()

        print(data)

        return {
            'message': 'OTP verified successfully. You can now reset your password.',
            'email': user.email,
            'can_change_password': True, # مهم جدا 
            # ممكن يكون الايميل verified وهادي لااا 
            
        }


class UserForgetPasswordSetnewoneSerializer(serializers.Serializer):
    email= serializers.EmailField()
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, data):
        email = data.get('email')
        new_password = data.get('new_password')

        try:
            user = CustomUser.objects.get(email = email)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({
                'error':'User is not Found'
            })
        if not user.can_change_password:
            raise serializers.ValidationError({
                'error':'Please use The sent OTP to verify your account'
            })

        data['user']=user
        data['new_password'] = new_password
        return data
    
    def save(self, **kwargs):
        user = self._validated_data['user']
        new_password = self._validated_data['new_password']

        user.set_password(new_password)
        user.can_change_password = False
        user.is_active = True
        user.is_email_verified = True
        user.save()

        refresh = RefreshToken.for_user(user=user)
        user_data = UserDataSerializer(user).data
        data={
            'message':  'Set new Password is Successful',
            'user_data':user_data,
            'tokens':{
                'refresh':str(refresh),
                'access':str(refresh.access_token),
            }
        }
        
        return data

class UserProfileSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        exclude = ['groups', 'user_permissions' , 'is_staff'  , 'is_superuser' , 'password']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def get_profile(self, obj):
        """Return the appropriate profile based on user role"""
        if obj.role == 'student':
            try:
                profile = StudentProfile.objects.get(user=obj)
                return StudentProfileSerializer(profile).data
            except StudentProfile.DoesNotExist:
                return None
        elif obj.role == 'instructor':
            try:
                profile = InstructorProfile.objects.get(user=obj)
                return InstructorProfileSerializer(profile).data
            except InstructorProfile.DoesNotExist:
                return None
        elif obj.role == 'admin':
            try:
                profile = AdminProfile.objects.get(user=obj)
                return AdminProfileSerializer(profile).data
            except AdminProfile.DoesNotExist:
                return None
        return None
    
class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    
    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        request = self.context.get('request')
        try:
            user = CustomUser.objects.get(email=email)
            if not user.is_active:
                raise serializers.ValidationError({
                    'error': 'Account is disabled. Please verify your email.',
                })
            # اعمل هنا functionality 
            # 1- يبعت otp
            # 2- verify
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({
                'error': 'Invalid email or password'
            })
        
        if not user.has_usable_password():
            socialaccount = SocialAccount.objects.filter(user=user).first()
            provider = socialaccount.provider if socialaccount else "social login"
            raise serializers.ValidationError({
                'error': f'This account was created using {provider}.',
                'suggestion': f'Please sign in with {provider} now, then set a password.',
                'login_method': provider,
                'oauth_required': True
            })
        
        user = authenticate(request,email=email, password=password)
        if not user:
            raise serializers.ValidationError({
                'error': 'Invalid email or password'
            })
        

        data['user'] = user
        return data



    def create(self, validated_data):
        user = validated_data['user']
        refresh = RefreshToken.for_user(user)
        user_data = UserDataSerializer(user).data

        return {
            'message': 'login successful',
            'user_data': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            }
        }


class UserSetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    
    def validate(self, data):
        user  = self.context.get('request').user
        new_password  = data.get('password')
        

        if user.has_usable_password():
            raise serializers.ValidationError({
                'error':'You already have a password. Use "Change Password" instead.'
            })
        
        return data

    def save(self):
        user = self.context.get('request').user
        new_password = self.validated_data['password']
        user.set_password(new_password)
        user.save()
        return {
            'message':'set password for social login user is done',
            'can_use_password_login': True
        }

class UserChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})
    
    def validate(self, data):
        user  = self.context.get('request').user
        old_password  = data.get('old_password')
        new_password  = data.get('new_password')
        new_password_confirm  = data.get('new_password_confirm')

        if not user.has_usable_password():
            raise serializers.ValidationError({
                'error':"You Don't have a password . Set a password first."
            })  
        
        if not user.check_password(old_password):
            raise serializers.ValidationError({
                'error':"Current password is incorrect"
            })

        if new_password != new_password_confirm:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match'
            })

        else :
            return data

    def save(self):
        user = self.context.get('request').user
        new_password = self.validated_data['new_password']
        user.set_password(new_password)
        user.save()
        return {
            'message':'Password changed successfully',
        }


class GoogleOAuthSerializer(serializers.Serializer):
    """
    Serializer للتعامل مع Google OAuth
    يستقبل الـ code والـ role ويرجع user data + tokens
    """
    code = serializers.CharField(required=True, write_only=True)
    role = serializers.ChoiceField(
        choices=['student', 'instructor', 'admin'],
        required=True,
        write_only=True
    )
    
    def validate_code(self, value):
        if not value:
            raise serializers.ValidationError("Authorization code is required")
        return value
    
    def validate_role(self, value):
        """التحقق من صحة الـ role"""
        valid_roles = ['student', 'instructor', 'admin']
        if value not in valid_roles:
            raise serializers.ValidationError(
                f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        return value
    
    def create(self, validated_data):
        code = validated_data.get('code')
        role = validated_data.get('role')
        # 1- 
        # عملية تبادل الاكواد (اعطيني كود من الفرونت وبعطيك اكسس توكن بتوصل منه للبيانات )
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["client_id"],
            "client_secret": settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["secret"],
            "redirect_uri": "http://localhost:3000",
            "grant_type": "authorization_code",
        }
        
        try:
            token_response = requests.post(token_url, data=token_data, timeout=10)
            token_json = token_response.json()
            
            if "error" in token_json:
                raise serializers.ValidationError({
                    "google_error": token_json.get("error_description", "Failed to exchange code")
                })
            
            access_token = token_json.get("access_token")
            # 2- الخطوة الثانية 
            # ابعت الاكسس توكن لجوجل واحصل على بيانات المستخدم بعدها انت حر سجله يوزر جديد اعمل الي بدك اياه 
            user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            user_info_response = requests.get(user_info_url, headers=headers, timeout=10)
            user_info = user_info_response.json()
            
            if "error" in user_info:
                raise serializers.ValidationError({
                    "google_error": "Failed to get user info from Google"
                })
            #  استخراج البيانات من Google
            email = user_info.get("email")
            google_id = user_info.get("id")
            given_name = user_info.get("given_name", "")
            family_name = user_info.get("family_name", "")
            picture = user_info.get("picture", "")
            
            if not email:
                raise serializers.ValidationError({
                    "email": "Email not provided by Google"
                })
            
            #  البحث عن المستخدم أو إنشاء واحد جديد
            user = None
            created = False
            
            try:
                # المستخدم موجود - Login
                user = CustomUser.objects.get(email=email)
                
                # ربط الحساب بـ Google إذا لم يكن مربوط
                social_account, _ = SocialAccount.objects.get_or_create(
                    user=user,
                    provider="google",
                    defaults={
                        "uid": google_id,
                        "extra_data": user_info,
                    }
                )
                
            except CustomUser.DoesNotExist:
                # المستخدم غير موجود - Register
                username = email.split("@")[0]
                
                # التأكد من عدم تكرار الـ username
                base_username = username
                counter = 1
                while CustomUser.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1
                
                #  استخدام CustomUserManager بناءً على الـ role
                user_data = {
                    'username': username,
                    'email': email,
                    'first_name': given_name,
                    'last_name': family_name,
                    'role': role,
                    'is_active': True,
                    'is_email_verified': True,
                }
                
                # استخدام الـ Manager المناسب
                if role == 'student':
                    user = CustomUser.objects.create_user(**user_data)
                elif role == 'instructor':
                    user = CustomUser.objects.create_instructor(**user_data)
                elif role == 'admin':
                    user = CustomUser.objects.create_superuser(**user_data)
                else:
                    raise serializers.ValidationError({
                        'role': f'Invalid role: {role}'
                    })
                
                # عدم تعيين password لأنه يستخدم Google OAuth
                user.set_unusable_password()
                user.is_active = True
                user.save()
                created = True
                
                # ربط الحساب بـ Google
                SocialAccount.objects.create(
                    user=user,
                    provider="google",
                    uid=google_id,
                    extra_data=user_info,
                )
            
            #  توليد JWT tokens
            refresh = RefreshToken.for_user(user)
            
            # حفظ البيانات للـ to_representation
            self.context['user'] = user
            self.context['refresh'] = refresh
            self.context['created'] = created
            self.context['picture'] = picture
            
            return user
            
        except requests.RequestException as e:
            raise serializers.ValidationError({
                "network_error": f"Failed to communicate with Google: {str(e)}"
            })
    
    def to_representation(self, instance):

        user = self.context['user']
        refresh = self.context['refresh']
        created = self.context.get('created', False)
        picture = self.context.get('picture', '')
        user_data = UserDataSerializer(user).data
        user_data['profile_picture'] = picture
        
        response_data = {
            'message': 'Account created via Google successfully' if created else 'Google login successful',
            'user_data': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }
        
        return response_data


# ==========================================
# Google Set Password OTP Flow
# ==========================================

class GoogleSetPasswordSendOTPSerializer(serializers.Serializer):
    """
    Send OTP to Google user's email to set first password
    Requires: JWT authentication (user must be logged in)
    Body: {} (empty - uses authenticated user)
    """

    def validate(self, data):
        user = self.context.get('request').user
        
        try:
            social_account = SocialAccount.objects.get(user=user, provider='google')
        except SocialAccount.DoesNotExist:
            raise serializers.ValidationError({
                'error': 'This user is not a Google OAuth user'
            })
        
        if user.has_usable_password():
            raise serializers.ValidationError({
                'error': 'This user has already set a password'
            })
        
        data['user'] = user
        return data
    
    def save(self, **kwargs):
        user = self.validated_data['user']
        otp_code = EmailOTP.create_otp(user=user, purpose='google_set_password')
        send_otp_email(user=user, otp_code=otp_code.code, purpose='google_set_password')
        return {
            'message': 'OTP sent successfully! Please check your email.',
            'email': user.email,
            'next_step': 'verify_otp'
        }


class GoogleSetPasswordVerifyOTPSerializer(serializers.Serializer):
    """
    Verify OTP for Google user password setup
    Requires: JWT authentication (user must be logged in)
    Body: {
        "otp_code": "123456"
    }
    """
    otp_code = serializers.CharField(max_length=6, min_length=6)

    def validate(self, data):
        otp_code = data.get('otp_code')
        user = self.context.get('request').user

        try:
            social_account = SocialAccount.objects.get(user=user, provider='google')
        except SocialAccount.DoesNotExist:
            raise serializers.ValidationError({
                'error': 'This user is not a Google OAuth user'
            })
        
        try:
            otp = EmailOTP.objects.get(user=user, code=otp_code, purpose='google_set_password')
        except EmailOTP.DoesNotExist:
            raise serializers.ValidationError({
                'error': 'Invalid OTP code'
            })
        
        if not otp.is_valid():
            raise serializers.ValidationError({
                'error': 'OTP has expired or already been used'
            })
        
        data['user'] = user
        data['otp'] = otp
        return data
    
    def save(self, **kwargs):
        user = self.validated_data['user']
        otp = self.validated_data['otp']

        # Set authorization flag to allow password change
        user.can_change_password = True
        user.save()
        
        # Mark OTP as used
        otp.is_used = True
        otp.save()

        return {
            'message': 'OTP verified successfully. You can now set your password.',
            'email': user.email,
            'can_change_password': True,
            'next_step': 'set_password'
        }


class GoogleSetPasswordNewPasswordSerializer(serializers.Serializer):
    """
    Set new password for Google user after OTP verification
    Requires: JWT authentication (user must be logged in)
    Body: {
        "new_password": "password123",
        "new_password_confirm": "password123"
    }
    """
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, data):
        user = self.context.get('request').user
        new_password = data.get('new_password')
        new_password_confirm = data.get('new_password_confirm')
        
        if new_password != new_password_confirm:
            raise serializers.ValidationError({
                'new_password_confirm': 'Passwords do not match'
            })
        
        if not user.can_change_password:
            raise serializers.ValidationError({
                'error': 'Please verify the OTP sent to your email first'
            })
        
        if user.has_usable_password():
            raise serializers.ValidationError({
                'error': 'This user has already set a password'
            })

        data['user'] = user
        data['new_password'] = new_password
        return data
    
    def save(self, **kwargs):
        user = self.validated_data['user']
        new_password = self.validated_data['new_password']

        # Set the password and reset authorization flag
        user.set_password(new_password)
        user.can_change_password = False
        user.save()

        refresh = RefreshToken.for_user(user=user)
        user_data = UserDataSerializer(user).data
        
        return {
            'message': 'Password set successfully! You can now use email/password login.',
            'user_data': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }