import logging
from typing import Optional

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils.crypto import get_random_string

from profiles.models import Photo, Profile

PLACEHOLDER_URL = "https://picsum.photos/seed/{seed}/800/1000"
LOGGER = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Generate placeholder photos so every profile has a minimum number of images."

    def add_arguments(self, parser):
        parser.add_argument(
            "--per-profile",
            type=int,
            default=4,
            help="Minimum number of photos each profile should have (default: 4)",
        )
        parser.add_argument(
            "--max-profiles",
            type=int,
            default=None,
            help="Optional limit of profiles to process during this run.",
        )

    def handle(self, *args, **options):
        per_profile: int = options["per_profile"]
        max_profiles: Optional[int] = options.get("max_profiles")

        if per_profile < 1:
            self.stderr.write(self.style.ERROR("per-profile must be at least 1"))
            return

        queryset = Profile.objects.order_by("id")
        if max_profiles:
            queryset = queryset[:max_profiles]

        total_created = 0
        processed_profiles = 0

        for profile in queryset:
            processed_profiles += 1
            existing_photos = profile.photos.count()
            needed = per_profile - existing_photos

            if needed <= 0:
                continue

            has_primary = profile.photos.filter(is_primary=True).exists()
            self.stdout.write(
                f"Profile {profile.id} ({profile.full_name}) has {existing_photos} photos. Generating {needed} placeholders..."
            )

            for offset in range(needed):
                try:
                    photo = self._create_placeholder_photo(
                        profile=profile,
                        should_be_primary=not has_primary and offset == 0,
                    )
                    has_primary = has_primary or photo.is_primary
                    total_created += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  Added photo #{existing_photos + offset + 1} for profile {profile.id}"
                        )
                    )
                except requests.RequestException as exc:
                    message = f"  Failed to fetch placeholder image for profile {profile.id}: {exc}"
                    LOGGER.exception(message)
                    self.stderr.write(self.style.ERROR(message))
                    break

        self.stdout.write(
            self.style.SUCCESS(
                f"Finished processing {processed_profiles} profiles. Created {total_created} placeholder photos."
            )
        )

    def _create_placeholder_photo(self, profile: Profile, should_be_primary: bool) -> Photo:
        seed = f"{profile.slug}-{get_random_string(8)}"
        url = PLACEHOLDER_URL.format(seed=seed)
        response = requests.get(url, timeout=20)
        response.raise_for_status()

        photo = Photo(profile=profile, is_primary=should_be_primary)
        filename = f"{seed}.jpg"
        photo.image.save(filename, ContentFile(response.content), save=False)
        photo.save()
        return photo
