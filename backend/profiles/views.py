from rest_framework import generics, permissions, status, filters, pagination
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Q, F, Count, Case, When, Value, BooleanField
from django.utils import timezone
from django.utils.translation import gettext_lazy as _ # Added for internationalization
from datetime import timedelta # Added for profile boosts
import math
from .moderation_service import moderate_image, moderate_text # Import moderation services
from .recommendation_engine import update_user_feature_vector, calculate_similarity # Added for AI recommendation engine

from .models import Profile, Photo, Interest, ProfileInterest, Boost, UserFeatureVector, Value, ProfileValue, Option
from .serializers import (
    ProfileSerializer, ProfileListSerializer, PhotoSerializer, InterestSerializer, ProfileInterestSerializer, BoostSerializer,
    ValueSerializer, ProfileValueSerializer, OptionSerializer
)
from interactions.models import Match, Swipe
from chat.models import Conversation, Message
from i18n.services import ensure_translation


class CustomPageNumberPagination(pagination.PageNumberPagination):
    """Custom pagination class that allows client to set page size"""
    page_size_query_param = 'page_size'
    max_page_size = 100


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Radius of Earth in kilometers

    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance

class BoostListView(generics.ListAPIView):
    """List all available profile boosts"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Boost.objects.all().order_by('cost')
    serializer_class = BoostSerializer

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def activate_boost(request):
    """Activate a profile boost for the user"""
    boost_id = request.data.get('boost_id')

    try:
        boost = Boost.objects.get(id=boost_id)
    except Boost.DoesNotExist:
        return Response({'error': _('Boost not found')}, status=status.HTTP_404_NOT_FOUND)

    user_profile = request.user.profile

    if user_profile.virtual_currency < boost.cost:
        return Response({'error': _('Insufficient virtual currency')}, status=status.HTTP_400_BAD_REQUEST)
    
    # Deduct cost and set boost expiry
    user_profile.virtual_currency -= boost.cost
    user_profile.boost_expiry = timezone.now() + timedelta(days=boost.duration_days)
    user_profile.save()

    return Response({'message': _('%s activated!') % boost.name, 'boost_expiry': user_profile.boost_expiry}, status=status.HTTP_200_OK)

class ProfileListCreateView(generics.ListCreateAPIView):
    """List and create profiles"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bio', 'location', 'interests__name'] # Fields for keyword search
    
    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ProfileListSerializer
        return ProfileSerializer
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile'):
            user_profile = user.profile
            
            # Calculate age from date_of_birth for filtering
            today = timezone.now().date()
            min_birth_date = today.replace(year=today.year - user_profile.max_age)
            max_birth_date = today.replace(year=today.year - user_profile.min_age)

            queryset = Profile.objects.filter(
                is_active=True,
                is_hidden=False, # Only show profiles that are not hidden
                date_of_birth__gte=min_birth_date,
                date_of_birth__lte=max_birth_date,
                gender=user_profile.gender,
                looking_for=user_profile.looking_for,
                preferred_language=user_profile.preferred_language,
                relationship_status=user_profile.relationship_status
            ).exclude(
                Q(user=user) |
                Q(user__swipes_received__swiper=user) |
                Q(user__blocks_received__blocker=user) |
                Q(user__blocks_made__blocked_user=user)
            )
            
            # Determine the effective latitude and longitude for distance calculation
            effective_latitude = user_profile.latitude
            effective_longitude = user_profile.longitude

            if user_profile.is_passport_enabled and user_profile.passport_latitude is not None and user_profile.passport_longitude is not None:
                effective_latitude = user_profile.passport_latitude
                effective_longitude = user_profile.passport_longitude

            # Filter by distance if location is available
            if effective_latitude and effective_longitude:
                # Exclude profiles with no location data
                location_aware_queryset = queryset.filter(
                    latitude__isnull=False,
                    longitude__isnull=False
                )
                
                # Filter by max_distance using Haversine formula
                filtered_by_distance = []
                for profile in location_aware_queryset:
                    distance = haversine_distance(
                        effective_latitude, effective_longitude,
                        profile.latitude, profile.longitude
                    )
                    if distance <= user_profile.max_distance:
                        filtered_by_distance.append(profile)
                
                # Combine with profiles that don't have location (if desired, or exclude them completely)
                # For now, we only return profiles within distance if user has location.
                # If you want to include profiles without location, you'll need to modify this logic.
                queryset = Profile.objects.filter(pk__in=[p.pk for p in filtered_by_distance])

            # Apply advanced filters for premium users
            if user_profile.is_premium:
                # Filter by online status
                is_online = self.request.query_params.get('is_online', None)
                if is_online is not None:
                    queryset = queryset.filter(is_online=is_online.lower() == 'true')
                
                # Filter by verified profiles
                is_verified = self.request.query_params.get('is_verified', None)
                if is_verified is not None:
                    queryset = queryset.filter(user__is_verified=is_verified.lower() == 'true')
            
            return queryset.order_by('?')  # Random order for discovery
        return Profile.objects.none()
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ProfileDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a profile"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileSerializer
    lookup_field = 'slug'
    
    def get_queryset(self):
        # Allow viewing all active profiles, but restrict updates/deletes to own profile
        if self.request.method == 'GET':
            return Profile.objects.filter(is_active=True)
        else:
            return Profile.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Record profile view
        if request.user.is_authenticated and request.user != instance.user:
            from interactions.models import ProfileView
            ProfileView.objects.create(viewer=request.user, viewed_profile=instance.user)
        serializer = self.get_serializer(instance)
        data = serializer.data

        target_language = request.query_params.get('lang')
        if target_language:
            translation, queued = ensure_translation(
                key=f'profile.bio.{instance.pk}',
                source_text=instance.bio or '',
                target_language=target_language,
                source_language=instance.preferred_language,
            )
            data['bio_translation'] = {
                'text': translation.translated_text if translation and translation.status == 'completed' else None,
                'status': translation.status if translation else 'pending',
                'queued': queued,
            }

        return Response(data)


class PhotoListCreateView(generics.ListCreateAPIView):
    """List and create photos for a profile"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PhotoSerializer
    
    def get_queryset(self):
        return Photo.objects.filter(profile__user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        profile = self.request.user.profile
        current_photos = Photo.objects.filter(profile=profile).count()
        
        if current_photos >= 2 and not profile.is_premium:
            return Response({'error': _('Free users can only upload up to 2 photos. Upgrade to premium for unlimited photos.')}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        photo = serializer.save(profile=profile)

        # Perform AI moderation on the uploaded image
        if photo.image:
            # Assuming photo.image.path gives the correct file path
            moderation_results = moderate_image(photo.image.path)
            photo.is_moderated = True
            photo.is_safe = moderation_results['is_safe']
            photo.moderation_score = moderation_results['moderation_score']
            photo.rejection_reason = moderation_results['rejection_reason']
            photo.save()

        # Reject photo upload if not safe
        if not photo.is_safe:
            # Delete the photo if it's not safe and respond with an error
            photo.delete()
            return Response({'error': _('Photo rejected by moderation: %s') % photo.rejection_reason}, status=status.HTTP_400_BAD_REQUEST)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

class PhotoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a photo"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PhotoSerializer
    
    def get_queryset(self):
        return Photo.objects.filter(profile__user=self.request.user)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def set_primary_photo(request, photo_id):
    """Set a photo as primary"""
    try:
        photo = Photo.objects.get(id=photo_id, profile__user=request.user)
        photo.is_primary = True
        photo.save()
        return Response({'message': _('Primary photo updated')}, status=status.HTTP_200_OK)
    except Photo.DoesNotExist:
        return Response({'error': _('Photo not found')}, status=status.HTTP_404_NOT_FOUND)

class InterestListView(generics.ListAPIView):
    """List all available interests"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Interest.objects.all()
    serializer_class = InterestSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

class ProfileInterestListCreateView(generics.ListCreateAPIView):
    """List and create profile interests"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileInterestSerializer
    
    def get_queryset(self):
        return ProfileInterest.objects.filter(profile__user=self.request.user)
    
    def perform_create(self, serializer):
        profile = self.request.user.profile
        serializer.save(profile=profile)

class ProfileInterestDetailView(generics.DestroyAPIView):
    """Delete a profile interest"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileInterestSerializer
    
    def get_queryset(self):
        return ProfileInterest.objects.filter(profile__user=self.request.user)

class ValueListView(generics.ListAPIView):
    """List all available values"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Value.objects.all()
    serializer_class = ValueSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

class ProfileValueListCreateView(generics.ListCreateAPIView):
    """List and create profile values"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileValueSerializer
    
    def get_queryset(self):
        return ProfileValue.objects.filter(profile__user=self.request.user)
    
    def perform_create(self, serializer):
        profile = self.request.user.profile
        serializer.save(profile=profile)

class ProfileValueDetailView(generics.DestroyAPIView):
    """Delete a profile value"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileValueSerializer
    
    def get_queryset(self):
        return ProfileValue.objects.filter(profile__user=self.request.user)

class OptionListView(generics.ListAPIView):
    """List all active options, optionally filtered by category"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OptionSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['label', 'value']
    
    def get_queryset(self):
        queryset = Option.objects.filter(is_active=True)
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category=category)
        return queryset

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def profile_recommendations(request):
    """Get profile recommendations based on interests and preferences"""
    user = request.user
    if not hasattr(user, 'profile'):
        # Return empty list instead of error
        return Response([], status=status.HTTP_200_OK)
    
    user_profile = user.profile
    
    print(f"\n=== Recommendations for {user.email} ===")
    print(f"User gender: {user_profile.gender}, looking for: {user_profile.looking_for}")
    print(f"Age range: {user_profile.min_age}-{user_profile.max_age}")
    print(f"Max distance: {user_profile.max_distance}km")
    
    # Check if passport mode is enabled
    if user_profile.is_passport_enabled:
        print(f"Passport mode ENABLED - searching from ({user_profile.passport_latitude}, {user_profile.passport_longitude})")
        effective_latitude = user_profile.passport_latitude
        effective_longitude = user_profile.passport_longitude
    else:
        print(f"Using home location: ({user_profile.latitude}, {user_profile.longitude})")
        effective_latitude = user_profile.latitude
        effective_longitude = user_profile.longitude

    today = timezone.now().date()
    min_birth_date = today.replace(year=today.year - user_profile.max_age)
    max_birth_date = today.replace(year=today.year - user_profile.min_age)

    # Get users already swiped on by the current user
    swiped_user_ids = Swipe.objects.filter(swiper=user).values_list('swiped_user__id', flat=True)
    print(f"Already swiped on {len(swiped_user_ids)} users")

    user_feature_vector = UserFeatureVector.objects.filter(user=user).first()

    # Build base queryset
    base_queryset = Profile.objects.filter(
        is_active=True,
        is_hidden=False,
        date_of_birth__gte=min_birth_date,
        date_of_birth__lte=max_birth_date,
    ).exclude(
        Q(user=user) |
        Q(user__blocks_received__blocker=user) |
        Q(user__blocks_made__blocked_user=user)
    )
    
    print(f"Total active profiles (excluding self and blocks): {base_queryset.count()}")
    
    # Apply location-based filtering if user has coordinates
    if effective_latitude and effective_longitude:
        # Filter profiles that have location data
        location_aware_profiles = base_queryset.filter(
            latitude__isnull=False,
            longitude__isnull=False
        )
        
        # Calculate distances and filter by max_distance
        profiles_within_distance = []
        for profile in location_aware_profiles:
            distance = haversine_distance(
                effective_latitude, effective_longitude,
                profile.latitude, profile.longitude
            )
            if distance <= user_profile.max_distance:
                profiles_within_distance.append(profile.pk)
        
        print(f"Found {len(profiles_within_distance)} profiles within {user_profile.max_distance}km")
        base_queryset = base_queryset.filter(pk__in=profiles_within_distance)
    else:
        # If user has no location, fallback to country-based matching
        if user_profile.country:
            base_queryset = base_queryset.filter(country=user_profile.country)
            print(f"No location coordinates - filtering by country: {user_profile.country}")
        else:
            print("No location or country - showing all profiles")

    if not user_feature_vector or not user_feature_vector.feature_vector:
        # Fallback to interest-based recommendation if no feature vector is available
        user_interests = user_profile.interests.values_list('interest_id', flat=True)
        
        # Try excluding swiped users first
        queryset = base_queryset.exclude(
            Q(user__in=swiped_user_ids)
        ).annotate(
            common_interests=Count(
                'interests__interest',
                filter=Q(interests__interest__in=user_interests)
            ),
            is_boosted=Case(
                When(boost_expiry__gt=timezone.now(), then=Value(True)),
                default=Value(False),
                output_field=BooleanField()
            )
        ).order_by('-is_boosted', '-common_interests', '?')
        
        print(f"New profiles available: {queryset.count()}")
        
        # If no new profiles, include previously swiped users (except blocks)
        if not queryset.exists():
            print("No new profiles, including previously swiped users")
            queryset = base_queryset.annotate(
                common_interests=Count(
                    'interests__interest',
                    filter=Q(interests__interest__in=user_interests)
                ),
                is_boosted=Case(
                    When(boost_expiry__gt=timezone.now(), then=Value(True)),
                    default=Value(False),
                    output_field=BooleanField()
                )
            ).order_by('-is_boosted', '-common_interests', '?')
            print(f"Total profiles (including swiped): {queryset.count()}")
        
        results = queryset[:10]
        print(f"Returning {len(results)} profiles")
        for p in results:
            print(f"  - {p.full_name} ({p.user.email})")
        
        serializer = ProfileListSerializer(results, many=True)
        return Response(serializer.data)

    # Proceed with AI-powered recommendations
    candidate_profiles = base_queryset.exclude(
        Q(user__in=swiped_user_ids)
    )
    
    print(f"Candidates (AI mode, new only): {candidate_profiles.count()}")

    # If no candidates found (all swiped), try again without swipe exclusion
    if not candidate_profiles.exists():
        print("No new candidates, including previously swiped")
        candidate_profiles = base_queryset
        print(f"Total candidates (including swiped): {candidate_profiles.count()}")

    recommendations = []
    for candidate_profile in candidate_profiles:
        candidate_feature_vector = UserFeatureVector.objects.filter(user=candidate_profile.user).first()
        if candidate_feature_vector and candidate_feature_vector.feature_vector:
            similarity = calculate_similarity(user_feature_vector.feature_vector, candidate_feature_vector.feature_vector)
            recommendations.append({'profile': candidate_profile, 'similarity': similarity})
        else:
            # If no feature vector, add with default similarity
            recommendations.append({'profile': candidate_profile, 'similarity': 0.5})

    # Sort by similarity score (descending) and then by boosted status
    recommendations.sort(key=lambda x: (x['profile'].boost_expiry > timezone.now() if hasattr(x['profile'], 'boost_expiry') else False, x['similarity']), reverse=True)

    # Return top N recommendations
    top_recommendations = [rec['profile'] for rec in recommendations[:10]]
    print(f"Returning {len(top_recommendations)} AI recommendations")
    for p in top_recommendations:
        print(f"  - {p.full_name} ({p.user.email})")
    
    serializer = ProfileListSerializer(top_recommendations, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def daily_login_reward(request):
    """Grant daily login reward to the user"""
    user_profile = request.user.profile
    today = timezone.now().date()

    if user_profile.last_login_reward_date != today:
        user_profile.virtual_currency += 10 # Example reward: 10 virtual currency
        user_profile.last_login_reward_date = today
        user_profile.save()
        return Response({'message': _('Daily login reward granted!'), 'virtual_currency': user_profile.virtual_currency}, status=status.HTTP_200_OK)
    else:
        return Response({'message': _('Daily login reward already claimed today.')}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_profile_completion(request):
    """Calculate and return profile completion score"""
    user_profile = request.user.profile
    score = 0
    total_fields = 0

    # Define fields that contribute to profile completeness
    fields_to_check = [
        user_profile.bio, user_profile.date_of_birth, user_profile.gender,
        user_profile.looking_for, user_profile.location, user_profile.latitude,
        user_profile.longitude
    ]

    for field in fields_to_check:
        total_fields += 1
        if field:
            score += 1

    # Check if user has at least one photo
    if user_profile.photos.exists():
        score += 1
        total_fields += 1
    
    # Check if user has at least one interest
    if user_profile.interests.exists():
        score += 1
        total_fields += 1

    # Calculate percentage
    completion_percentage = (score / total_fields) * 100 if total_fields > 0 else 0
    user_profile.profile_completion_score = int(completion_percentage)
    user_profile.save()

    return Response({
        'profile_completion_score': user_profile.profile_completion_score,
        'message': _('Profile completion score calculated.')
    }, status=status.HTTP_200_OK)

@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def manage_passport(request):
    """
    Manages the user's passport feature (virtual location).
    GET: Returns current passport status.
    POST: Sets a new passport location and enables the feature.
    DELETE: Clears the passport location and disables the feature.
    """
    user_profile = request.user.profile

    if request.method == 'GET':
        return Response({
            'is_passport_enabled': user_profile.is_passport_enabled,
            'passport_latitude': user_profile.passport_latitude,
            'passport_longitude': user_profile.passport_longitude,
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')

        if latitude is None or longitude is None:
            return Response({'error': _('Latitude and longitude are required to set passport location.')}, status=status.HTTP_400_BAD_REQUEST)
        # TODO: Enhance validation to ensure provided latitude and longitude correspond to valid geographical coordinates.
        # TODO: Consider integrating a real-time location update mechanism (e.g., WebSockets) for more dynamic passport functionality.

        try:
            user_profile.passport_latitude = float(latitude)
            user_profile.passport_longitude = float(longitude)
            user_profile.is_passport_enabled = True
            user_profile.save()
            return Response({'message': _('Passport location set and enabled successfully.'),
                             'is_passport_enabled': True,
                             'passport_latitude': user_profile.passport_latitude,
                             'passport_longitude': user_profile.passport_longitude}, status=status.HTTP_200_OK)
        except ValueError:
            return Response({'error': _('Invalid latitude or longitude provided.')}, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        user_profile.passport_latitude = None
        user_profile.passport_longitude = None
        user_profile.is_passport_enabled = False
        user_profile.save()
        return Response({'message': _('Passport location cleared and disabled successfully.'),
                         'is_passport_enabled': False}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_dashboard_stats(request):
    """
    Returns dashboard statistics for the authenticated user:
    - new_matches_count: Total number of matches.
    - unread_messages_count: Total count of unread messages across all conversations.
    - likes_received_count: Total number of 'like' or 'super_like' swipes received.
    """
    try:
        user = request.user
        
        # Check if user has a profile
        if not hasattr(user, 'profile') or user.profile is None:
            return Response({
                'new_matches_count': 0,
                'unread_messages_count': 0,
                'likes_received_count': 0,
            }, status=status.HTTP_200_OK)

        # New Matches Count
        new_matches_count = Match.objects.filter(Q(user1=user) | Q(user2=user), is_active=True).count()

        # Unread Messages Count
        unread_messages_count = Message.objects.filter(
            Q(conversation__match__user1=user) | Q(conversation__match__user2=user),
            is_read=False
        ).exclude(sender=user).count()

        # Likes Received Count
        likes_received_count = Swipe.objects.filter(
            swiped_user=user,
            action__in=['like', 'super_like']
        ).count()

        return Response({
            'new_matches_count': new_matches_count,
            'unread_messages_count': unread_messages_count,
            'likes_received_count': likes_received_count,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        # Log the error and return default stats
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting dashboard stats for user {request.user}: {str(e)}")
        return Response({
            'new_matches_count': 0,
            'unread_messages_count': 0,
            'likes_received_count': 0,
        }, status=status.HTTP_200_OK)


class PublicProfileListView(generics.ListAPIView):
    """Public list of profiles for landing page browsing"""
    permission_classes = [permissions.AllowAny]
    serializer_class = ProfileListSerializer
    pagination_class = CustomPageNumberPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bio', 'location', 'interests__interest__name']
    ordering_fields = ['created_at', 'date_of_birth']
    ordering = ['-created_at']

    def get_queryset(self):
        from django.db.models import F, Value
        from django.db.models.functions import ExtractYear, Now
        
        queryset = Profile.objects.filter(
            is_active=True,
            is_hidden=False,
            bio__isnull=False,  # Only show profiles with bio
        ).exclude(
            bio=''  # Exclude empty bios
        ).distinct()

        # Apply filters from query parameters
        min_age = self.request.query_params.get('min_age')
        max_age = self.request.query_params.get('max_age')
        gender = self.request.query_params.get('gender')
        location = self.request.query_params.get('location')
        interests = self.request.query_params.get('interests')
        ordering = self.request.query_params.get('ordering', '-created_at')

        if min_age:
            today = timezone.now().date()
            max_birth_date = today.replace(year=today.year - int(min_age))
            queryset = queryset.filter(date_of_birth__lte=max_birth_date)

        if max_age:
            today = timezone.now().date()
            min_birth_date = today.replace(year=today.year - int(max_age))
            queryset = queryset.filter(date_of_birth__gte=min_birth_date)

        if gender:
            queryset = queryset.filter(gender=gender)

        if location:
            queryset = queryset.filter(location__icontains=location)

        if interests:
            interest_list = [i.strip() for i in interests.split(',')]
            queryset = queryset.filter(interests__interest__name__in=interest_list)

        # Handle ordering
        if ordering == 'current_age':
            # Order by age ascending (youngest first)
            queryset = queryset.annotate(
                age=ExtractYear(Now()) - ExtractYear('date_of_birth')
            ).order_by('age', 'date_of_birth')
        elif ordering == '-current_age':
            # Order by age descending (oldest first)
            queryset = queryset.annotate(
                age=ExtractYear(Now()) - ExtractYear('date_of_birth')
            ).order_by('-age', '-date_of_birth')
        else:
            # Default ordering by creation date
            queryset = queryset.order_by(ordering)

        # Return all matching profiles (no limit for full browsing)
        return queryset