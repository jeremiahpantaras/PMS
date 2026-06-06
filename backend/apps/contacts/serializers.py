from rest_framework import serializers
from .models import Contact


class ContactSerializer(serializers.ModelSerializer):
    full_name            = serializers.ReadOnlyField()
    contact_type_display = serializers.SerializerMethodField()

    def get_contact_type_display(self, obj):
        return obj.display_contact_type

    class Meta:
        model  = Contact
        fields = [
            'id',
            'clinic',
            'contact_number',
            'contact_type',
            'contact_type_display',
            'custom_contact_type',
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

    def validate(self, attrs):
        contact_type = attrs.get('contact_type')
        # For PATCH: if contact_type not provided, fall back to the instance value
        if contact_type is None and self.instance:
            contact_type = self.instance.contact_type

        # For PATCH: if custom_contact_type not provided, fall back to the instance value
        if 'custom_contact_type' in attrs:
            custom_contact_type = attrs['custom_contact_type'].strip()
        elif self.instance:
            custom_contact_type = (self.instance.custom_contact_type or '').strip()
        else:
            custom_contact_type = ''

        if contact_type == 'OTHER' and not custom_contact_type:
            raise serializers.ValidationError(
                {'custom_contact_type': 'Please enter a contact type.'}
            )
        # If type changes away from OTHER, clear the custom field
        if contact_type != 'OTHER':
            attrs['custom_contact_type'] = ''
        return attrs


class ContactListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    full_name            = serializers.ReadOnlyField()
    contact_type_display = serializers.SerializerMethodField()

    def get_contact_type_display(self, obj):
        return obj.display_contact_type

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
            'custom_contact_type',
            'organization_name',
            'specialty',
            'email',
            'phone',
            'city',
            'is_active',
            'is_preferred',
        ]