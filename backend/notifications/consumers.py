import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.user_group_name = f'notifications_{self.user_id}'

        # Join user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave user group
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )

    async def send_notification(self, event):
        message = event['message']
        notification_type = event['notification_type']
        sender_id = event.get('sender_id')
        created_at = event.get('created_at')

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'notification_type': notification_type,
            'sender_id': sender_id,
            'created_at': created_at,
        }))
