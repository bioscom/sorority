from firebase_admin import messaging
import firebase_admin

def send_fcm_notification(registration_token, title, body, data=None):
    """Sends an FCM notification to a specific device.

    Args:
        registration_token (str): The FCM registration token for the target device.
        title (str): The title of the notification.
        body (str): The body text of the notification.
        data (dict, optional): A dictionary of custom key-value pairs to send with the notification.
                                 Defaults to None.

    Returns:
        str: The message ID if the message was sent successfully, otherwise None.
    """
    if not firebase_admin._apps:
        print("Firebase Admin SDK not initialized. Cannot send FCM notification.")
        return None

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data,
        token=registration_token,
    )

    try:
        response = messaging.send(message)
        print("Successfully sent message:", response)
        return response
    except Exception as e:
        print("Error sending message:", e)
        return None

