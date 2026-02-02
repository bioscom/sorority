#!/usr/bin/env python
"""Script to check all matches for Isaac."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import User
from interactions.models import Match, Swipe

print("\n=== Checking Isaac's Matches ===")

# Find Isaac
try:
    isaac = User.objects.get(email='isaac.bejide@gmail.com')
    print(f"✓ Found Isaac: {isaac.email} (ID: {isaac.id})")
except User.DoesNotExist:
    print("✗ Isaac not found!")
    exit(1)

# Find all matches involving Isaac
isaac_matches = Match.objects.filter(user1=isaac) | Match.objects.filter(user2=isaac)
print(f"\nTotal matches: {isaac_matches.count()}")

for match in isaac_matches:
    other_user = match.user2 if match.user1 == isaac else match.user1
    profile_name = other_user.profile.full_name if hasattr(other_user, 'profile') else 'No profile'
    print(f"\nMatch ID {match.id}:")
    print(f"  - Created: {match.created_at}")
    print(f"  - Other user: {other_user.email}")
    print(f"  - Name: {profile_name}")
    print(f"  - Active: {match.is_active}")

# Check all swipes involving Isaac
print("\n\n=== Isaac's Swipes (Sent) ===")
isaac_swipes = Swipe.objects.filter(swiper=isaac)
for swipe in isaac_swipes:
    profile_name = swipe.swiped_user.profile.full_name if hasattr(swipe.swiped_user, 'profile') else 'No profile'
    print(f"- {swipe.action}: {swipe.swiped_user.email} ({profile_name})")

print("\n=== Swipes Received by Isaac ===")
received_swipes = Swipe.objects.filter(swiped_user=isaac)
for swipe in received_swipes:
    profile_name = swipe.swiper.profile.full_name if hasattr(swipe.swiper, 'profile') else 'No profile'
    print(f"- {swipe.action} from: {swipe.swiper.email} ({profile_name})")

# Check for users named Cassandra or Joseph
print("\n\n=== Checking for Cassandra and Joseph ===")
cassandra_users = User.objects.filter(email__icontains='cassandra')
print(f"Found {cassandra_users.count()} users with 'cassandra' in email:")
for u in cassandra_users:
    profile_name = u.profile.full_name if hasattr(u, 'profile') else 'No profile'
    print(f"  - ID {u.id}: {u.email} -> {profile_name}")

joseph_users = User.objects.filter(profile__full_name__icontains='joseph')
print(f"\nFound {joseph_users.count()} users with 'joseph' in profile name:")
for u in joseph_users:
    print(f"  - ID {u.id}: {u.email} -> {u.profile.full_name}")

print("\nDone!")
