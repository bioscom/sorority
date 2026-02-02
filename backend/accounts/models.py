from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _ # Added for internationalization

class User(AbstractUser):
    """Custom User model extending Django's AbstractUser"""
    email = models.EmailField(_("email address"), unique=True)
    first_name = models.CharField(_("first name"), max_length=30, blank=False)
    last_name = models.CharField(_("last name"), max_length=30, blank=False)
    date_joined = models.DateTimeField(_("date joined"), auto_now_add=True)
    is_verified = models.BooleanField(_("is verified"), default=False, help_text=_("Designates whether the user's email has been verified."))
    phone_country_code = models.CharField(_("phone country code"), max_length=6, blank=True, help_text=_("E.164 dialing prefix detected from the user's location."))
    phone_number = models.CharField(_("phone number"), max_length=20, blank=True, help_text=_("Primary contact phone number without the country prefix."))
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

    @property
    def full_phone_number(self):
        if self.phone_country_code and self.phone_number:
            return f"{self.phone_country_code}{self.phone_number}"
        return self.phone_number
