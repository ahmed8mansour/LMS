from django.db import models

# Create your models here.
class Order(models.Model):
    course  = models.ForeignKey('course.Course' , on_delete=models.CASCADE)
    user    = models.ForeignKey('authentication.CustomUser' , on_delete=models.CASCADE)
    status = models.CharField(max_length=255 , choices={
        ("pending","pending"),
        ("failed","failed"),
        ("paid","paid"),
        ("refunded","refunded"),
    })
    amount = models.DecimalField( max_digits=6 , decimal_places=2)
    currency =  models.CharField(max_length=255 , choices={
        ("USD","USD"),
    })
    stripe_payment_intent_id = models.TextField(null=False , blank=False)


class Transaction(models.Model):
    order  = models.ForeignKey('Order' , on_delete=models.CASCADE)
    status = models.CharField(max_length=255 , choices={
        ("pending","pending"),
        ("failed","failed"),
        ("paid","paid"),
        ("refunded","refunded"),
    })
    amount = models.DecimalField( max_digits=6 , decimal_places=2)
    currency =  models.CharField(max_length=255 , choices={
        ("usd","USD"),
    })
    stripe_payment_intent_id = models.TextField(null=False , blank=False)
    stripe_charge_id = models.TextField(null=False , blank=False)
    stripe_receipt_id = models.TextField(null=False , blank=False)
    

class Enrollment(models.Model):
    course  = models.ForeignKey('course.Course' , on_delete=models.CASCADE)
    user    = models.ForeignKey('authentication.CustomUser' , on_delete=models.CASCADE)
    order  = models.ForeignKey('Order' , on_delete=models.CASCADE)
    is_active = models.BooleanField()
    enrolled_at = models.DateTimeField(auto_now_add=True)
    