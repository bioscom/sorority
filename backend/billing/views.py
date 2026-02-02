import stripe
from django.conf import settings
from django.urls import reverse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import SubscriptionPlan, UserSubscription
from .serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer
from profiles.models import Profile
from django.contrib.auth import get_user_model

User = get_user_model()

stripe.api_key = settings.STRIPE_SECRET_KEY

class SubscriptionPlanListView(generics.ListAPIView):
    """List all available subscription plans"""
    permission_classes = []  # Temporarily remove authentication requirement
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_checkout_session(request, plan_id):
    """Create a Stripe Checkout Session for a subscription plan"""
    plan = get_object_or_404(SubscriptionPlan, id=plan_id)
    user = request.user

    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': plan.name,
                            'description': plan.description,
                        },
                        'unit_amount': int(plan.price * 100),  # Amount in cents
                    },
                    'quantity': 1,
                }
            ],
            mode='payment',
            success_url='http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url='http://localhost:3000/payment-cancel',
            client_reference_id=str(user.id),
            metadata={
                'plan_id': str(plan.id),
                'user_id': str(user.id),
            }
        )
        return Response({'checkout_url': checkout_session.url})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
@api_view(['POST'])
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return HttpResponse(status=400)

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']

        user_id = session.get('client_reference_id')
        plan_id = session.get('metadata', {}).get('plan_id')

        if user_id and plan_id:
            try:
                user = User.objects.get(id=user_id)
                plan = SubscriptionPlan.objects.get(id=plan_id)

                # Update or create UserSubscription
                user_subscription, created = UserSubscription.objects.get_or_create(user=user)
                user_subscription.plan = plan
                user_subscription.start_date = timezone.now()
                user_subscription.end_date = timezone.now() + timezone.timedelta(days=plan.duration_days)
                user_subscription.is_active = True
                user_subscription.stripe_customer_id = session.get('customer')
                user_subscription.stripe_subscription_id = session.get('subscription')
                user_subscription.save()

                # Update user profile to reflect premium status
                if hasattr(user, 'profile'):
                    user.profile.is_premium = True
                    user.profile.save()

                print(f"Successfully activated {plan.name} subscription for user {user.email}")
            except Exception as e:
                print(f"Error processing webhook: {e}")
                return HttpResponse(status=500)

    return HttpResponse(status=200)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_subscription(request):
    """Retrieve the authenticated user's subscription status"""
    try:
        user_subscription = UserSubscription.objects.get(user=request.user)
        serializer = UserSubscriptionSerializer(user_subscription)
        return Response(serializer.data)
    except UserSubscription.DoesNotExist:
        return Response({'is_active': False, 'plan': None, 'message': 'No active subscription'}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def payment_success(request):
    """Handle payment success - verify and activate subscription"""
    session_id = request.GET.get('session_id')
    
    if not session_id:
        return Response({'message': 'Payment successful!'}, status=status.HTTP_200_OK)
    
    try:
        # Retrieve the session from Stripe
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Check if payment was successful
        if session.payment_status == 'paid':
            user_id = session.get('client_reference_id')
            plan_id = session.get('metadata', {}).get('plan_id')
            
            if user_id and plan_id:
                user = User.objects.get(id=user_id)
                plan = SubscriptionPlan.objects.get(id=plan_id)
                
                # Update or create UserSubscription
                user_subscription, created = UserSubscription.objects.get_or_create(user=user)
                user_subscription.plan = plan
                user_subscription.start_date = timezone.now()
                user_subscription.end_date = timezone.now() + timezone.timedelta(days=plan.duration_days)
                user_subscription.is_active = True
                user_subscription.stripe_customer_id = session.get('customer')
                user_subscription.stripe_subscription_id = session.get('subscription')
                user_subscription.save()
                
                # Update user profile to reflect premium status
                if hasattr(user, 'profile'):
                    user.profile.is_premium = True
                    user.profile.save()
                
                return Response({
                    'message': 'Payment successful! Your subscription is now active.',
                    'subscription': UserSubscriptionSerializer(user_subscription).data
                }, status=status.HTTP_200_OK)
        
        return Response({'message': 'Payment successful!'}, status=status.HTTP_200_OK)
    except Exception as e:
        print(f"Error processing payment success: {e}")
        return Response({'message': 'Payment successful!'}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def payment_cancel(request):
    """Placeholder for payment cancellation page (frontend will handle redirect)"""
    return Response({'message': 'Payment cancelled.'}, status=status.HTTP_200_OK)
