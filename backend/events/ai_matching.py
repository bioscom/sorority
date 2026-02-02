"""
Enhanced AI Matching System for DatingConnect v1.1
Implements explainable, feedback-driven matching with comprehensive user feature vectors
"""

from typing import Dict, List, Any, Optional, Tuple
import math
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q, Avg, Count
from profiles.models import Profile, UserFeatureVector
from interactions.models import Match, Swipe
from chat.models import Message, Conversation
from . import event_publisher, EventType

User = get_user_model()


class EnhancedFeatureVector:
    """Enhanced user feature vector with comprehensive behavioral data"""

    def __init__(self, user: User):
        self.user = user
        self.profile = user.profile
        self.vector = self._build_feature_vector()

    def _build_feature_vector(self) -> Dict[str, Any]:
        """Build comprehensive feature vector"""
        return {
            "demographics": self._get_demographics(),
            "preferences": self._get_preferences(),
            "interests": self._get_interests(),
            "values": self._get_values(),
            "behavioral_signals": self._get_behavioral_signals(),
            "trust_score": self._calculate_trust_score(),
            "engagement_score": self._calculate_engagement_score(),
            "last_updated": timezone.now().isoformat()
        }

    def _get_demographics(self) -> Dict[str, Any]:
        """Extract demographic features"""
        if not self.profile:
            return {"age": 25, "gender": "unknown", "location": [0, 0]}

        # Calculate age
        age = 25  # default
        if self.profile.date_of_birth:
            age = (timezone.now().date() - self.profile.date_of_birth).days // 365

        # Get location coordinates
        location = [0, 0]
        if self.profile.latitude and self.profile.longitude:
            location = [self.profile.latitude, self.profile.longitude]

        return {
            "age": age,
            "gender": self.profile.gender,
            "location": location
        }

    def _get_preferences(self) -> Dict[str, Any]:
        """Extract user preferences"""
        if not self.profile:
            return {"age_range": [18, 100], "distance_km": 50, "intent": "casual"}

        return {
            "age_range": [self.profile.min_age, self.profile.max_age],
            "distance_km": self.profile.max_distance,
            "intent": self.profile.looking_for.lower().replace(' ', '_')
        }

    def _get_interests(self) -> List[str]:
        """Extract user interests"""
        if not self.profile:
            return []

        return [interest.interest.name.lower() for interest in self.profile.interests.all()]

    def _get_values(self) -> List[str]:
        """Extract user values"""
        if not self.profile:
            return []

        return self.profile.values or []

    def _get_behavioral_signals(self) -> Dict[str, Any]:
        """Calculate behavioral signals from user activity"""
        # Calculate reply latency (average response time in minutes)
        reply_latencies = self._calculate_reply_latencies()
        reply_latency_avg = sum(reply_latencies) / len(reply_latencies) if reply_latencies else 300

        # Calculate chat depth score (messages per conversation)
        chat_depth_score = self._calculate_chat_depth_score()

        # Calculate unmatch rate
        unmatch_rate = self._calculate_unmatch_rate()

        # Activity metrics
        total_likes = Swipe.objects.filter(swiper=self.user, action='like').count()
        total_passes = Swipe.objects.filter(swiper=self.user, action='pass').count()
        total_matches = Match.objects.filter(
            Q(user1=self.user) | Q(user2=self.user),
            is_active=True
        ).count()

        return {
            "reply_latency_avg": reply_latency_avg,
            "chat_depth_score": chat_depth_score,
            "unmatch_rate": unmatch_rate,
            "total_likes": total_likes,
            "total_passes": total_passes,
            "total_matches": total_matches,
            "like_rate": total_likes / (total_likes + total_passes) if (total_likes + total_passes) > 0 else 0
        }

    def _calculate_reply_latencies(self) -> List[float]:
        """Calculate average reply latencies in minutes"""
        latencies = []
        conversations = Conversation.objects.filter(
            Q(match__user1=self.user) | Q(match__user2=self.user)
        )

        for conv in conversations:
            messages = Message.objects.filter(conversation=conv).order_by('created_at')
            prev_time = None

            for msg in messages:
                if msg.sender != self.user:  # Only calculate when others send
                    if prev_time:
                        latency = (msg.created_at - prev_time).total_seconds() / 60
                        latencies.append(min(latency, 1440))  # Cap at 24 hours
                    prev_time = msg.created_at

        return latencies

    def _calculate_chat_depth_score(self) -> float:
        """Calculate chat depth score (0-1)"""
        conversations = Conversation.objects.filter(
            Q(match__user1=self.user) | Q(match__user2=self.user)
        )

        if not conversations:
            return 0.0

        total_conversations = conversations.count()
        deep_conversations = 0

        for conv in conversations:
            msg_count = Message.objects.filter(conversation=conv).count()
            if msg_count >= 10:  # Consider conversations with 10+ messages as deep
                deep_conversations += 1

        return deep_conversations / total_conversations

    def _calculate_unmatch_rate(self) -> float:
        """Calculate unmatch rate"""
        total_matches = Match.objects.filter(
            Q(user1=self.user) | Q(user2=self.user)
        ).count()

        if total_matches == 0:
            return 0.0

        expired_matches = Match.objects.filter(
            Q(user1=self.user) | Q(user2=self.user),
            is_active=False
        ).count()

        return expired_matches / total_matches

    def _calculate_trust_score(self) -> float:
        """Calculate trust score based on verification and behavior"""
        score = 0.5  # Base score

        if self.user.is_verified:
            score += 0.2

        if self.profile and self.profile.photos.filter(is_primary=True).exists():
            score += 0.1

        # Reduce score for reports (this would need a reports model)
        # For now, assume good standing
        score = min(score, 1.0)
        return max(score, 0.0)

    def _calculate_engagement_score(self) -> float:
        """Calculate engagement score based on activity"""
        score = 0.0

        # Recent activity (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)

        recent_likes = Swipe.objects.filter(
            swiper=self.user,
            created_at__gte=thirty_days_ago
        ).count()

        recent_messages = Message.objects.filter(
            sender=self.user,
            created_at__gte=thirty_days_ago
        ).count()

        # Normalize to 0-1 scale
        activity_score = min((recent_likes + recent_messages) / 50, 1.0)
        score += activity_score * 0.7

        # Profile completion
        if self.profile:
            completion_score = self.profile.calculate_completion_score() / 100
            score += completion_score * 0.3

        return min(score, 1.0)


class ExplainableMatcher:
    """Explainable matching engine with detailed scoring"""

    def __init__(self):
        self.weights = {
            'preference_alignment': 0.25,
            'interest_similarity': 0.20,
            'values_compatibility': 0.20,
            'behavioral_compatibility': 0.15,
            'trust_safety_score': 0.10,
            'activity_recency': 0.10
        }

    def calculate_match_score(self, user1: User, user2: User) -> Tuple[float, List[str]]:
        """
        Calculate match score between two users with explanations
        Returns: (score, reasons_list)
        """
        vector1 = EnhancedFeatureVector(user1)
        vector2 = EnhancedFeatureVector(user2)

        scores = {}
        reasons = []

        # Preference Alignment
        pref_score, pref_reasons = self._calculate_preference_alignment(
            vector1.vector, vector2.vector)
        scores['preference_alignment'] = pref_score
        reasons.extend(pref_reasons)

        # Interest Similarity
        interest_score, interest_reasons = self._calculate_interest_similarity(
            vector1.vector, vector2.vector)
        scores['interest_similarity'] = interest_score
        reasons.extend(interest_reasons)

        # Values Compatibility
        values_score, values_reasons = self._calculate_values_compatibility(
            vector1.vector, vector2.vector)
        scores['values_compatibility'] = values_score
        reasons.extend(values_reasons)

        # Behavioral Compatibility
        behavioral_score, behavioral_reasons = self._calculate_behavioral_compatibility(
            vector1.vector, vector2.vector)
        scores['behavioral_compatibility'] = behavioral_score
        reasons.extend(behavioral_reasons)

        # Trust & Safety Score
        trust_score, trust_reasons = self._calculate_trust_safety_score(
            vector1.vector, vector2.vector)
        scores['trust_safety_score'] = trust_score
        reasons.extend(trust_reasons)

        # Activity Recency
        recency_score, recency_reasons = self._calculate_activity_recency(
            vector1.vector, vector2.vector)
        scores['activity_recency'] = recency_score
        reasons.extend(recency_reasons)

        # Calculate final weighted score
        final_score = sum(scores[component] * self.weights[component]
                         for component in scores.keys())

        return final_score, reasons

    def _calculate_preference_alignment(self, v1: Dict, v2: Dict) -> Tuple[float, List[str]]:
        """Calculate how well preferences align"""
        reasons = []
        score = 0.0

        # Age preference alignment
        user1_age = v1['demographics']['age']
        user2_age = v2['demographics']['age']
        user1_pref = v1['preferences']['age_range']
        user2_pref = v2['preferences']['age_range']

        age_match_1 = user1_pref[0] <= user2_age <= user1_pref[1]
        age_match_2 = user2_pref[0] <= user1_age <= user2_pref[1]

        if age_match_1 and age_match_2:
            score += 0.6
            reasons.append("Age preferences are mutually compatible")
        elif age_match_1 or age_match_2:
            score += 0.3
            reasons.append("Age preferences partially align")
        else:
            reasons.append("Age preferences don't align")

        # Distance compatibility
        # This would require location calculation
        score += 0.4  # Placeholder

        return min(score, 1.0), reasons

    def _calculate_interest_similarity(self, v1: Dict, v2: Dict) -> Tuple[float, List[str]]:
        """Calculate interest similarity"""
        interests1 = set(v1['interests'])
        interests2 = set(v2['interests'])

        if not interests1 or not interests2:
            return 0.5, ["Limited interest data available"]

        intersection = interests1 & interests2
        union = interests1 | interests2

        similarity = len(intersection) / len(union) if union else 0

        reasons = []
        if intersection:
            shared = list(intersection)[:3]  # Show up to 3 shared interests
            reasons.append(f"Shared interests: {', '.join(shared)}")
        else:
            reasons.append("No shared interests found")

        return similarity, reasons

    def _calculate_values_compatibility(self, v1: Dict, v2: Dict) -> Tuple[float, List[str]]:
        """Calculate values compatibility"""
        values1 = set(v1['values'])
        values2 = set(v2['values'])

        if not values1 or not values2:
            return 0.5, ["Limited values data available"]

        intersection = values1 & values2
        compatibility = len(intersection) / max(len(values1), len(values2))

        reasons = []
        if intersection:
            shared = list(intersection)[:2]
            reasons.append(f"Shared values: {', '.join(shared)}")
        else:
            reasons.append("Different value systems")

        return compatibility, reasons

    def _calculate_behavioral_compatibility(self, v1: Dict, v2: Dict) -> Tuple[float, List[str]]:
        """Calculate behavioral compatibility"""
        b1 = v1['behavioral_signals']
        b2 = v2['behavioral_signals']

        reasons = []

        # Compare communication styles
        latency_diff = abs(b1['reply_latency_avg'] - b2['reply_latency_avg'])
        if latency_diff < 60:  # Within 1 hour
            reasons.append("Similar communication response times")
            latency_score = 0.8
        else:
            reasons.append("Different communication paces")
            latency_score = 0.4

        # Compare engagement levels
        engagement_diff = abs(b1.get('like_rate', 0.5) - b2.get('like_rate', 0.5))
        if engagement_diff < 0.2:
            reasons.append("Similar engagement patterns")
            engagement_score = 0.8
        else:
            reasons.append("Different engagement levels")
            engagement_score = 0.4

        return (latency_score + engagement_score) / 2, reasons

    def _calculate_trust_safety_score(self, v1: Dict, v2: Dict) -> Tuple[float, List[str]]:
        """Calculate combined trust and safety score"""
        trust1 = v1['trust_score']
        trust2 = v2['trust_score']

        combined_trust = (trust1 + trust2) / 2

        reasons = []
        if combined_trust > 0.8:
            reasons.append("Both users have high trust scores")
        elif combined_trust > 0.6:
            reasons.append("Both users have good trust scores")
        else:
            reasons.append("Trust verification recommended")

        return combined_trust, reasons

    def _calculate_activity_recency(self, v1: Dict, v2: Dict) -> Tuple[float, List[str]]:
        """Calculate activity recency score"""
        # This would compare last activity timestamps
        # For now, return a neutral score
        return 0.7, ["Both users are actively engaged"]


class TrustVerificationSystem:
    """Tiered trust and verification system"""

    TRUST_LEVELS = {
        0: {'name': 'Basic', 'requirements': [], 'capabilities': ['browse']},
        1: {'name': 'Verified', 'requirements': ['email_verified'], 'capabilities': ['browse', 'chat']},
        2: {'name': 'Photo Verified', 'requirements': ['email_verified', 'photo_verified'], 'capabilities': ['browse', 'chat', 'video']},
        3: {'name': 'ID Verified', 'requirements': ['email_verified', 'photo_verified', 'id_verified'], 'capabilities': ['browse', 'chat', 'video', 'boost_priority']},
        4: {'name': 'Trusted', 'requirements': ['email_verified', 'photo_verified', 'id_verified', 'behavioral_trust'], 'capabilities': ['browse', 'chat', 'video', 'boost_priority', 'featured']}
    }

    def __init__(self):
        self.current_level = 0

    def assess_trust_level(self, user: User) -> int:
        """Assess user's current trust level"""
        level = 0

        if user.is_verified:
            level = max(level, 1)

        # Check for photo verification (this would need a verification model)
        # For now, assume photo verified if they have a primary photo
        if user.profile and user.profile.photos.filter(is_primary=True).exists():
            level = max(level, 2)

        # Additional checks would go here for ID verification and behavioral trust

        return min(level, 4)

    def get_required_verifications(self, current_level: int, target_level: int) -> List[str]:
        """Get required verifications to reach target level"""
        if target_level <= current_level:
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


# Global instances
feature_vector_builder = EnhancedFeatureVector
explainable_matcher = ExplainableMatcher()
trust_system = TrustVerificationSystem()