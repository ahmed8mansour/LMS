from django.contrib import admin
from .models import Course , Lecture , Quiz , Section
# Register your models here.
admin.site.register(Course)
admin.site.register(Lecture)
admin.site.register(Quiz)
admin.site.register(Section)