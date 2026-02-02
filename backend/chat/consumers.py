import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Conversation, Message
from notifications.models import Notification # New import
from channels.layers import get_channel_layer # New import
from asgiref.sync import async_to_sync # New import
from django.contrib.contenttypes.models import ContentType # New import

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.conversation_group_name = f'chat_{self.conversation_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.conversation_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.conversation_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message_content = text_data_json['message']
        sender_id = text_data_json['sender_id']

        # Save message to database and create notification
        message_obj = await self.save_message(sender_id, message_content)
        
        # Send notification to the other user in the conversation
        if message_obj:
            conversation = await database_sync_to_async(Conversation.objects.get)(id=self.conversation_id)
            sender = await database_sync_to_async(User.objects.get)(id=sender_id)
            recipient = conversation.match.user1 if conversation.match.user2 == sender else conversation.match.user2

            notification_message = f"New message from {sender.first_name} in your chat!"
            notification = await database_sync_to_async(Notification.objects.create)(
                recipient=recipient,
                sender=sender,
                notification_type='message',
                message=notification_message,
                content_object=message_obj
            )
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"notifications_{recipient.id}",
                {
                    "type": "send_notification",
                    "message": notification.message,
                    "notification_type": notification.notification_type,
                    "sender_id": notification.sender.id,
                    "created_at": notification.created_at.isoformat(),
                },
            )

        # Send message to room group
        await self.channel_layer.group_send(
            self.conversation_group_name,
            {
                'type': 'chat_message',
                'message': message_content,
                'sender_id': sender_id,
                'created_at': timezone.now().isoformat(),
            }
        )

    async def chat_message(self, event):
        message = event['message']
        sender_id = event['sender_id']
        created_at = event['created_at']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'sender_id': sender_id,
            'created_at': created_at,
        }))

    async def save_message(self, sender_id, message_content):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create_message():
            sender = User.objects.get(id=sender_id)
            conversation = get_object_or_404(Conversation, id=self.conversation_id)
            message = Message.objects.create(
                conversation=conversation,
                sender=sender,
                content=message_content
            )
            return message

        return await create_message()
