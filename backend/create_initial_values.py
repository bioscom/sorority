"""
Script to create initial values in the database
Run this after migrations: python create_initial_values.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from profiles.models import Value

# Predefined values to seed the database
INITIAL_VALUES = [
    'Honesty',
    'Kindness',
    'Ambition',
    'Creativity',
    'Humor',
    'Loyalty',
    'Adventure',
    'Family',
    'Friendship',
    'Learning',
    'Spirituality',
    'Generosity',
    'Patience',
    'Optimism',
    
    '’90s Britpop',
    '’90s kid',
    'Açaí',
    'Acapella',
    'Activism',
    'Among Us',
    'Archery',
    'Art',
    'Art galleries',
    'Astrology',
    'Atari',
    'Badminton',
    'Backpacking',
    'Baseball',
    'Basketball',
    'BBQ',
    'Beach bars',
    'Binge-watching TV series',
    'Black Lives Matter',
    'Board games',
    'Boba tea',
    'Bollywood',
    'Bowling',
    'Boxing',
    'Brunch',
    'Canoeing',
    'Car racing',
    'Cars',
    'Charity shopping',
    'Cheerleading',
    'Choir',
    'Clubbing',
    'Climate change',
    'Coffee',
    'Content creation',
    'Cooking',
    'Cosplay',
    'Country music',
    'Craft beer',
    'Cricket',
    'Dancing',
    'Disability rights',
    'Drawing',
    'Environmentalism',
    'E-sports',
    'Escape rooms',
    'Exhibition',
    'Feminism',
    'Festivals',
    'Football',
    'Food tours',
    'Funk music',
    'Gardening',
    'Grime',
    'Happy hour',
    'Hip hop',
    'Horror films',
    'House parties',
    'J-Pop',
    'Meditation',
    'Mental health awareness',
    'Motor sports',
    'Motorcycles',
    'Museums',
    'Music bands',
    'NBA',
    'MLB',
    'Politics',
    'Podcasts',
    'Poetry',
    'Pub crawls',
    'Pub quiz',
    'Pubs',
    'Reggaeton',
    'Road trips',
    'Rugby',
    'Sailing',
    'Self-care',
    'Self-love',
    'Shopping',
    'Skiing',
    'Snowboarding',
    'Sofa surfing',
    'Stand-up comedy',
    'Street food',
    'Surfing',
    'Sushi',
    'Tarot',
    'Tea',
    'Tennis',
    'Theatre',
    'Trainers',
    'Trivia',
    'Upcycling',
    'Vintage fashion',
    'Vlogging',
    'Volunteering',
    'Voter rights',
    'Walking my dog',
    'Wine',
    
]

def create_initial_values():
    """Create initial values if they don't exist"""
    created_count = 0
    existing_count = 0
    
    for value_name in INITIAL_VALUES:
        value, created = Value.objects.get_or_create(name=value_name)
        if created:
            created_count += 1
            print(f"✓ Created value: {value_name}")
        else:
            existing_count += 1
            print(f"- Value already exists: {value_name}")
    
    print(f"\n Summary:")
    print(f"Created: {created_count}")
    print(f"Already existed: {existing_count}")
    print(f"Total values: {Value.objects.count()}")

if __name__ == '__main__':
    print("Creating initial values...")
    create_initial_values()
    print("\nDone!")
