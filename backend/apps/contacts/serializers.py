from rest_framework import serializers
from .models import Contact


class ContactSerializer(serializers.ModelSerializer):
    full_name            = serializers.ReadOnlyField()
    contact_type_display = serializers.CharField(source='get_contact_type_display', read_only=True)

    class Meta:
        model  = Contact
        fields = [
            'id',
            'clinic',
            'contact_number',
            'contact_type',
            'contact_type_display',
            'first_name',
            'middle_name',
            'last_name',
            'full_name',
            'organization_name',
            'specialty',
            'license_number',
            'email',
            'phone',
            'alternative_phone',
            'address',
            'city',
            'province',
            'postal_code',
            'notes',
            'website',
            'is_active',
            'is_preferred',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'clinic', 'contact_number', 'created_at', 'updated_at']

    def validate_phone(self, value):
        cleaned = value.replace(' ', '').replace('-', '')
        if not (
            (cleaned.startswith('09')   and len(cleaned) == 11) or
            (cleaned.startswith('+639') and len(cleaned) == 13)
        ):
            raise serializers.ValidationError(
                'Use format 09XXXXXXXXX or +639XXXXXXXXX'
            )
        return value

    def validate_email(self, value):
        if value and '@' not in value:
            raise serializers.ValidationError('Enter a valid email address.')
        if value:
            value = value.strip().lower()
        return value


class ContactListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    full_name            = serializers.ReadOnlyField()
    contact_type_display = serializers.CharField(source='get_contact_type_display', read_only=True)

    class Meta:
        model  = Contact
        fields = [
            'id',
            'contact_number',
            'full_name',
            'first_name',
            'last_name',
            'contact_type',
            'contact_type_display',
            'organization_name',
            'specialty',
            'email',
            'phone',
            'city',
            'is_active',
            'is_preferred',
        ]