import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from profiles.models import Option

def create_initial_options():
    """Create initial options for all categories"""
    
    # Gender options
    gender_options = [
        {'value': 'Male', 'label': 'Male', 'order': 1},
        {'value': 'Female', 'label': 'Female', 'order': 2},
        {'value': 'Other', 'label': 'Other', 'order': 3},
        {'value': 'Prefer not to say', 'label': 'Prefer not to say', 'order': 4},
    ]
    
    for idx, opt in enumerate(gender_options):
        option, created = Option.objects.get_or_create(
            category='gender',
            value=opt['value'],
            defaults={
                'label': opt['label'],
                'order': opt['order'],
                'is_active': True
            }
        )
        if created:
            print(f"Created gender option: {option.label}")
        else:
            print(f"Gender option already exists: {option.label}")
    
    # Looking for options
    looking_for_options = [
        {'value': 'Long-term relationship', 'label': 'Long-term relationship', 'order': 1},
        {'value': 'Short-term relationship', 'label': 'Short-term relationship', 'order': 2},
        {'value': 'Friendship', 'label': 'Friendship', 'order': 3},
        {'value': 'Casual dating', 'label': 'Casual dating', 'order': 4},
    ]
    
    for idx, opt in enumerate(looking_for_options):
        option, created = Option.objects.get_or_create(
            category='looking_for',
            value=opt['value'],
            defaults={
                'label': opt['label'],
                'order': opt['order'],
                'is_active': True
            }
        )
        if created:
            print(f"Created looking_for option: {option.label}")
        else:
            print(f"Looking_for option already exists: {option.label}")
    
    # Relationship status options
    relationship_options = [
        {'value': 'Single', 'label': 'Single', 'order': 1},
        {'value': 'In a relationship', 'label': 'In a relationship', 'order': 2},
        {'value': 'Married', 'label': 'Married', 'order': 3},
    ]
    
    for idx, opt in enumerate(relationship_options):
        option, created = Option.objects.get_or_create(
            category='relationship_status',
            value=opt['value'],
            defaults={
                'label': opt['label'],
                'order': opt['order'],
                'is_active': True
            }
        )
        if created:
            print(f"Created relationship_status option: {option.label}")
        else:
            print(f"Relationship_status option already exists: {option.label}")
    
    # Language options
    language_options = [
        {'value': 'en-us', 'label': 'English', 'order': 1},
        {'value': 'fr', 'label': 'French', 'order': 2},
        {'value': 'es', 'label': 'Spanish', 'order': 3},
    ]
    
    for idx, opt in enumerate(language_options):
        option, created = Option.objects.get_or_create(
            category='language',
            value=opt['value'],
            defaults={
                'label': opt['label'],
                'order': opt['order'],
                'is_active': True
            }
        )
        if created:
            print(f"Created language option: {option.label}")
        else:
            print(f"Language option already exists: {option.label}")
    
    # Prompt options
    prompt_options = [
        {'value': 'My ideal first date is...', 'label': 'My ideal first date is...', 'order': 1},
        {'value': 'A perfect day for me includes...', 'label': 'A perfect day for me includes...', 'order': 2},
        {'value': 'My hidden talent is...', 'label': 'My hidden talent is...', 'order': 3},
        {'value': 'I am an expert at...', 'label': 'I am an expert at...', 'order': 4},
        {'value': 'My favorite way to relax is...', 'label': 'My favorite way to relax is...', 'order': 5},
        {'value': "The most spontaneous thing I've done is...", 'label': "The most spontaneous thing I've done is...", 'order': 6},
    ]
    
    for idx, opt in enumerate(prompt_options):
        option, created = Option.objects.get_or_create(
            category='prompt',
            value=opt['value'],
            defaults={
                'label': opt['label'],
                'order': opt['order'],
                'is_active': True
            }
        )
        if created:
            print(f"Created prompt option: {option.label}")
        else:
            print(f"Prompt option already exists: {option.label}")
    
    print("\nOptions seeding completed!")
    print(f"Total options in database: {Option.objects.count()}")
    print(f"  - Gender: {Option.objects.filter(category='gender').count()}")
    print(f"  - Looking For: {Option.objects.filter(category='looking_for').count()}")
    print(f"  - Relationship Status: {Option.objects.filter(category='relationship_status').count()}")
    print(f"  - Language: {Option.objects.filter(category='language').count()}")
    print(f"  - Prompts: {Option.objects.filter(category='prompt').count()}")

if __name__ == '__main__':
    create_initial_options()
