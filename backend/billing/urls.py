from django.urls import path
from . import views

urlpatterns = [
    path('plans/', views.SubscriptionPlanListView.as_view(), name='subscription_plan_list'),
    path('create-checkout-session/<int:plan_id>/', views.create_checkout_session, name='create_checkout_session'),
    path('stripe-webhook/', views.stripe_webhook, name='stripe_webhook'),
    path('my-subscription/', views.get_user_subscription, name='get_user_subscription'),
    path('payment-success/', views.payment_success, name='payment_success'),
    path('payment-cancel/', views.payment_cancel, name='payment_cancel'),
]