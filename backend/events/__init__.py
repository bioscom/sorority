"""
Event-driven architecture for DatingConnect v1.1
Implements domain events, event sourcing, and event-driven orchestration
"""

import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import json
import redis
from django.conf import settings
from django.utils import timezone


class EventType(Enum):
    """Canonical event types for the dating platform"""

    # User & Identity Events
    USER_REGISTERED = "UserRegistered"
    EMAIL_VERIFIED = "EmailVerified"
    PROFILE_COMPLETED = "ProfileCompleted"
    TRUST_LEVEL_UPDATED = "TrustLevelUpdated"
    USER_SUSPENDED = "UserSuspended"

    # Matching Events
    PROFILE_VIEWED = "ProfileViewed"
    SWIPE_LIKED = "SwipeLiked"
    SWIPE_PASSED = "SwipePassed"
    USER_MATCHED = "UserMatched"
    MATCH_EXPIRED = "MatchExpired"

    # Messaging Events
    MESSAGE_SENT = "MessageSent"
    MESSAGE_READ = "MessageRead"
    CONVERSATION_ENDED = "ConversationEnded"
    USER_UNMATCHED = "UserUnmatched"

    # Monetization Events
    SUBSCRIPTION_STARTED = "SubscriptionStarted"
    SUBSCRIPTION_UPGRADED = "SubscriptionUpgraded"
    SUBSCRIPTION_CANCELLED = "SubscriptionCancelled"
    BOOST_ACTIVATED = "BoostActivated"
    GIFT_SENT = "GiftSent"

    # Safety & Moderation Events
    PROFILE_REPORTED = "ProfileReported"
    CONTENT_FLAGGED = "ContentFlagged"
    MODERATION_ACTION_TAKEN = "ModerationActionTaken"
    EMERGENCY_TRIGGERED = "EmergencyTriggered"

    # AI & Matching Events
    MATCH_SUGGESTION_REQUESTED = "MatchSuggestionRequested"
    MATCH_SUGGESTIONS_GENERATED = "MatchSuggestionsGenerated"
    FEATURE_VECTOR_UPDATED = "FeatureVectorUpdated"

    # Trust & Verification Events
    VERIFICATION_REQUESTED = "VerificationRequested"
    VERIFICATION_APPROVED = "VerificationApproved"
    VERIFICATION_REJECTED = "VerificationRejected"

    # Analytics Events
    ANALYTICS_REPORT_GENERATED = "AnalyticsReportGenerated"


@dataclass
class EventEnvelope:
    """Standard event envelope schema"""
    event_id: str
    event_type: str
    event_version: str
    occurred_at: str
    actor_id: Optional[str]
    entity_id: Optional[str]
    correlation_id: Optional[str]
    metadata: Dict[str, Any]
    payload: Dict[str, Any]

    def __post_init__(self):
        if not self.event_id:
            self.event_id = str(uuid.uuid4())
        if not self.occurred_at:
            self.occurred_at = timezone.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


class EventPublisher:
    """Publishes events to Redis Streams"""

    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        self.stream_name = "dating_events"

    def publish(self, event: EventEnvelope) -> str:
        """Publish event to Redis stream"""
        event_dict = event.to_dict()
        return self.redis_client.xadd(self.stream_name, event_dict)

    def publish_event(self, event_type: EventType, payload: Dict[str, Any],
                     actor_id: Optional[str] = None, entity_id: Optional[str] = None,
                     correlation_id: Optional[str] = None,
                     metadata: Optional[Dict[str, Any]] = None) -> str:
        """Convenience method to publish events"""
        event = EventEnvelope(
            event_id="",
            event_type=event_type.value,
            event_version="1.0",
            occurred_at="",
            actor_id=actor_id,
            entity_id=entity_id,
            correlation_id=correlation_id,
            metadata=metadata or {},
            payload=payload
        )
        return self.publish(event)


class EventConsumer:
    """Base class for event consumers"""

    def __init__(self, consumer_name: str, consumer_group: str = "default"):
        self.consumer_name = consumer_name
        self.consumer_group = consumer_group
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        self.stream_name = "dating_events"

        # Create consumer group if it doesn't exist
        try:
            self.redis_client.xgroup_create(
                self.stream_name,
                self.consumer_group,
                "$",
                mkstream=True
            )
        except redis.ResponseError:
            # Group already exists
            pass

    def consume_events(self, count: int = 10, block: int = 5000):
        """Consume events from the stream"""
        try:
            events = self.redis_client.xreadgroup(
                self.consumer_group,
                self.consumer_name,
                {self.stream_name: ">"},
                count=count,
                block=block
            )

            for stream_name, messages in events:
                for message_id, message_data in messages:
                    yield message_id, message_data

        except Exception as e:
            print(f"Error consuming events: {e}")
            return

    def acknowledge_event(self, message_id: str):
        """Acknowledge processing of an event"""
        self.redis_client.xack(self.stream_name, self.consumer_group, message_id)

    def process_event(self, event_data: Dict[str, Any]):
        """Override this method in subclasses to handle events"""
        raise NotImplementedError("Subclasses must implement process_event")


# Global event publisher instance
event_publisher = EventPublisher()