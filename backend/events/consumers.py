"""
Event consumers for DatingConnect v1.1
Handles event processing for notifications, AI, analytics, etc.
"""

from . import EventConsumer, EventType, event_publisher
from django.contrib.auth import get_user_model
from notifications.models import Notification
from profiles.models import UserFeatureVector
from .ai_matching import EnhancedFeatureVector, explainable_matcher
from .analytics import analytics_service, dating_kpis, safety_analytics
import json
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class NotificationService(EventConsumer):
    """Handles notification events"""

    def __init__(self):
        super().__init__("notification_service", "notification_group")

    def process_event(self, event_data: dict):
        """Process events that require notifications"""
        event_type = event_data.get('event_type')

        if event_type == EventType.USER_MATCHED.value:
            self._handle_match_notification(event_data)
        elif event_type == EventType.MESSAGE_SENT.value:
            self._handle_message_notification(event_data)
        elif event_type == EventType.SUBSCRIPTION_STARTED.value:
            self._handle_subscription_notification(event_data)
        elif event_type == EventType.PROFILE_REPORTED.value:
            self._handle_report_notification(event_data)

    def _handle_match_notification(self, event_data: dict):
        """Send match notification"""
        payload = event_data.get('payload', {})
        user1_id = payload.get('user1_id')
        user2_id = payload.get('user2_id')

        # Notify both users
        for user_id in [user1_id, user2_id]:
            if user_id:
                Notification.objects.create(
                    user_id=user_id,
                    type='match',
                    title='New Match!',
                    message='You have a new match. Start a conversation!',
                    data={'match_id': payload.get('match_id')}
                )

    def _handle_message_notification(self, event_data: dict):
        """Send message notification"""
        payload = event_data.get('payload', {})
        recipient_id = payload.get('recipient_id')
        sender_id = payload.get('sender_id')

        if recipient_id and sender_id:
            try:
                sender = User.objects.get(id=sender_id)
                Notification.objects.create(
                    user_id=recipient_id,
                    type='message',
                    title='New Message',
                    message=f'You have a new message from {sender.first_name}',
                    data={'conversation_id': payload.get('conversation_id')}
                )
            except User.DoesNotExist:
                logger.error(f"User {sender_id} not found for message notification")

    def _handle_subscription_notification(self, event_data: dict):
        """Send subscription confirmation"""
        payload = event_data.get('payload', {})
        user_id = payload.get('user_id')
        plan_name = payload.get('plan_name', 'Premium')

        if user_id:
            Notification.objects.create(
                user_id=user_id,
                type='subscription',
                title='Welcome to Premium!',
                message=f'Your {plan_name} subscription is now active.',
                data={'plan_name': plan_name}
            )

    def _handle_report_notification(self, event_data: dict):
        """Notify admins of reports"""
        # This would notify admin users about reports
        payload = event_data.get('payload', {})
        logger.warning(f"Profile reported: {payload}")


class AIService(EventConsumer):
    """Handles AI-related events for enhanced matching and model training"""

    def __init__(self):
        super().__init__("ai_service", "ai_group")

    def process_event(self, event_data: dict):
        """Process events that affect AI models and matching"""
        event_type = event_data.get('event_type')

        if event_type in [EventType.SWIPE_LIKED.value, EventType.SWIPE_PASSED.value,
                         EventType.USER_MATCHED.value, EventType.USER_UNMATCHED.value,
                         EventType.MESSAGE_SENT.value, EventType.DATE_FEEDBACK_SUBMITTED.value,
                         EventType.PROFILE_COMPLETED.value, EventType.USER_REGISTERED.value]:
            self._update_user_features(event_data)

        elif event_type == EventType.MATCH_SUGGESTION_REQUESTED.value:
            self._generate_match_suggestions(event_data)

    def _update_user_features(self, event_data: dict):
        """Update user feature vectors using enhanced AI system"""
        actor_id = event_data.get('actor_id')
        if not actor_id:
            return

        try:
            user = User.objects.get(id=actor_id)

            # Use the enhanced feature vector builder
            feature_builder = EnhancedFeatureVector(user)
            feature_vector_data = feature_builder.vector

            # Save to database
            feature_vector, created = UserFeatureVector.objects.get_or_create(
                user=user,
                defaults={'feature_vector': feature_vector_data}
            )

            feature_vector.feature_vector = feature_vector_data
            feature_vector.save()

            logger.info(f"Updated feature vector for user {user.id}")

        except User.DoesNotExist:
            logger.error(f"User {actor_id} not found for AI feature update")
        except Exception as e:
            logger.error(f"Error updating AI features: {e}")

    def _generate_match_suggestions(self, event_data: dict):
        """Generate personalized match suggestions with explanations"""
        user_id = event_data.get('actor_id')
        if not user_id:
            return

        try:
            user = User.objects.get(id=user_id)

            # Get potential matches (this would be optimized with proper indexing)
            # For now, get users who haven't been swiped on
            from interactions.models import Swipe

            swiped_user_ids = Swipe.objects.filter(swiper=user).values_list('swiped', flat=True)
            potential_matches = User.objects.exclude(
                id__in=swiped_user_ids
            ).exclude(id=user.id)[:50]  # Limit for performance

            suggestions = []
            for potential_match in potential_matches:
                try:
                    score, reasons = explainable_matcher.calculate_match_score(user, potential_match)
                    if score > 0.6:  # Only suggest high-quality matches
                        suggestions.append({
                            'user_id': potential_match.id,
                            'score': score,
                            'reasons': reasons[:3]  # Top 3 reasons
                        })
                except Exception as e:
                    logger.error(f"Error calculating match score for {potential_match.id}: {e}")

            # Sort by score and take top 10
            suggestions.sort(key=lambda x: x['score'], reverse=True)
            top_suggestions = suggestions[:10]

            # Publish match suggestions event
            event_publisher.publish_event(
                EventType.MATCH_SUGGESTIONS_GENERATED,
                {
                    'user_id': user_id,
                    'suggestions': top_suggestions,
                    'total_candidates': len(potential_matches)
                },
                actor_id=user_id
            )

            logger.info(f"Generated {len(top_suggestions)} match suggestions for user {user_id}")

        except User.DoesNotExist:
            logger.error(f"User {user_id} not found for match suggestions")
        except Exception as e:
            logger.error(f"Error generating match suggestions: {e}")

    def _get_default_features(self) -> dict:
        """Get default feature vector structure"""
        return {
            "demographics": {
                "age": 25,
                "gender": "unknown",
                "location": [0, 0]
            },
            "preferences": {
                "age_range": [18, 100],
                "distance_km": 50,
                "intent": "casual"
            },
            "interests": [],
            "values": [],
            "behavioral_signals": {
                "total_likes": 0,
                "total_passes": 0,
                "total_matches": 0,
                "total_messages": 0,
                "like_rate": 0.0
            },
            "trust_score": 0.5,
            "engagement_score": 0.5
        }


class AnalyticsService(EventConsumer):
    """Handles comprehensive analytics and KPI tracking"""

    def __init__(self):
        super().__init__("analytics_service", "analytics_group")

    def process_event(self, event_data: dict):
        """Process events for comprehensive analytics tracking"""
        event_type = event_data.get('event_type')
        actor_id = event_data.get('actor_id')

        # Track user journey events
        if event_type in [EventType.USER_REGISTERED.value, EventType.PROFILE_COMPLETED.value,
                         EventType.SWIPE_LIKED.value, EventType.USER_MATCHED.value,
                         EventType.MESSAGE_SENT.value, EventType.SUBSCRIPTION_STARTED.value]:
            self._update_user_journey_analytics(event_data)

        # Track platform metrics
        if event_type == EventType.USER_MATCHED.value:
            self._track_match_conversion(event_data)
        elif event_type == EventType.SUBSCRIPTION_STARTED.value:
            self._track_subscription_conversion(event_data)
        elif event_type == EventType.PROFILE_REPORTED.value:
            self._track_safety_metric(event_data)
        elif event_type == EventType.EMERGENCY_TRIGGERED.value:
            self._track_emergency_metric(event_data)

        # Generate periodic reports (this would be triggered by a scheduler)
        # For now, triggered by specific events
        if event_type == EventType.USER_REGISTERED.value and self._should_generate_report():
            self._generate_periodic_report()

    def _update_user_journey_analytics(self, event_data: dict):
        """Update user journey analytics"""
        actor_id = event_data.get('actor_id')
        if not actor_id:
            return

        try:
            user = User.objects.get(id=actor_id)
            journey_data = analytics_service.track_user_journey(user)

            # Store journey data (this could be cached or stored in a dedicated table)
            logger.info(f"Updated journey analytics for user {user.id}: stage={journey_data['journey_stage']}")

        except User.DoesNotExist:
            logger.error(f"User {actor_id} not found for journey analytics")
        except Exception as e:
            logger.error(f"Error updating journey analytics: {e}")

    def _track_match_conversion(self, event_data: dict):
        """Track match conversion and success metrics"""
        payload = event_data.get('payload', {})
        user1_id = payload.get('user1_id')
        user2_id = payload.get('user2_id')

        # Calculate match success metrics for both users
        for user_id in [user1_id, user2_id]:
            if user_id:
                try:
                    user = User.objects.get(id=user_id)
                    success_metrics = dating_kpis.calculate_user_success_metrics(user)

                    logger.info(f"Match conversion tracked for user {user_id}: "
                              f"success_score={success_metrics['success_score']:.1f}")

                except User.DoesNotExist:
                    logger.error(f"User {user_id} not found for match conversion tracking")

    def _track_subscription_conversion(self, event_data: dict):
        """Track subscription conversion and revenue metrics"""
        payload = event_data.get('payload', {})
        user_id = payload.get('user_id')
        plan_name = payload.get('plan_name')

        logger.info(f"Subscription conversion tracked: User {user_id} started {plan_name}")

        # This would update revenue analytics
        # The comprehensive report generation handles this

    def _track_safety_metric(self, event_data: dict):
        """Track safety-related metrics and risk scoring"""
        payload = event_data.get('payload', {})
        reported_user_id = payload.get('reported_user_id')

        if reported_user_id:
            # Update safety analytics for the reported user
            safety_metrics = safety_analytics.calculate_safety_metrics()

            logger.warning(f"Safety incident tracked for user {reported_user_id}. "
                         f"Platform risk level: {safety_metrics['risk_assessment']['risk_level']}")

    def _track_emergency_metric(self, event_data: dict):
        """Track emergency response metrics"""
        payload = event_data.get('payload', {})
        user_id = payload.get('user_id')
        emergency_type = payload.get('emergency_type')

        logger.critical(f"Emergency tracked: User {user_id}, Type: {emergency_type}")

    def _should_generate_report(self) -> bool:
        """Determine if a periodic report should be generated"""
        # This would check if it's time for a report (e.g., end of day/week/month)
        # For now, generate reports occasionally
        import random
        return random.random() < 0.1  # 10% chance

    def _generate_periodic_report(self):
        """Generate and publish periodic analytics report"""
        try:
            report = analytics_service.generate_comprehensive_report()

            # Log key metrics
            dating = report['dating_success']
            safety = report['safety_metrics']
            business = report['business_metrics']

            logger.info("Periodic Analytics Report Generated:")
            logger.info(f"  Match Rate: {dating['matching_performance']['match_rate']:.1f}%")
            logger.info(f"  Safety Risk: {safety['risk_assessment']['risk_level']}")
            logger.info(f"  Revenue: ${business['revenue_metrics']['total_revenue']:.2f}")
            logger.info(f"  Growth Rate: {report['growth_metrics']['growth_rate']:.1f}%")

        except Exception as e:
            logger.error(f"Error generating periodic report: {e}")


class ModerationService(EventConsumer):
    """Handles content moderation and risk detection"""

    def __init__(self):
        super().__init__("moderation_service", "moderation_group")

    def process_event(self, event_data: dict):
        """Process events for moderation"""
        event_type = event_data.get('event_type')

        if event_type == EventType.PROFILE_REPORTED.value:
            self._handle_profile_report(event_data)
        elif event_type == EventType.CONTENT_FLAGGED.value:
            self._handle_content_flag(event_data)

    def _handle_profile_report(self, event_data: dict):
        """Handle profile reports"""
        payload = event_data.get('payload', {})
        reported_user_id = payload.get('reported_user_id')
        reporter_id = payload.get('reporter_id')
        reason = payload.get('reason')

        # Implement risk scoring and escalation logic
        logger.warning(f"Profile report: User {reported_user_id} reported by {reporter_id} for {reason}")

    def _handle_content_flag(self, event_data: dict):
        """Handle content flagging"""
        payload = event_data.get('payload', {})
        content_id = payload.get('content_id')
        content_type = payload.get('content_type')
        flag_reason = payload.get('flag_reason')

        logger.warning(f"Content flagged: {content_type} {content_id} flagged for {flag_reason}")


# Global consumer instances
notification_service = NotificationService()
ai_service = AIService()
analytics_service = AnalyticsService()
moderation_service = ModerationService()