#!/usr/bin/env python
"""Script to create a match between petersonkimberly and Isaac."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import User
from interactions.models import Swipe, Match

print("\n=== Creating Match ===")

# Find the users
try:
    isaac = User.objects.get(email='isaac.bejide@gmail.com')
    print(f"✓ Found Isaac: {isaac.email} (ID: {isaac.id})")
except User.DoesNotExist:
    print("✗ Isaac not found!")
    exit(1)

try:
    petersonkimberly = User.objects.get(email='petersonkimberly@example.org')
    print(f"✓ Found petersonkimberly: {petersonkimberly.email} (ID: {petersonkimberly.id})")
    if hasattr(petersonkimberly, 'profile'):
        print(f"  Name: {petersonkimberly.profile.full_name}")
except User.DoesNotExist:
    print("✗ petersonkimberly not found!")
    exit(1)

# Create mutual likes
swipe1, created1 = Swipe.objects.get_or_create(
    swiper=isaac,
    swiped_user=petersonkimberly,
    defaults={'action': 'like'}
)
if created1:
    print(f"✓ Created swipe: {isaac.email} liked {petersonkimberly.email}")
else:
    print(f"- Swipe already exists: {isaac.email} → {petersonkimberly.email} ({swipe1.action})")

swipe2, created2 = Swipe.objects.get_or_create(
    swiper=petersonkimberly,
    swiped_user=isaac,
    defaults={'action': 'like'}
)
if created2:
    print(f"✓ Created swipe: {petersonkimberly.email} liked {isaac.email}")
else:
    print(f"- Swipe already exists: {petersonkimberly.email} → {isaac.email} ({swipe2.action})")

# Check if match exists
match = Match.objects.filter(
    user1__in=[isaac, petersonkimberly],
    user2__in=[isaac, petersonkimberly]
).first()

if match:
    print(f"\n✓ Match already exists! Match ID: {match.id}")
    print(f"  User1: {match.user1.email}")
    print(f"  User2: {match.user2.email}")
    print(f"  Created: {match.created_at}")
else:
    # Create match if both users liked each other
    if swipe1.action == 'like' and swipe2.action == 'like':
        match = Match.objects.create(user1=isaac, user2=petersonkimberly)
        print(f"\n✓ Match created! Match ID: {match.id}")
        print(f"  User1: {match.user1.email}")
        print(f"  User2: {match.user2.email}")
    else:
        print("\n✗ Cannot create match - both users must like each other")

print("\n=== All Isaac's Matches ===")
isaac_matches = Match.objects.filter(user1=isaac) | Match.objects.filter(user2=isaac)
for m in isaac_matches:
    other_user = m.user2 if m.user1 == isaac else m.user1
    other_name = other_user.profile.full_name if hasattr(other_user, 'profile') else 'No profile'
    print(f"Match ID {m.id}: Isaac ↔ {other_user.email} ({other_name})")

print("\nDone!")
