"""
Models for the events app - Event logging and audit trails
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class EventLog(models.Model):
    """Audit log for all domain events"""

    event_id = models.CharField(max_length=255, unique=True, help_text="Unique event identifier")
    event_type = models.CharField(max_length=100, help_text="Type of event")
    event_version = models.CharField(max_length=10, default="1.0", help_text="Event schema version")
    occurred_at = models.DateTimeField(help_text="When the event occurred")
    actor_id = models.CharField(max_length=255, null=True, blank=True, help_text="ID of the user who triggered the event")
    entity_id = models.CharField(max_length=255, null=True, blank=True, help_text="ID of the entity the event relates to")
    correlation_id = models.CharField(max_length=255, null=True, blank=True, help_text="Correlation ID for event tracing")

    # Event data
    payload = models.JSONField(help_text="Event payload data")
    metadata = models.JSONField(default=dict, help_text="Event metadata")

    # Processing status
    processed_at = models.DateTimeField(null=True, blank=True, help_text="When the event was processed")
    processing_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending',
        help_text="Event processing status"
    )
    processing_attempts = models.IntegerField(default=0, help_text="Number of processing attempts")
    last_error = models.TextField(null=True, blank=True, help_text="Last processing error")

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['event_type', 'occurred_at']),
            models.Index(fields=['actor_id', 'occurred_at']),
            models.Index(fields=['processing_status', 'occurred_at']),
            models.Index(fields=['correlation_id']),
        ]

    def __str__(self):
        return f"{self.event_type} - {self.event_id}"

    def mark_processed(self):
        """Mark the event as successfully processed"""
        self.processed_at = timezone.now()
        self.processing_status = 'completed'
        self.save()

    def mark_failed(self, error_message: str):
        """Mark the event as failed"""
        self.processing_attempts += 1
        self.processing_status = 'failed'
        self.last_error = error_message
        self.save()


class EventConsumerStatus(models.Model):
    """Status tracking for event consumers"""

    consumer_name = models.CharField(max_length=100, unique=True, help_text="Name of the consumer")
    consumer_group = models.CharField(max_length=100, help_text="Redis consumer group name")
    last_processed_event_id = models.CharField(max_length=255, null=True, blank=True, help_text="Last processed event ID")
    last_heartbeat = models.DateTimeField(auto_now=True, help_text="Last heartbeat from consumer")
    is_active = models.BooleanField(default=True, help_text="Whether the consumer is active")
    processing_errors = models.IntegerField(default=0, help_text="Number of processing errors")

    # Performance metrics
    events_processed_today = models.IntegerField(default=0, help_text="Events processed today")
    events_processed_this_hour = models.IntegerField(default=0, help_text="Events processed this hour")
    average_processing_time = models.FloatField(default=0.0, help_text="Average processing time in seconds")

    class Meta:
        ordering = ['consumer_name']

    def __str__(self):
        return f"{self.consumer_name} ({'active' if self.is_active else 'inactive'})"

    def update_heartbeat(self):
        """Update the consumer heartbeat"""
        self.last_heartbeat = timezone.now()
        self.save()

    def record_processing_success(self, processing_time: float):
        """Record successful event processing"""
        self.events_processed_today += 1
        self.events_processed_this_hour += 1

        # Update rolling average
        if self.average_processing_time == 0:
            self.average_processing_time = processing_time
        else:
            self.average_processing_time = (self.average_processing_time + processing_time) / 2

        self.save()

    def record_processing_error(self):
        """Record processing error"""
        self.processing_errors += 1
        self.save()


class RiskAssessment(models.Model):
    """Risk assessment records"""

    risk_id = models.CharField(max_length=50, unique=True, help_text="Unique risk identifier")
    title = models.CharField(max_length=200, help_text="Risk title")
    category = models.CharField(max_length=50, help_text="Risk category")
    level = models.CharField(max_length=20, choices=[
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ], help_text="Current risk level")

    # Risk scoring
    impact_score = models.IntegerField(default=1, help_text="Impact score (1-5)")
    probability_score = models.IntegerField(default=1, help_text="Probability score (1-5)")
    risk_score = models.IntegerField(default=1, help_text="Calculated risk score")

    # Assessment details
    description = models.TextField(help_text="Risk description")
    mitigation_plan = models.JSONField(default=list, help_text="Mitigation actions")
    contingency_plan = models.JSONField(default=list, help_text="Contingency plans")

    # Status tracking
    status = models.CharField(max_length=20, choices=[
        ('identified', 'Identified'),
        ('assessing', 'Assessing'),
        ('mitigating', 'Mitigating'),
        ('monitoring', 'Monitoring'),
        ('closed', 'Closed'),
        ('escalated', 'Escalated'),
    ], default='identified', help_text="Risk status")

    owner = models.CharField(max_length=100, null=True, blank=True, help_text="Risk owner")
    identified_date = models.DateTimeField(auto_now_add=True)
    last_assessed = models.DateTimeField(null=True, blank=True)
    next_review = models.DateTimeField(null=True, blank=True)

    # Related events
    related_events = models.JSONField(default=list, help_text="Related event references")

    class Meta:
        ordering = ['-risk_score', '-identified_date']

    def __str__(self):
        return f"{self.risk_id}: {self.title} ({self.level})"

    def assess_risk(self, impact: int, probability: int):
        """Update risk assessment"""
        self.impact_score = min(max(impact, 1), 5)
        self.probability_score = min(max(probability, 1), 5)
        self.risk_score = self.impact_score * self.probability_score
        self.last_assessed = timezone.now()

        # Auto-adjust level based on score
        if self.risk_score >= 20:
            self.level = 'critical'
        elif self.risk_score >= 12:
            self.level = 'high'
        elif self.risk_score >= 6:
            self.level = 'medium'
        else:
            self.level = 'low'

        self.save()


class AnalyticsSnapshot(models.Model):
    """Periodic analytics snapshots"""

    snapshot_date = models.DateField(unique=True, help_text="Date of the snapshot")
    snapshot_type = models.CharField(max_length=50, choices=[
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ], help_text="Type of snapshot")

    # Dating success metrics
    total_users = models.IntegerField(default=0)
    active_users = models.IntegerField(default=0)
    total_swipes = models.IntegerField(default=0)
    total_matches = models.IntegerField(default=0)
    match_rate = models.FloatField(default=0.0)
    conversation_rate = models.FloatField(default=0.0)

    # Safety metrics
    verification_rate = models.FloatField(default=0.0)
    report_rate = models.FloatField(default=0.0)
    risk_level = models.CharField(max_length=20, default='low')

    # Business metrics
    total_revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    active_subscriptions = models.IntegerField(default=0)
    arpu = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    # Growth metrics
    new_registrations = models.IntegerField(default=0)
    growth_rate = models.FloatField(default=0.0)

    # Raw data
    metrics_data = models.JSONField(help_text="Complete metrics data")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-snapshot_date']

    def __str__(self):
        return f"{self.snapshot_type} snapshot - {self.snapshot_date}"