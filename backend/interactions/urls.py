from django.urls import path
from . import views

urlpatterns = [
    path('swipe/', views.SwipeCreateView.as_view(), name='swipe_create'),
    path('swipe/history/', views.swipe_history, name='swipe_history'),
    path('swipe/likes-received/', views.likes_received, name='likes_received'),
    path('matches/', views.MatchListView.as_view(), name='match_list'),
    path('matches/<int:pk>/', views.MatchDetailView.as_view(), name='match_detail'),
    path('matches/<int:match_id>/unmatch/', views.unmatch, name='unmatch'),
    path('blocks/', views.BlockListView.as_view(), name='block_list'),
    path('blocks/create/', views.BlockCreateView.as_view(), name='block_create'),
    path('blocks/<int:block_id>/unblock/', views.unblock, name='unblock'),
    path('reports/create/', views.ReportCreateView.as_view(), name='report_create'),
    path('gifts/', views.GiftListView.as_view(), name='gift_list'),
    path('gifts/send/', views.SendGiftView.as_view(), name='send_gift'),
    path('gifts/received/', views.ReceivedGiftListView.as_view(), name='received_gift_list'),
]







