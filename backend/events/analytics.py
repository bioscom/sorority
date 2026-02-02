"""
Comprehensive Analytics and KPIs for DatingConnect v1.1
Implements dating success metrics, safety monitoring, and business intelligence
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q, Count, Avg, Sum, F, Case, When, IntegerField
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth
from profiles.models import Profile
from interactions.models import Match, Swipe
from chat.models import Message, Conversation
from billing.models import UserSubscription, SubscriptionPlan
from notifications.models import Notification
from . import event_publisher, EventType
import logging
import json

logger = logging.getLogger(__name__)
User = get_user_model()


class DatingSuccessKPIs:
    """Key Performance Indicators for dating success"""

    def __init__(self):
        self.time_ranges = {
            'daily': timedelta(days=1),
            'weekly': timedelta(days=7),
            'monthly': timedelta(days=30),
            'quarterly': timedelta(days=90)
        }

    def calculate_platform_metrics(self, time_range: str = 'monthly') -> Dict[str, Any]:
        """Calculate overall platform dating success metrics"""
        since_date = timezone.now() - self.time_ranges.get(time_range, timedelta(days=30))

        # User engagement metrics
        total_users = User.objects.filter(date_joined__gte=since_date).count()
        active_users = User.objects.filter(last_login__gte=since_date).count()

        # Matching metrics
        total_swipes = Swipe.objects.filter(created_at__gte=since_date).count()
        total_likes = Swipe.objects.filter(
            action='like',
            created_at__gte=since_date
        ).count()
        total_matches = Match.objects.filter(created_at__gte=since_date).count()

        # Conversation metrics
        total_conversations = Conversation.objects.filter(
            created_at__gte=since_date
        ).count()
        total_messages = Message.objects.filter(created_at__gte=since_date).count()

        # Success metrics
        active_matches = Match.objects.filter(
            is_active=True,
            created_at__gte=since_date
        ).count()

        # Calculate derived metrics
        match_rate = (total_matches / total_swipes * 100) if total_swipes > 0 else 0
        conversation_rate = (total_conversations / total_matches * 100) if total_matches > 0 else 0
        messages_per_conversation = (total_messages / total_conversations) if total_conversations > 0 else 0

        return {
            'time_range': time_range,
            'user_engagement': {
                'total_users': total_users,
                'active_users': active_users,
                'user_engagement_rate': (active_users / total_users * 100) if total_users > 0 else 0
            },
            'matching_performance': {
                'total_swipes': total_swipes,
                'total_likes': total_likes,
                'total_matches': total_matches,
                'match_rate': match_rate,
                'like_rate': (total_likes / total_swipes * 100) if total_swipes > 0 else 0
            },
            'conversation_metrics': {
                'total_conversations': total_conversations,
                'total_messages': total_messages,
                'conversation_rate': conversation_rate,
                'messages_per_conversation': messages_per_conversation
            },
            'success_indicators': {
                'active_matches': active_matches,
                'match_retention_rate': (active_matches / total_matches * 100) if total_matches > 0 else 0
            },
            'calculated_at': timezone.now().isoformat()
        }

    def calculate_user_success_metrics(self, user: User) -> Dict[str, Any]:
        """Calculate individual user success metrics"""
        # Profile completion
        profile_completion = user.profile.calculate_completion_score() if user.profile else 0

        # Matching performance
        user_swipes = Swipe.objects.filter(swiper=user)
        total_swipes = user_swipes.count()
        likes_given = user_swipes.filter(action='like').count()

        # Matches received
        matches_as_user1 = Match.objects.filter(user1=user)
        matches_as_user2 = Match.objects.filter(user2=user)
        total_matches = matches_as_user1.count() + matches_as_user2.count()

        # Active conversations
        conversations = Conversation.objects.filter(
            Q(match__user1=user) | Q(match__user2=user)
        )
        active_conversations = conversations.filter(is_active=True).count()

        # Message activity
        messages_sent = Message.objects.filter(sender=user).count()
        messages_received = Message.objects.filter(
            conversation__in=conversations,
            sender__in=[conv.match.user1 for conv in conversations if conv.match.user1 != user] +
                       [conv.match.user2 for conv in conversations if conv.match.user2 != user]
        ).count()

        # Response rate
        response_rate = (messages_sent / messages_received * 100) if messages_received > 0 else 0

        return {
            'user_id': user.id,
            'profile_completion': profile_completion,
            'matching_activity': {
                'total_swipes': total_swipes,
                'likes_given': likes_given,
                'like_rate': (likes_given / total_swipes * 100) if total_swipes > 0 else 0,
                'total_matches': total_matches
            },
            'conversation_activity': {
                'total_conversations': conversations.count(),
                'active_conversations': active_conversations,
                'messages_sent': messages_sent,
                'messages_received': messages_received,
                'response_rate': response_rate
            },
            'success_score': self._calculate_user_success_score(user),
            'calculated_at': timezone.now().isoformat()
        }

    def _calculate_user_success_score(self, user: User) -> float:
        """Calculate overall success score for a user (0-100)"""
        score = 0

        # Profile completion (20 points)
        if user.profile:
            completion = user.profile.calculate_completion_score()
            score += (completion / 100) * 20

        # Activity level (20 points)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_swipes = Swipe.objects.filter(
            swiper=user,
            created_at__gte=thirty_days_ago
        ).count()
        activity_score = min(recent_swipes / 50, 1) * 20
        score += activity_score

        # Match success (30 points)
        total_matches = Match.objects.filter(
            Q(user1=user) | Q(user2=user)
        ).count()

        active_matches = Match.objects.filter(
            Q(user1=user) | Q(user2=user),
            is_active=True
        ).count()

        if total_matches > 0:
            match_success = (active_matches / total_matches) * 30
            score += match_success

        # Conversation quality (30 points)
        conversations = Conversation.objects.filter(
            Q(match__user1=user) | Q(match__user2=user)
        )

        if conversations.exists():
            avg_messages = conversations.annotate(
                msg_count=Count('messages')
            ).aggregate(avg=Avg('msg_count'))['avg'] or 0

            conversation_score = min(avg_messages / 20, 1) * 30
            score += conversation_score

        return min(score, 100)


class SafetyAnalytics:
    """Safety and risk monitoring analytics"""

    def __init__(self):
        self.risk_levels = {
            'low': {'threshold': 0.3, 'color': 'green'},
            'medium': {'threshold': 0.6, 'color': 'yellow'},
            'high': {'threshold': 0.8, 'color': 'red'},
            'critical': {'threshold': 1.0, 'color': 'black'}
        }

    def calculate_safety_metrics(self, time_range: str = 'monthly') -> Dict[str, Any]:
        """Calculate platform safety and risk metrics"""
        since_date = timezone.now() - timedelta(days=30 if time_range == 'monthly' else 7)

        # User verification rates
        total_users = User.objects.filter(date_joined__gte=since_date).count()
        verified_users = User.objects.filter(
            is_verified=True,
            date_joined__gte=since_date
        ).count()

        # Photo verification (simplified)
        users_with_photos = Profile.objects.filter(
            user__date_joined__gte=since_date,
            photos__isnull=False
        ).distinct().count()

        # Report metrics (would need a reports model)
        # For now, assume low report rates
        reported_users = 0
        total_reports = 0

        # Emergency triggers
        # This would count emergency events
        emergency_triggers = 0

        # Calculate rates
        verification_rate = (verified_users / total_users * 100) if total_users > 0 else 0
        photo_verification_rate = (users_with_photos / total_users * 100) if total_users > 0 else 0
        report_rate = (total_reports / total_users * 100) if total_users > 0 else 0

        # Risk assessment
        risk_score = self._calculate_platform_risk_score(
            verification_rate, photo_verification_rate, report_rate
        )

        return {
            'time_range': time_range,
            'verification_metrics': {
                'total_users': total_users,
                'verified_users': verified_users,
                'verification_rate': verification_rate,
                'photo_verification_rate': photo_verification_rate
            },
            'safety_incidents': {
                'total_reports': total_reports,
                'reported_users': reported_users,
                'report_rate': report_rate,
                'emergency_triggers': emergency_triggers
            },
            'risk_assessment': {
                'risk_score': risk_score,
                'risk_level': self._get_risk_level(risk_score),
                'recommendations': self._get_safety_recommendations(risk_score)
            },
            'calculated_at': timezone.now().isoformat()
        }

    def _calculate_platform_risk_score(self, verification_rate: float,
                                     photo_verification_rate: float,
                                     report_rate: float) -> float:
        """Calculate overall platform risk score (0-1)"""
        # High verification rates reduce risk
        verification_factor = (100 - verification_rate) / 100
        photo_factor = (100 - photo_verification_rate) / 100

        # High report rates increase risk
        report_factor = min(report_rate / 10, 1)  # Cap at 10% reports

        # Weighted risk score
        risk_score = (verification_factor * 0.3 +
                     photo_factor * 0.3 +
                     report_factor * 0.4)

        return min(risk_score, 1.0)

    def _get_risk_level(self, risk_score: float) -> str:
        """Get risk level based on score"""
        for level, config in self.risk_levels.items():
            if risk_score <= config['threshold']:
                return level
        return 'critical'

    def _get_safety_recommendations(self, risk_score: float) -> List[str]:
        """Get safety recommendations based on risk score"""
        recommendations = []

        if risk_score > 0.8:
            recommendations.extend([
                "Implement stricter verification requirements",
                "Increase content moderation",
                "Add emergency response protocols"
            ])
        elif risk_score > 0.6:
            recommendations.extend([
                "Enhance photo verification process",
                "Monitor high-risk users more closely",
                "Improve reporting mechanisms"
            ])
        elif risk_score > 0.3:
            recommendations.extend([
                "Continue monitoring verification rates",
                "Regular safety audits recommended"
            ])
        else:
            recommendations.append("Safety metrics are within acceptable ranges")

        return recommendations


class BusinessIntelligence:
    """Business intelligence and monetization analytics"""

    def calculate_revenue_metrics(self, time_range: str = 'monthly') -> Dict[str, Any]:
        """Calculate revenue and monetization metrics"""
        since_date = timezone.now() - timedelta(days=30 if time_range == 'monthly' else 7)

        # Subscription metrics
        active_subscriptions = UserSubscription.objects.filter(
            is_active=True,
            created_at__gte=since_date
        )

        total_revenue = active_subscriptions.aggregate(
            total=Sum('plan__price')
        )['total'] or 0

        subscription_count = active_subscriptions.count()

        # Plan distribution
        plan_distribution = active_subscriptions.values('plan__name').annotate(
            count=Count('id')
        ).order_by('-count')

        # Churn metrics
        churned_subscriptions = UserSubscription.objects.filter(
            is_active=False,
            cancelled_at__gte=since_date
        ).count()

        # ARPU (Average Revenue Per User)
        total_users = User.objects.filter(date_joined__gte=since_date).count()
        arpu = (total_revenue / total_users) if total_users > 0 else 0

        # LTV (Lifetime Value) - simplified calculation
        avg_subscription_length = active_subscriptions.aggregate(
            avg_length=Avg(F('cancelled_at') - F('created_at'))
        )['avg_length']

        return {
            'time_range': time_range,
            'revenue_metrics': {
                'total_revenue': float(total_revenue),
                'subscription_count': subscription_count,
                'arpu': float(arpu),
                'plan_distribution': list(plan_distribution)
            },
            'retention_metrics': {
                'active_subscriptions': subscription_count,
                'churned_subscriptions': churned_subscriptions,
                'churn_rate': (churned_subscriptions / (subscription_count + churned_subscriptions) * 100)
                              if (subscription_count + churned_subscriptions) > 0 else 0
            },
            'calculated_at': timezone.now().isoformat()
        }

    def calculate_growth_metrics(self) -> Dict[str, Any]:
        """Calculate user growth and acquisition metrics"""
        # Daily active users over time
        dau_data = User.objects.filter(
            last_login__date__gte=timezone.now().date() - timedelta(days=30)
        ).annotate(
            date=TruncDay('last_login')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')

        # Weekly registrations
        weekly_registrations = User.objects.filter(
            date_joined__gte=timezone.now() - timedelta(days=90)
        ).annotate(
            week=TruncWeek('date_joined')
        ).values('week').annotate(
            count=Count('id')
        ).order_by('week')

        # Growth rate
        current_week = timezone.now().date() - timedelta(days=7)
        previous_week = current_week - timedelta(days=7)

        current_registrations = User.objects.filter(
            date_joined__date__gte=current_week,
            date_joined__date__lt=current_week + timedelta(days=7)
        ).count()

        previous_registrations = User.objects.filter(
            date_joined__date__gte=previous_week,
            date_joined__date__lt=previous_week + timedelta(days=7)
        ).count()

        growth_rate = ((current_registrations - previous_registrations) /
                      previous_registrations * 100) if previous_registrations > 0 else 0

        return {
            'growth_rate': growth_rate,
            'current_week_registrations': current_registrations,
            'previous_week_registrations': previous_registrations,
            'dau_trend': list(dau_data),
            'weekly_registrations': list(weekly_registrations),
            'calculated_at': timezone.now().isoformat()
        }


class AnalyticsService:
    """Main analytics service that coordinates all KPI calculations"""

    def __init__(self):
        self.dating_kpis = DatingSuccessKPIs()
        self.safety_analytics = SafetyAnalytics()
        self.business_intelligence = BusinessIntelligence()

    def generate_comprehensive_report(self, time_range: str = 'monthly') -> Dict[str, Any]:
        """Generate comprehensive analytics report"""
        report = {
            'time_range': time_range,
            'dating_success': self.dating_kpis.calculate_platform_metrics(time_range),
            'safety_metrics': self.safety_analytics.calculate_safety_metrics(time_range),
            'business_metrics': self.business_intelligence.calculate_revenue_metrics(time_range),
            'growth_metrics': self.business_intelligence.calculate_growth_metrics(),
            'generated_at': timezone.now().isoformat()
        }

        # Publish analytics report event
        event_publisher.publish_event(
            EventType.ANALYTICS_REPORT_GENERATED,
            {
                'report_type': 'comprehensive',
                'time_range': time_range,
                'summary': {
                    'match_rate': report['dating_success']['matching_performance']['match_rate'],
                    'safety_risk_level': report['safety_metrics']['risk_assessment']['risk_level'],
                    'total_revenue': report['business_metrics']['revenue_metrics']['total_revenue'],
                    'growth_rate': report['growth_metrics']['growth_rate']
                }
            }
        )

        return report

    def track_user_journey(self, user: User) -> Dict[str, Any]:
        """Track complete user journey analytics"""
        journey = {
            'user_id': user.id,
            'registration_date': user.date_joined.isoformat(),
            'profile_completion': self.dating_kpis.calculate_user_success_metrics(user),
            'journey_stage': self._determine_journey_stage(user),
            'time_to_first_match': self._calculate_time_to_first_match(user),
            'engagement_score': self._calculate_engagement_score(user)
        }

        return journey

    def _determine_journey_stage(self, user: User) -> str:
        """Determine user's current journey stage"""
        if not user.profile or user.profile.calculate_completion_score() < 50:
            return 'profile_setup'

        total_swipes = Swipe.objects.filter(swiper=user).count()
        if total_swipes < 10:
            return 'exploration'

        total_matches = Match.objects.filter(
            Q(user1=user) | Q(user2=user)
        ).count()

        if total_matches == 0:
            return 'matching'

        active_conversations = Conversation.objects.filter(
            Q(match__user1=user) | Q(match__user2=user),
            is_active=True
        ).count()

        if active_conversations == 0:
            return 'conversation'

        return 'engaged'

    def _calculate_time_to_first_match(self, user: User) -> Optional[int]:
        """Calculate days to first match"""
        first_match = Match.objects.filter(
            Q(user1=user) | Q(user2=user)
        ).order_by('created_at').first()

        if first_match:
            days = (first_match.created_at.date() - user.date_joined.date()).days
            return max(days, 0)

        return None

    def _calculate_engagement_score(self, user: User) -> float:
        """Calculate user engagement score (0-100)"""
        score = 0

        # Login frequency (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        login_count = 0  # This would need login tracking

        # Activity score
        recent_swipes = Swipe.objects.filter(
            swiper=user,
            created_at__gte=thirty_days_ago
        ).count()

        recent_messages = Message.objects.filter(
            sender=user,
            created_at__gte=thirty_days_ago
        ).count()

        activity_score = min((recent_swipes + recent_messages) / 100, 1) * 50
        score += activity_score

        # Success score
        success_score = self.dating_kpis._calculate_user_success_score(user) / 100 * 50
        score += success_score

        return min(score, 100)


# Global instances
analytics_service = AnalyticsService()
dating_kpis = DatingSuccessKPIs()
safety_analytics = SafetyAnalytics()
business_intelligence = BusinessIntelligence()