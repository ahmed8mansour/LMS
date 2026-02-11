from django.contrib import admin
from .models import CustomUser,EmailOTP
# Register your models here.

admin.site.register(CustomUser)
admin.site.register(EmailOTP)