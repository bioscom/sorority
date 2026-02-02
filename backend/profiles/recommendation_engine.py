import numpy as np
from profiles.models import Profile, Interest, UserFeatureVector
from interactions.models import Swipe

# Placeholder for a simple recommendation engine
# In a real-world scenario, you'd use more advanced techniques (e.g., collaborative filtering, matrix factorization, neural networks)

def generate_feature_vector(user_profile: Profile):
    """Generates a numerical feature vector for a given user profile."""
    # Initialize an empty feature vector
    feature_vector = {}

    # 1. Demographics and basic profile information
    feature_vector['gender_Male'] = 1 if user_profile.gender == 'Male' else 0
    feature_vector['gender_Female'] = 1 if user_profile.gender == 'Female' else 0
    feature_vector['gender_Other'] = 1 if user_profile.gender == 'Other' else 0
    feature_vector['gender_Prefer_not_to_say'] = 1 if user_profile.gender == 'Prefer not to say' else 0
    feature_vector['looking_for_Long-term_relationship'] = 1 if user_profile.looking_for == 'Long-term relationship' else 0
    feature_vector['looking_for_Short-term_relationship'] = 1 if user_profile.looking_for == 'Short-term relationship' else 0
    feature_vector['looking_for_Friendship'] = 1 if user_profile.looking_for == 'Friendship' else 0
    feature_vector['looking_for_Casual_dating'] = 1 if user_profile.looking_for == 'Casual dating' else 0
    feature_vector['relationship_status_Single'] = 1 if user_profile.relationship_status == 'Single' else 0
    feature_vector['relationship_status_In_a_relationship'] = 1 if user_profile.relationship_status == 'In a relationship' else 0
    feature_vector['relationship_status_Married'] = 1 if user_profile.relationship_status == 'Married' else 0
    feature_vector['min_age'] = user_profile.min_age
    feature_vector['max_age'] = user_profile.max_age
    feature_vector['max_distance'] = user_profile.max_distance
    feature_vector['is_premium'] = 1 if user_profile.is_premium else 0

    # Handle date_of_birth to age conversion
    if user_profile.date_of_birth:
        today = user_profile.created_at.date()  # Using created_at for a consistent reference point
        age = today.year - user_profile.date_of_birth.year - \
              ((today.month, today.day) < (user_profile.date_of_birth.month, user_profile.date_of_birth.day))
        feature_vector['age'] = age
    else:
        feature_vector['age'] = 0  # Default or handle missing DOB

    # 2. Interests (one-hot encoding or embedding)
    all_interests = Interest.objects.all().order_by('name')
    user_interests = user_profile.interests.all()
    for interest in all_interests:
        feature_vector[f'interest_{interest.name}'] = 1 if interest in user_interests else 0

    # 3. Swiping history (simple aggregated features)
    likes_made = Swipe.objects.filter(swiper=user_profile.user, action='like').count()
    passes_made = Swipe.objects.filter(swiper=user_profile.user, action='pass').count()
    super_likes_made = Swipe.objects.filter(swiper=user_profile.user, action='super_like').count()

    feature_vector['likes_made'] = likes_made
    feature_vector['passes_made'] = passes_made
    feature_vector['super_likes_made'] = super_likes_made

    # Normalize numerical features (simple min-max scaling for now)
    max_val_age = 100  # Assuming max age is 100
    max_val_distance = 500 # Assuming max distance is 500km
    max_val_swipes = 1000 # Assuming max swipes is 1000

    feature_vector['age'] = feature_vector['age'] / max_val_age
    feature_vector['max_distance'] = feature_vector['max_distance'] / max_val_distance
    feature_vector['likes_made'] = feature_vector['likes_made'] / max_val_swipes
    feature_vector['passes_made'] = feature_vector['passes_made'] / max_val_swipes
    feature_vector['super_likes_made'] = feature_vector['super_likes_made'] / max_val_swipes

    # Convert dictionary to a consistent ordered list (important for machine learning models)
    # Ensure the order of keys is always the same
    ordered_keys = sorted(feature_vector.keys())
    final_vector = [feature_vector[key] for key in ordered_keys]

    return final_vector

def update_user_feature_vector(user_profile: Profile):
    """Generates and saves the feature vector for a user."""
    vector_list = generate_feature_vector(user_profile)
    vector_dict = {f'feature_{i}': val for i, val in enumerate(vector_list)}

    user_feature_vector, created = UserFeatureVector.objects.get_or_create(user=user_profile.user)
    user_feature_vector.feature_vector = vector_dict
    user_feature_vector.save()
    return user_feature_vector

def calculate_similarity(vector1: dict, vector2: dict):
    """Calculates cosine similarity between two feature vectors."""
    # Ensure vectors are converted to numpy arrays for calculation
    # Use common keys
    common_keys = set(vector1.keys()) & set(vector2.keys())
    if not common_keys:
        return 0.0
    keys = sorted(list(common_keys))
    v1 = np.array([vector1[key] for key in keys])
    v2 = np.array([vector2[key] for key in keys])

    dot_product = np.dot(v1, v2)
    norm_a = np.linalg.norm(v1)
    norm_b = np.linalg.norm(v2)

    if norm_a == 0 or norm_b == 0:
        return 0.0  # Avoid division by zero

    return dot_product / (norm_a * norm_b)

