from abc import ABC, abstractmethod
import uuid
from typing import Dict, Any

class BaseSMSProvider(ABC):
    @abstractmethod
    def send_sms(self, message_obj) -> Dict[str, Any]:
        """
        Sends an SMS via the provider.
        Should return a dictionary with at least 'provider_message_id' and 'status'.
        """
        pass

    @abstractmethod
    def check_status(self, provider_message_id: str) -> Dict[str, Any]:
        """
        Checks the status of a previously sent message.
        """
        pass

    @abstractmethod
    def handle_webhook(self, payload: dict) -> None:
        """
        Process incoming webhooks (delivery receipts, inbound messages).
        """
        pass


class LocalGatewayProvider(BaseSMSProvider):
    """
    A local mock provider that simulates an in-house hardware gateway.
    It logs the message and immediately marks it as sent.
    """
    def send_sms(self, message_obj) -> Dict[str, Any]:
        print(f"[LOCAL GATEWAY] Sending SMS to {message_obj.recipient_number}: {message_obj.body}")
        
        # Simulate successful dispatch
        return {
            'provider_message_id': f"local-{uuid.uuid4().hex[:8]}",
            'status': 'SENT',
        }

    def check_status(self, provider_message_id: str) -> Dict[str, Any]:
        return {
            'status': 'DELIVERED',
            'description': 'Local simulated delivery'
        }

    def handle_webhook(self, payload: dict) -> None:
        print(f"[LOCAL GATEWAY] Webhook received: {payload}")


class ProviderFactory:
    @staticmethod
    def get_provider(provider_type: str = "LOCAL") -> BaseSMSProvider:
        # In the future, this can instantiate different providers dynamically.
        return LocalGatewayProvider()
