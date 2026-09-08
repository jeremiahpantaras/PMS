from rest_framework import serializers
import phonenumbers
import re
from .models import SMSMessage, DeliveryEvent, SMSTemplate

class SMSTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMSTemplate
        fields = ['id', 'name', 'content', 'created_at', 'updated_at']

class DeliveryEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryEvent
        fields = ['status', 'description', 'provider_timestamp', 'created_at']

class MessageDetailSerializer(serializers.ModelSerializer):
    delivery_events = DeliveryEventSerializer(many=True, read_only=True)
    gateway_device_name = serializers.SerializerMethodField()

    class Meta:
        model = SMSMessage
        fields = [
            'id', 'recipient_number', 'sender_id', 'body', 'status',
            'provider_message_id', 'failure_reason', 'scheduled_time',
            'retry_count', 'max_retries', 'gateway_device_name',
            'created_at', 'updated_at', 'sent_at', 'delivered_at', 'failed_at',
            'delivery_events'
        ]

    def get_gateway_device_name(self, obj):
        return obj.gateway_device.name if obj.gateway_device else None

class SendSMSSerializer(serializers.Serializer):
    to = serializers.CharField(max_length=20)
    message = serializers.CharField(max_length=1600, required=False, allow_blank=True)
    sender_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    template_id = serializers.UUIDField(required=False, allow_null=True)
    template_vars = serializers.JSONField(required=False, allow_null=True)
    scheduled_time = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, data):
        message = data.get('message', '').strip()
        template_id = data.get('template_id')
        
        if not message and not template_id:
            raise serializers.ValidationError("Either 'message' or 'template_id' must be provided.")
        
        if template_id and message:
            raise serializers.ValidationError("Cannot provide both 'message' and 'template_id'.")
            
        return data

    def validate_to(self, value):
        """
        Validate and normalize the phone number to E.164 format.
        """
        try:
            # Parse the number, assuming PH as default region if country code is missing.
            parsed_number = phonenumbers.parse(value, "PH")
            if not phonenumbers.is_valid_number(parsed_number):
                raise serializers.ValidationError("Invalid phone number format.")
            
            # Format to strict E.164 (e.g., +639123456789)
            return phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.E164)
        except phonenumbers.phonenumberutil.NumberParseException:
            raise serializers.ValidationError("Invalid phone number.")
