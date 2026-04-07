from django.apps import AppConfig

class EnrollmentConfig(AppConfig):
    name = 'apps.enrollment'
    
    def ready(self):
        super().ready()
        import apps.enrollment.signals
