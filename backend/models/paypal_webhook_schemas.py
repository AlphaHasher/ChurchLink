from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator
import logging

class PayPalAmount(BaseModel):
    """PayPal amount object"""
    total: str = Field(..., description="Total amount")
    currency: str = Field(default="USD", description="Currency code")
    
class PayPalPayerInfo(BaseModel):
    """PayPal payer information"""
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    payer_id: Optional[str] = None

class PayPalPayer(BaseModel):
    """PayPal payer object"""
    payer_info: PayPalPayerInfo

class PayPalSaleResource(BaseModel):
    """PayPal PAYMENT.SALE.COMPLETED resource object"""
    id: str = Field(..., description="Sale transaction ID")
    parent_payment: str = Field(..., description="Parent payment ID")
    amount: PayPalAmount
    state: str = Field(..., description="Transaction state (should be 'completed')")
    create_time: str = Field(..., description="ISO 8601 creation timestamp")
    update_time: Optional[str] = None
    payer: PayPalPayer

class PayPalWebhookPayload(BaseModel):
    """
    Complete PayPal webhook payload structure.
    Based on: https://developer.paypal.com/docs/api/webhooks/v1/
    """
    id: str = Field(..., description="Webhook event ID")
    event_type: str = Field(..., description="Event type (e.g., PAYMENT.SALE.COMPLETED)")
    create_time: str = Field(..., description="ISO 8601 event creation timestamp")
    resource_type: str = Field(..., description="Resource type (e.g., sale)")
    resource: PayPalSaleResource = Field(..., description="Event resource data")
    event_version: Optional[str] = "1.0"
    summary: Optional[str] = None
    
    @validator('event_type')
    def validate_event_type(cls, v):
        """Validate supported event types"""
        supported_events = [
            "PAYMENT.SALE.COMPLETED",
            "PAYMENT.SALE.DENIED", 
            "PAYMENT.SALE.REFUNDED",
            "PAYMENT.SALE.REVERSED"
        ]
        if v not in supported_events:
            logging.warning(f"Unsupported webhook event type: {v}")
        return v
    
    @validator('resource')
    def validate_resource_state(cls, v, values):
        """Validate resource state matches event type"""
        event_type = values.get('event_type')
        if event_type == "PAYMENT.SALE.COMPLETED" and v.state != "completed":
            raise ValueError(f"Invalid state '{v.state}' for PAYMENT.SALE.COMPLETED event")
        return v

def validate_webhook_payload(payload: Dict[str, Any]) -> PayPalWebhookPayload:
    """
    Validate incoming webhook payload against PayPal schema.
    
    Args:
        payload: Raw webhook payload dictionary
        
    Returns:
        Validated PayPalWebhookPayload object
        
    Raises:
        ValidationError: If payload doesn't match schema
    """
    try:
        return PayPalWebhookPayload(**payload)
    except Exception as e:
        logging.error(f"❌ Invalid PayPal webhook payload: {e}")
        logging.error(f"📄 Payload: {payload}")
        raise

def extract_payment_info(validated_payload: PayPalWebhookPayload) -> Dict[str, Any]:
    """
    Extract standardized payment information from validated webhook.
    
    Returns:
        Dictionary with normalized payment data
    """
    resource = validated_payload.resource
    payer_info = resource.payer.payer_info
    
    return {
        "webhook_id": validated_payload.id,
        "event_type": validated_payload.event_type,
        "transaction_id": resource.parent_payment,
        "sale_id": resource.id,
        "amount": float(resource.amount.total),
        "currency": resource.amount.currency,
        "state": resource.state,
        "create_time": resource.create_time,
        "payer_email": payer_info.email,
        "payer_name": f"{payer_info.first_name or ''} {payer_info.last_name or ''}".strip() or "Anonymous",
        "payer_id": payer_info.payer_id
    }

# Example test payloads for validation
VALID_WEBHOOK_PAYLOAD = {
    "id": "WH-1AB23456CD789-012345678",
    "event_type": "PAYMENT.SALE.COMPLETED",
    "create_time": "2024-01-15T10:30:00Z",
    "resource_type": "sale",
    "event_version": "1.0",
    "summary": "Payment completed for $30.00 USD",
    "resource": {
        "id": "8X092370C81984440",
        "parent_payment": "PAYID-ND6FK5I08A4595089705973J",
        "amount": {
            "total": "30.00",
            "currency": "USD"
        },
        "state": "completed",
        "create_time": "2024-01-15T10:30:00Z",
        "update_time": "2024-01-15T10:30:05Z",
        "payer": {
            "payer_info": {
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "payer_id": "ABC123XYZ"
            }
        }
    }
}

if __name__ == "__main__":
    # Test payload validation
    try:
        validated = validate_webhook_payload(VALID_WEBHOOK_PAYLOAD)
        payment_info = extract_payment_info(validated)
        print("✅ Payload validation successful")
        print(f"📋 Payment info: {payment_info}")
    except Exception as e:
        print(f"❌ Validation failed: {e}")