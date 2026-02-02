# AI Coding Agent Instructions for Dating App

## Architecture Overview
This is a Django REST Framework backend with Next.js frontend dating app. Backend uses PostgreSQL, Redis for caching/channels, Celery for async tasks. Real-time features via Django Channels (WebSockets). Apps: accounts (auth), profiles (user data/photos), interactions (swipes/matches), chat (messaging), notifications (FCM push), billing (Stripe subscriptions).

## Key Components
- **User Model**: Custom `accounts.User` with email auth, verification
- **Profile System**: Rich profiles with photos, interests, moderation (AI-powered content safety)
- **Matching**: Swipe-based with algorithm in `profiles.recommendation_engine`
- **Chat**: WebSocket conversations linked to matches
- **Monetization**: Virtual currency, premium features, profile boosts via Stripe

## Data Flow
User registration → Profile creation → Photo upload (moderated) → Discovery (filtered by prefs/distance) → Swipes → Matches → Chat. Async tasks for notifications, moderation.

## Developer Workflows
- **Backend**: `cd backend; python manage.py runserver` (dev), `makemigrations; migrate` for DB changes
- **Frontend**: `cd frontend; npm run dev` (Next.js dev server)
- **Full Stack**: Backend on :8000, Frontend on :3000, CORS configured
- **Async Tasks**: `celery -A core worker --loglevel=info` for background jobs
- **WebSockets**: Redis required for channels, run `redis-server`
- **Testing**: No custom test setup; use Django's `manage.py test`

## Project Conventions
- **Serialization**: DRF with custom serializers; read/write fields separated (e.g., `PhotoSerializer`)
- **Internationalization**: All user-facing strings use `gettext_lazy(_)`; supported languages in `settings.LANGUAGES`
- **Moderation**: Content safety via `moderation_service.py`; auto-moderates bio/photos on save
- **Recommendation**: AI similarity matching in `recommendation_engine.py`; updates feature vectors on profile changes
- **Error Handling**: Standard DRF responses; custom validation in serializers
- **File Uploads**: Photos stored in `media/`; primary photo logic in `Profile` model

## Integration Points
- **Stripe**: Billing in `billing/` app; webhooks for subscription updates
- **Firebase FCM**: Push notifications via `notifications.fcm_service`
- **Google Translate**: Chat translation in `chat.translation_service`
- **Geocoding**: Location coords auto-populated (TODO: integrate Google Maps API)
- **Email**: SMTP for verification; allauth for social auth (Google/Facebook/Apple)

## Common Patterns
- **Match Creation**: Automatic on mutual likes; handled in `interactions.views.swipe`
- **Currency System**: Virtual coins for boosts/gifts; deduct on use
- **Boosts**: Temporary profile visibility increase; expiry tracked in `Profile.boost_expiry`
- **Passport Feature**: Location spoofing for travel; coords in `Profile.passport_*`
- **Profile Completion**: Score calculation for UX; encourages full profiles

Reference: `backend/core/settings.py` for config, `README.md` for setup, `profiles/models.py` for data schema.