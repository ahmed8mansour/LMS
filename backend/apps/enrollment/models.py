from django.db import models


class Order(models.Model):
    course  = models.ForeignKey('course.Course' , on_delete=models.CASCADE)
    user    = models.ForeignKey('authentication.CustomUser' , on_delete=models.CASCADE)
    status = models.CharField(max_length=255 , choices=[
        ("pending","pending"),
        ("failed","failed"),
        ("paid","paid"),
        ("refunded","refunded"),
    ])
    amount = models.DecimalField( max_digits=6 , decimal_places=2)
    currency =  models.CharField(max_length=255 , choices=[
        ("USD","USD"),
    ])
    stripe_payment_intent_id = models.TextField(null=False , blank=False)
    payment_gateway = models.CharField(max_length=20, default='stripe')
    idempotency_key = models.CharField(max_length=255, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True , null=True)


class Transaction(models.Model):
    order  = models.ForeignKey('Order' , on_delete=models.CASCADE)
    status = models.CharField(max_length=255 , choices=[
        ("pending","pending"),
        ("failed","failed"),
        ("paid","paid"),
        ("refunded","refunded"),
    ])
    amount = models.DecimalField( max_digits=6 , decimal_places=2)
    currency =  models.CharField(max_length=255 , choices=[
        ("usd","USD"),
    ])
    gateway_reference = models.TextField(null=False , blank=False)
    gateway_charge_id = models.TextField(null=True , blank=True)
    receipt_url = models.URLField(max_length=500, null=True , blank=True)
    payment_method_type = models.CharField(max_length=50, default='card')
    created_at = models.DateTimeField(auto_now_add=True , null=True)


class Enrollment(models.Model):
    course  = models.ForeignKey('course.Course' , on_delete=models.CASCADE)
    user    = models.ForeignKey('authentication.CustomUser' , on_delete=models.CASCADE)
    order  = models.ForeignKey('Order' , on_delete=models.CASCADE)
    is_active = models.BooleanField()
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'course']

class ProcessedWebhookEvent(models.Model):
    event_id = models.CharField(max_length=255, unique=True)
    gateway = models.CharField(max_length=50)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Processed Webhook Event"
        verbose_name_plural = "Processed Webhook Events"

    def __str__(self):
        return f"{self.gateway} - {self.event_id}"