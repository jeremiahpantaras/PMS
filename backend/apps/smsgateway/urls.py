from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SendSMSView, MessageDetailView, SMSTemplateViewSet

app_name = 'messaging'

router = DefaultRouter()
router.register(r'templates', SMSTemplateViewSet, basename='template')

urlpatterns = [
    path('', include(router.urls)),
    path('messages/', SendSMSView.as_view(), name='send-sms'),
    path('messages/<uuid:id>/', MessageDetailView.as_view(), name='message-detail'),
]
