from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.conf import settings # Import settings
from django.utils.text import slugify
import requests

#User = get_user_model()

class Profile(models.Model):
    """User profile with dating-specific information"""
    GENDER_CHOICES = [
        ('Male', _('Male')),
        ('Female', _('Female')),
        ('Other', _('Other')),
        ('Prefer not to say', _('Prefer not to say')),
    ]
    
    LOOKING_FOR_CHOICES = [
        ('Long-term relationship', _('Long-term relationship')),
        ('Short-term relationship', _('Short-term relationship')),
        ('Friendship', _('Friendship')),
        ('Casual dating', _('Casual dating')),
    ]
    
    RELATIONSHIP_CHOICES = [
        ('Single', _('Single')),
        ('In a relationship', _('In a relationship')),
        ('Married', _('Married')),
    ]

    # Dynamically get language choices from settings
    LANGUAGE_CHOICES = [(lang[0], _(lang[1])) for lang in settings.LANGUAGES]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    slug = models.SlugField(_("slug"), max_length=100, unique=True, blank=True, help_text=_("URL-friendly identifier for the profile."))
    bio = models.TextField(_("bio"), max_length=500, blank=True, help_text=_("A short biography about yourself."))
    bio_is_moderated = models.BooleanField(default=False)
    bio_is_safe = models.BooleanField(default=False)
    bio_moderation_score = models.FloatField(null=True, blank=True)
    bio_rejection_reason = models.TextField(blank=True)
    date_of_birth = models.DateField(_("date of birth"), null=True, blank=True) # New field
    gender = models.CharField(_("gender"), max_length=20, choices=GENDER_CHOICES)
    looking_for = models.CharField(_("looking for"), max_length=25, choices=LOOKING_FOR_CHOICES)
    relationship_status = models.CharField(_("relationship status"), max_length=20, choices=RELATIONSHIP_CHOICES, default='Single')
    location = models.CharField(_("location"), max_length=100, help_text=_("User's physical location (city, state, country)."))
    country = models.CharField(_("country"), max_length=100, blank=True, default="", help_text=_("User's country of residence."))
    state_province = models.CharField(_("state or province"), max_length=100, blank=True, default="", help_text=_("User's state or province of residence."))
    latitude = models.FloatField(_("latitude"), null=True, blank=True, help_text=_("Latitude coordinate of the user's location. Should be auto-populated by a geocoding service."))
    longitude = models.FloatField(_("longitude"), null=True, blank=True, help_text=_("Longitude coordinate of the user's location. Should be auto-populated by a geocoding service."))
    last_location_update = models.DateTimeField(null=True, blank=True, help_text=_("Timestamp of the last location update via geocoding."))
    # Below TODO comments for future enhancements, has been implemented in this code. last_location_update
    # TODO: Integrate a geocoding service (e.g., Google Maps Geocoding API) to automatically populate latitude and longitude based on the 'location' string.
    # TODO: Consider adding a 'last_location_update' timestamp for more dynamic location features.
    max_distance = models.PositiveIntegerField(_("max distance"), default=50, help_text=_("Maximum distance in km for discovering other users."))  # in km
    min_age = models.PositiveIntegerField(_("minimum age"), default=18)
    max_age = models.PositiveIntegerField(_("maximum age"), default=100)
    is_active = models.BooleanField(default=True)
    is_hidden = models.BooleanField(_("is hidden"), default=False, help_text=_("If checked, your profile will not be visible to other users."))

    PHOTO_VISIBILITY_CHOICES = [
        ('everyone', _('Everyone')),
        ('matches', _('Matches Only')),
        ('premium', _('Premium Users Only')),
    ]
    photo_visibility = models.CharField(_("photo visibility"), max_length=10, choices=PHOTO_VISIBILITY_CHOICES, default='everyone') # New field for photo visibility
    virtual_currency = models.PositiveIntegerField(_("virtual currency"), default=0) # New field for virtual currency
    is_premium = models.BooleanField(_("is premium"), default=False) # New field for premium users
    is_online = models.BooleanField(_("is online"), default=False) # New field for online status
    last_login_reward_date = models.DateField(null=True, blank=True) # For daily login rewards
    profile_completion_score = models.PositiveIntegerField(_("profile completion score"), default=0) # For tracking profile completeness
    boost_expiry = models.DateTimeField(null=True, blank=True) # For profile boosts
    preferred_language = models.CharField(_("preferred language"), max_length=10, choices=LANGUAGE_CHOICES, default=settings.LANGUAGE_CODE) # New field

    # Passport Feature fields
    passport_latitude = models.FloatField(_("passport latitude"), null=True, blank=True)
    passport_longitude = models.FloatField(_("passport longitude"), null=True, blank=True)
    is_passport_enabled = models.BooleanField(_("is passport enabled"), default=False, help_text=_("If enabled, user's location is spoofed to passport coordinates."))

    # New fields for profile richness
    prompts = models.JSONField(_("prompts and answers"), default=list, blank=True, null=True, help_text=_("User-selected prompts and their answers."))
    values = models.JSONField(_("values"), default=list, blank=True, null=True, help_text=_("User's core values or life philosophies."))
    favorite_music = models.JSONField(_("favorite music"), default=list, blank=True, null=True, help_text=_("List of favorite music genres, artists, or songs."))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _("Profile")
        verbose_name_plural = _("Profiles")

    def __str__(self):
        return f"{self.user.first_name}'s Profile"
    
    @property
    def full_name(self):
        return f"{self.user.first_name} {self.user.last_name}"

    def calculate_completion_score(self):
        score = 0
        total_fields = 10 # Adjust as more fields are added
        
        if self.bio:
            score += 1
        if self.date_of_birth:
            score += 1
        if self.gender:
            score += 1
        if self.looking_for:
            score += 1
        if self.relationship_status:
            score += 1
        if self.location and self.latitude and self.longitude:
            score += 1
        if self.pk and self.photos.filter(is_primary=True).exists():
            score += 1
        if self.pk and self.interests.exists():
            score += 1
        if self.user.email and self.user.is_verified: # Assuming email is required and verified
            score += 1
        if self.is_active: # Basic active status
            score += 1
        
        return int((score / total_fields) * 100) # Return a percentage

    def geocode_location(self):
        """Geocode the location string to get latitude and longitude using Nominatim (OpenStreetMap)"""
        if not self.location:
            return
        
        try:
            # Use Nominatim API (free, no API key required)
            url = 'https://nominatim.openstreetmap.org/search'
            params = {
                'q': self.location,
                'format': 'json',
                'limit': 1
            }
            headers = {
                'User-Agent': 'DatingApp/1.0'  # Required by Nominatim
            }
            address_parts = [self.location, self.state_province, self.country]
            address = ', '.join([p for p in address_parts if p and p.strip()])
            if not address:
                return
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data:
                self.latitude = float(data[0]['lat'])
                self.longitude = float(data[0]['lon'])
                self.last_location_update = timezone.now()
            else:
                # If no results, set to None
                self.latitude = None
                self.longitude = None
                self.last_location_update = None
        except (requests.RequestException, ValueError, KeyError):
            # If geocoding fails, don't update
            pass

    def save(self, *args, **kwargs):
        # Generate slug if not set
        if not self.slug:
            base_slug = slugify(self.user.username)
            slug = base_slug
            counter = 1
            while Profile.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        
        # Check if location has changed
        if self.pk:
            original = self.__class__.objects.get(pk=self.pk)
            location_changed = original.location != self.location
        else:
            location_changed = bool(self.location)
        
        # Geocode if location is set and has changed or coordinates are missing
        if self.location and (location_changed or not self.latitude or not self.longitude):
            self.geocode_location()
        
        super().save(*args, **kwargs)

    def clean(self):
        from django.core.exceptions import ValidationError
        today = timezone.now().date()
        if self.date_of_birth: # Only validate if date_of_birth is set
            age = today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
            if age < 18:
                raise ValidationError(_('You must be at least 18 years old to create a profile.'))


class Photo(models.Model):
    """User photos for their profile"""
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(_("image"), upload_to='profile_photos/')
    is_primary = models.BooleanField(_("is primary"), default=False, help_text=_("Designates if this is the user's primary profile photo."))
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_moderated = models.BooleanField(default=False) # Has the photo been reviewed?
    is_safe = models.BooleanField(default=False) # Is the photo safe according to moderation (AI or manual)?
    moderation_score = models.FloatField(null=True, blank=True) # Confidence score from AI moderation
    rejection_reason = models.TextField(blank=True) # Reason for rejection, if any
    
    class Meta:
        ordering = ['is_primary', 'uploaded_at']
        verbose_name = _("Photo")
        verbose_name_plural = _("Photos")
    
    def __str__(self):
        return f"{self.profile.user.first_name}'s Photo"
    
    def save(self, *args, **kwargs):
        from PIL import Image
        import io
        from django.core.files.uploadedfile import InMemoryUploadedFile

        # Ensure only one primary photo per profile
        if self.is_primary:
            Photo.objects.filter(profile=self.profile, is_primary=True).update(is_primary=False)

        # Open the image, resize it, and save it to a new BytesIO object
        if self.image:
            img = Image.open(self.image)

            # Convert to RGB if not already to prevent issues with certain formats (e.g., PNG with alpha)
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            
            output = io.BytesIO()

            # Resize image if larger than max_size
            max_size = (1024, 1024) # Max width and height
            if img.width > max_size[0] or img.height > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Save the image with optimized quality
            img.save(output, format='JPEG', quality=85)
            output.seek(0)

            # Replace the original image field with the optimized one
            self.image = InMemoryUploadedFile(
                output, 'ImageField', f"{self.image.name.split('.')[0]}.jpeg", 'image/jpeg', 
                len(output.getvalue()), None
            )

        super().save(*args, **kwargs)

class Interest(models.Model):
    """User interests and hobbies"""
    name = models.CharField(_("name"), max_length=50, unique=True)
    
    class Meta:
        verbose_name = _("Interest")
        verbose_name_plural = _("Interests")
    
    def __str__(self):
        return self.name

class ProfileInterest(models.Model):
    """Many-to-many relationship between profiles and interests"""
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='interests')
    interest = models.ForeignKey(Interest, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ['profile', 'interest']
        verbose_name = _("Profile Interest")
        verbose_name_plural = _("Profile Interests")
    
    def __str__(self):
        return f"{self.profile.user.first_name} - {self.interest.name}"

class Value(models.Model):
    """Core values that users can select"""
    name = models.CharField(_("name"), max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _("Value")
        verbose_name_plural = _("Values")
        ordering = ['name']
    
    def __str__(self):
        return self.name

class ProfileValue(models.Model):
    """Many-to-many relationship between profiles and values"""
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='profile_values')
    value = models.ForeignKey(Value, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['profile', 'value']
        verbose_name = _("Profile Value")
        verbose_name_plural = _("Profile Values")
    
    def __str__(self):
        return f"{self.profile.user.first_name} - {self.value.name}"

class Boost(models.Model):
    """Model to define different types of profile boosts"""
    BOOST_TYPES = [
        ('visibility', _('Visibility Boost')),
        ('match', _('Match Boost')),
    ]
    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.TextField(_("description"), blank=True)
    cost = models.PositiveIntegerField(_("cost"), default=10) # Cost in virtual currency
    duration_days = models.PositiveIntegerField(_("duration (days)"), default=1) # Duration of the boost in days
    boost_type = models.CharField(_("boost type"), max_length=20, choices=BOOST_TYPES, default='visibility')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Boost")
        verbose_name_plural = _("Boosts")

    def __str__(self):
        return self.name

class UserFeatureVector(models.Model):
    """Stores AI-generated feature vectors for users for recommendation engine"""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feature_vector')
    # Using JSONField to store the feature vector as a dictionary or list
    feature_vector = models.JSONField(_("feature vector"), default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("User Feature Vector")
        verbose_name_plural = _("User Feature Vectors")

    def __str__(self):
        return f"Feature vector for {self.user.first_name}"

class Option(models.Model):
    """Generic option model for storing configurable dropdown/selection options"""
    CATEGORY_CHOICES = [
        ('gender', _('Gender')),
        ('looking_for', _('Looking For')),
        ('relationship_status', _('Relationship Status')),
        ('language', _('Language')),
        ('prompt', _('Prompt')),
    ]
    
    category = models.CharField(_("category"), max_length=50, choices=CATEGORY_CHOICES, db_index=True)
    value = models.CharField(_("value"), max_length=200, help_text=_("Internal value stored in database"))
    label = models.CharField(_("label"), max_length=200, help_text=_("Display label shown to users"))
    order = models.IntegerField(_("order"), default=0, help_text=_("Order in which options are displayed"))
    is_active = models.BooleanField(_("is active"), default=True, help_text=_("Whether this option is available for selection"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _("Option")
        verbose_name_plural = _("Options")
        ordering = ['category', 'order', 'value']
        unique_together = ['category', 'value']
        indexes = [
            models.Index(fields=['category', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.get_category_display()}: {self.label}"

# To generate placeholder photos for testing, you can use the following management command:
# python manage.py generate_placeholder_photos --per-profile 4