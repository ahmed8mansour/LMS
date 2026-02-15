from django.contrib import admin
from .models import CustomUser,EmailOTP,StudentProfile,InstructorProfile,AdminProfile
# Register your models here.

admin.site.register(CustomUser)
admin.site.register(EmailOTP)
admin.site.register(StudentProfile)
admin.site.register(InstructorProfile)
admin.site.register(AdminProfile)