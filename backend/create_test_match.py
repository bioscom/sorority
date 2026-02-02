#!/usr/bin/env python
"""Script to create a test match between two users."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import User
from profiles.models import Profile
from interactions.models import Swipe, Match

# List all users
print("\n=== Available Users ===")
users = User.objects.all()
for u in users:
    try:
        profile = u.profile
        print(f"ID: {u.id}, Email: {u.email}, Name: {profile.full_name}")
    except Profile.DoesNotExist:
        print(f"ID: {u.id}, Email: {u.email}, Name: No profile")

print("\n=== Creating Match ===")

# Find Isaac and Cassandra
try:
    isaac = User.objects.get(email__icontains='isaac')
    print(f"Found Isaac: {isaac.email} (ID: {isaac.id})")
except User.DoesNotExist:
    print("Isaac not found, trying by profile name...")
    isaac = User.objects.filter(profile__full_name__icontains='isaac').first()
    if isaac:
        print(f"Found Isaac: {isaac.email} (ID: {isaac.id})")
    else:
        print("Isaac not found!")
        exit(1)

try:
    cassandra = User.objects.get(email__icontains='cassandra')
    print(f"Found Cassandra: {cassandra.email} (ID: {cassandra.id})")
except User.DoesNotExist:
    print("Cassandra not found, trying by profile name...")
    cassandra = User.objects.filter(profile__full_name__icontains='cassandra').first()
    if cassandra:
        print(f"Found Cassandra: {cassandra.email} (ID: {cassandra.id})")
    else:
        print("Cassandra not found!")
        exit(1)

# Create swipes from Isaac to Cassandra
swipe1, created1 = Swipe.objects.get_or_create(
    swiper=isaac,
    swiped_user=cassandra,
    defaults={'action': 'like'}
)
if created1:
    print(f"✓ Created swipe: {isaac.email} liked {cassandra.email}")
else:
    print(f"- Swipe already exists: {isaac.email} → {cassandra.email} ({swipe1.action})")

# Create swipes from Cassandra to Isaac
swipe2, created2 = Swipe.objects.get_or_create(
    swiper=cassandra,
    swiped_user=isaac,
    defaults={'action': 'like'}
)
if created2:
    print(f"✓ Created swipe: {cassandra.email} liked {isaac.email}")
else:
    print(f"- Swipe already exists: {cassandra.email} → {isaac.email} ({swipe2.action})")

# Check if match exists
match = Match.objects.filter(
    user1__in=[isaac, cassandra],
    user2__in=[isaac, cassandra]
).first()

if match:
    print(f"\n✓ Match already exists! Match ID: {match.id}")
    print(f"  User1: {match.user1.email}")
    print(f"  User2: {match.user2.email}")
    print(f"  Created: {match.created_at}")
else:
    # Create match manually if it doesn't exist
    if swipe1.action == 'like' and swipe2.action == 'like':
        match = Match.objects.create(user1=isaac, user2=cassandra)
        print(f"\n✓ Match created! Match ID: {match.id}")
        print(f"  User1: {match.user1.email}")
        print(f"  User2: {match.user2.email}")
    else:
        print("\n✗ Cannot create match - both users must like each other")

print("\n=== All Matches ===")
all_matches = Match.objects.all()
for m in all_matches:
    print(f"Match ID {m.id}: {m.user1.email} ↔ {m.user2.email}")

print("\nDone!")
