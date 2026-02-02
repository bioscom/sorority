from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from profiles.models import Profile, Photo, Interest, ProfileInterest
from interactions.models import Swipe
import random
from faker import Faker

User = get_user_model()

class Command(BaseCommand):
    help = 'Populate the database with sample profiles for testing'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=20, help='Number of profiles to create')

    def handle(self, *args, **options):
        fake = Faker()
        count = options['count']

        self.stdout.write(f'Creating {count} sample profiles...')

        # Create interests if they don't exist
        interests = [
            'Reading', 'Travel', 'Cooking', 'Sports', 'Music', 'Art', 'Photography',
            'Hiking', 'Dancing', 'Gaming', 'Movies', 'Fitness', 'Yoga', 'Writing',
            'Gardening', 'Pets', 'Volunteering', 'Technology', 'Fashion', 'Food'
        ]

        for interest_name in interests:
            Interest.objects.get_or_create(name=interest_name)

        all_interests = list(Interest.objects.all())

        for i in range(count):
            # Create user
            username = fake.user_name()
            while User.objects.filter(username=username).exists():
                username = fake.user_name()

            email = fake.email()
            while User.objects.filter(email=email).exists():
                email = fake.email()

            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                password='password123'  # Simple password for testing
            )

            # Create profile
            profile = Profile.objects.create(
                user=user,
                bio=fake.text(max_nb_chars=200),
                date_of_birth=fake.date_of_birth(minimum_age=18, maximum_age=50),
                gender=random.choice(['Male', 'Female', 'Other']),
                looking_for=random.choice(['Long-term relationship', 'Short-term relationship', 'Friendship', 'Casual dating']),
                relationship_status=random.choice(['Single', 'In a relationship', 'Married']),
                location=fake.city(),
                latitude=fake.latitude(),
                longitude=fake.longitude(),
                max_distance=random.randint(10, 100),
                min_age=random.randint(18, 25),
                max_age=random.randint(30, 60),
                preferred_language='en-us',
                prompts=[
                    {'question': 'My ideal first date is...', 'answer': fake.sentence()},
                    {'question': 'A perfect day for me includes...', 'answer': fake.sentence()},
                ],
                values=random.sample(['Honesty', 'Kindness', 'Adventure', 'Loyalty'], 3),
                favorite_music=random.sample(['Pop', 'Rock', 'Jazz', 'Electronic'], 2),
                is_premium=random.choice([True, False]),
                virtual_currency=random.randint(0, 1000)
            )

            # Add interests
            num_interests = random.randint(3, 8)
            selected_interests = random.sample(all_interests, num_interests)
            for interest in selected_interests:
                ProfileInterest.objects.create(profile=profile, interest=interest)

            # Create some fake swipes for recommendation engine
            if i > 0:  # Skip for first profile
                other_profiles = Profile.objects.exclude(id=profile.id)[:10]
                for other_profile in other_profiles:
                    if random.choice([True, False]):
                        Swipe.objects.create(
                            swiper=user,
                            swiped_user=other_profile.user,
                            action=random.choice(['like', 'pass', 'super_like'])
                        )

            self.stdout.write(f'Created profile for {user.first_name} {user.last_name}')

        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} sample profiles'))