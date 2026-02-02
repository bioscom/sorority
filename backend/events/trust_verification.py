"""
Trust and Verification System for DatingConnect v1.1
Implements tiered trust levels (L0-L4) with photo/video verification and safety features
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q, Count, Avg
from profiles.models import Profile
from interactions.models import Match, Swipe
from chat.models import Message
from notifications.models import Notification
from . import event_publisher, EventType
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class TrustVerificationSystem:
    """Tiered trust and verification system"""

    TRUST_LEVELS = {
        0: {
            'name': 'Basic',
            'requirements': [],
            'capabilities': ['browse_profiles'],
            'description': 'Basic access with limited features'
        },
        1: {
            'name': 'Email Verified',
            'requirements': ['email_verified'],
            'capabilities': ['browse_profiles', 'send_messages'],
            'description': 'Email verified users can chat'
        },
        2: {
            'name': 'Photo Verified',
            'requirements': ['email_verified', 'photo_verified'],
            'capabilities': ['browse_profiles', 'send_messages', 'video_chat'],
            'description': 'Photo verified users can video chat'
        },
        3: {
            'name': 'ID Verified',
            'requirements': ['email_verified', 'photo_verified', 'id_verified'],
            'capabilities': ['browse_profiles', 'send_messages', 'video_chat', 'boost_priority'],
            'description': 'ID verified users get priority matching'
        },
        4: {
            'name': 'Trusted Member',
            'requirements': ['email_verified', 'photo_verified', 'id_verified', 'behavioral_trust'],
            'capabilities': ['browse_profiles', 'send_messages', 'video_chat', 'boost_priority', 'featured_placement'],
            'description': 'Trusted members get featured placement and premium features'
        }
    }

    VERIFICATION_TYPES = {
        'email': {'level': 1, 'auto_verifiable': True},
        'photo': {'level': 2, 'auto_verifiable': False, 'requires_review': True},
        'video': {'level': 2, 'auto_verifiable': False, 'requires_review': True},
        'id_document': {'level': 3, 'auto_verifiable': False, 'requires_review': True},
        'background_check': {'level': 4, 'auto_verifiable': False, 'requires_review': True}
    }

    def __init__(self):
        self.max_trust_level = 4

    def assess_trust_level(self, user: User) -> int:
        """Assess user's current trust level based on verifications"""
        level = 0

        # Check email verification
        if user.is_verified:
            level = max(level, 1)

        # Check photo verification (assume verified if they have a primary photo for now)
        if user.profile and user.profile.photos.filter(is_primary=True).exists():
            level = max(level, 2)

        # Additional verifications would be checked here
        # For now, return the assessed level
        return min(level, self.max_trust_level)

    def get_required_verifications(self, current_level: int, target_level: int) -> List[str]:
        """Get required verifications to reach target level"""
        if target_level <= current_level or target_level > self.max_trust_level:
            return []

        required = []
        for level in range(current_level + 1, target_level + 1):
            level_reqs = self.TRUST_LEVELS[level]['requirements']
            required.extend([req for req in level_reqs if req not in required])

        return required

    def can_access_feature(self, user: User, feature: str) -> bool:
        """Check if user can access a specific feature"""
        trust_level = self.assess_trust_level(user)
        level_capabilities = self.TRUST_LEVELS[trust_level]['capabilities']
        return feature in level_capabilities

    def request_verification(self, user: User, verification_type: str, evidence: Dict[str, Any] = None) -> bool:
        """Request verification for a user"""
        if verification_type not in self.VERIFICATION_TYPES:
            return False

        # Publish verification request event
        event_publisher.publish_event(
            EventType.VERIFICATION_REQUESTED,
            {
                'user_id': user.id,
                'verification_type': verification_type,
                'evidence': evidence or {},
                'requested_at': timezone.now().isoformat()
            },
            actor_id=str(user.id)
        )

        # Notify user
        Notification.objects.create(
            user=user,
            type='verification',
            title='Verification Request Submitted',
            message=f'Your {verification_type} verification request has been submitted for review.',
            data={'verification_type': verification_type}
        )

        return True

    def approve_verification(self, user_id: int, verification_type: str, approved_by: User) -> bool:
        """Approve a verification request"""
        try:
            user = User.objects.get(id=user_id)

            # Update user's verification status
            if verification_type == 'email':
                user.is_verified = True
                user.save()
            # Additional verification types would update profile fields

            # Calculate new trust level
            new_trust_level = self.assess_trust_level(user)

            # Publish trust level update event
            event_publisher.publish_event(
                EventType.TRUST_LEVEL_UPDATED,
                {
                    'user_id': user.id,
                    'new_trust_level': new_trust_level,
                    'verification_approved': verification_type,
                    'approved_by': approved_by.id
                },
                actor_id=str(approved_by.id)
            )

            # Notify user
            level_info = self.TRUST_LEVELS[new_trust_level]
            Notification.objects.create(
                user=user,
                type='verification',
                title='Verification Approved!',
                message=f'Congratulations! You are now a {level_info["name"]} member.',
                data={'new_trust_level': new_trust_level}
            )

            return True

        except User.DoesNotExist:
            logger.error(f"User {user_id} not found for verification approval")
            return False

    def calculate_behavioral_trust_score(self, user: User) -> float:
        """Calculate behavioral trust score based on user actions"""
        score = 0.5  # Base score

        # Positive factors
        thirty_days_ago = timezone.now() - timedelta(days=30)

        # Communication quality
        messages_sent = Message.objects.filter(
            sender=user,
            created_at__gte=thirty_days_ago
        ).count()

        if messages_sent > 10:
            score += 0.1

        # Match success rate
        total_matches = Match.objects.filter(
            Q(user1=user) | Q(user2=user),
            created_at__gte=thirty_days_ago
        ).count()

        active_matches = Match.objects.filter(
            Q(user1=user) | Q(user2=user),
            is_active=True,
            created_at__gte=thirty_days_ago
        ).count()

        if total_matches > 0:
            match_success_rate = active_matches / total_matches
            score += match_success_rate * 0.2

        # Negative factors (reports, blocks, etc.)
        # This would subtract from score if user has been reported

        return min(max(score, 0.0), 1.0)


class SafetyMonitor:
    """Safety monitoring and emergency response system"""

    def __init__(self):
        self.risk_thresholds = {
            'message_frequency': 50,  # messages per hour
            'report_threshold': 3,    # reports before action
            'suspicious_login_threshold': 5  # failed logins per hour
        }

    def monitor_user_activity(self, user: User) -> Dict[str, Any]:
        """Monitor user activity for safety concerns"""
        alerts = []

        # Check message frequency
        hour_ago = timezone.now() - timedelta(hours=1)
        recent_messages = Message.objects.filter(
            sender=user,
            created_at__gte=hour_ago
        ).count()

        if recent_messages > self.risk_thresholds['message_frequency']:
            alerts.append({
                'type': 'high_message_frequency',
                'severity': 'medium',
                'message': f'User sent {recent_messages} messages in the last hour'
            })

        # Check for reports against user
        # This would check a reports model
        # For now, assume no reports

        return {
            'user_id': user.id,
            'alerts': alerts,
            'risk_level': 'low' if not alerts else 'medium',
            'monitored_at': timezone.now().isoformat()
        }

    def trigger_emergency_response(self, user: User, emergency_type: str, details: Dict[str, Any]):
        """Trigger emergency response for safety concerns"""
        event_publisher.publish_event(
            EventType.EMERGENCY_TRIGGERED,
            {
                'user_id': user.id,
                'emergency_type': emergency_type,
                'details': details,
                'triggered_at': timezone.now().isoformat()
            },
            actor_id=str(user.id)
        )

        logger.warning(f"Emergency triggered for user {user.id}: {emergency_type}")


class ContentModerationService:
    """AI-powered content moderation for photos and text"""

    def __init__(self):
        self.moderation_threshold = 0.8  # Confidence threshold for flagging

    def moderate_photo(self, photo) -> Dict[str, Any]:
        """Moderate uploaded photo for inappropriate content"""
        # This would integrate with an AI moderation service
        # For now, return a mock result
        result = {
            'approved': True,
            'confidence': 0.95,
            'flags': [],
            'moderated_at': timezone.now().isoformat()
        }

        if not result['approved']:
            event_publisher.publish_event(
                EventType.CONTENT_FLAGGED,
                {
                    'content_type': 'photo',
                    'content_id': photo.id,
                    'user_id': photo.profile.user.id,
                    'flags': result['flags'],
                    'confidence': result['confidence']
                },
                actor_id=str(photo.profile.user.id)
            )

        return result

    def moderate_text(self, text: str, user: User) -> Dict[str, Any]:
        """Moderate text content for inappropriate language"""
        # This would integrate with text moderation AI
        # For now, return a mock result
        result = {
            'approved': True,
            'confidence': 0.92,
            'flags': [],
            'moderated_at': timezone.now().isoformat()
        }

        if not result['approved']:
            event_publisher.publish_event(
                EventType.CONTENT_FLAGGED,
                {
                    'content_type': 'text',
                    'user_id': user.id,
                    'content': text[:100],  # Truncated for privacy
                    'flags': result['flags'],
                    'confidence': result['confidence']
                },
                actor_id=str(user.id)
            )

        return result


# Global instances
trust_system = TrustVerificationSystem()
safety_monitor = SafetyMonitor()
content_moderator = ContentModerationService()