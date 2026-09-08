"""
gateway/serializers.py

Serializers for gateway device registration and management.
"""
from rest_framework import serializers
from .models import GatewayDevice


class DeviceRegistrationSerializer(serializers.Serializer):
    """Validates the device registration request payload."""
    device_identifier = serializers.CharField(
        max_length=255,
        help_text="Unique identifier for this device (e.g. ANDROID-GATEWAY-001)"
    )
    device_name = serializers.CharField(
        max_length=255,
        help_text="Friendly name for this device"
    )
    phone_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default='',
        help_text="SIM phone number on this device (E.164, optional)"
    )


class DevicePublicSerializer(serializers.ModelSerializer):
    """
    Safe serializer for GatewayDevice — NEVER includes device_token.
    Used for registration responses (token returned separately) and all other
    device read operations.
    """
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = GatewayDevice
        fields = [
            'id', 'device_identifier', 'name', 'phone_number',
            'status', 'is_active', 'is_online', 'last_seen_at',
            'created_at', 'updated_at',
        ]
        # device_token is explicitly excluded

    def get_is_online(self, obj):
        return obj.is_online()


class DeviceRegistrationResponseSerializer(serializers.ModelSerializer):
    """
    Registration response — the ONLY serializer that includes device_token.
    Used exactly once per registration (or token rotation).
    """
    class Meta:
        model = GatewayDevice
        fields = [
            'id', 'device_identifier', 'name', 'phone_number',
            'status', 'is_active', 'device_token', 'created_at',
        ]


class HeartbeatResponseSerializer(serializers.Serializer):
    """Response body for the heartbeat endpoint."""
    device_id = serializers.UUIDField()
    device_identifier = serializers.CharField()
    status = serializers.CharField()
    is_online = serializers.BooleanField()
    last_seen_at = serializers.DateTimeField()
