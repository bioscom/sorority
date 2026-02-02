from django.urls import path
from . import views

urlpatterns = [
    path('conversations/', views.ConversationListView.as_view(), name='conversation_list'),
    path('conversations/<int:pk>/', views.ConversationDetailView.as_view(), name='conversation_detail'),
    path('conversations/create/<int:match_id>/', views.create_conversation, name='create_conversation'),
    path('conversations/<int:conversation_id>/messages/', views.MessageListCreateView.as_view(), name='message_list_create'),
    path('conversations/<int:conversation_id>/messages/read/', views.mark_messages_read, name='mark_messages_read'),
    path('messages/<int:message_id>/reactions/', views.add_message_reaction, name='add_message_reaction'),
    path('messages/<int:message_id>/reactions/remove/', views.remove_message_reaction, name='remove_message_reaction'),
    path('conversations/<int:conversation_id>/typing/', views.update_typing_status, name='update_typing_status'),
    path('conversations/<int:conversation_id>/typing-indicators/', views.get_typing_indicators, name='get_typing_indicators'),
    path('translate/', views.translate_message, name='translate_message'), # New translation endpoint
]







