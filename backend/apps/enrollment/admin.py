from django.contrib import admin
from .models import Order , Transaction , Enrollment
# Register your models here.

admin.site.register(Order)
admin.site.register(Transaction)
admin.site.register(Enrollment)
