from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LetterTemplateViewSet, LetterViewSet

router = DefaultRouter()
router.register(r'templates', LetterTemplateViewSet, basename='letter-templates')
router.register(r'letters', LetterViewSet, basename='letters')

urlpatterns = [
    path('', include(router.urls)),
]
