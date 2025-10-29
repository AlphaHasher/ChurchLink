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
    Version-tolerant for both PayPal v1 and v2 webhook formats.
    
    Returns:
        Dictionary with normalized payment data
    """
    resource = validated_payload.resource
    
    # Extract transaction_id with fallbacks (v1/v2 compatibility)
    transaction_id = getattr(resource, 'parent_payment', None)
    if not transaction_id:
        # v2 format: check related_ids.order_id or first related id
        related_ids = getattr(resource, 'related_ids', None)
        if related_ids:
            if hasattr(related_ids, 'order_id'):
                transaction_id = related_ids.order_id
            elif isinstance(related_ids, (list, tuple)) and len(related_ids) > 0:
                transaction_id = related_ids[0]
    
    # Extract sale_id with fallbacks
    sale_id = getattr(resource, 'id', None) or getattr(resource, 'sale_id', None)
    
    # Extract amount with v1/v2 fallbacks
    amount_value = 0.0
    currency = "USD"  # Default currency
    
    if hasattr(resource, 'amount'):
        amount_obj = resource.amount
        # v1 format: amount.total, v2 format: amount.value
        amount_str = getattr(amount_obj, 'total', None) or getattr(amount_obj, 'value', None)
        if amount_str:
            try:
                amount_value = float(amount_str)
            except (ValueError, TypeError):
                amount_value = 0.0
        
        # v1 format: amount.currency, v2 format: amount.currency_code
        currency = getattr(amount_obj, 'currency', None) or getattr(amount_obj, 'currency_code', None) or "USD"
    
    # Extract payer information with v1/v2 fallbacks
    payer_email = None
    payer_name = "Anonymous"
    payer_id = None
    
    if hasattr(resource, 'payer'):
        payer = resource.payer
        
        # v1 format: payer.payer_info
        if hasattr(payer, 'payer_info'):
            payer_info = payer.payer_info
            payer_email = getattr(payer_info, 'email', None)
            payer_id = getattr(payer_info, 'payer_id', None)
            
            # Construct name from first_name/last_name
            first_name = getattr(payer_info, 'first_name', '') or ''
            last_name = getattr(payer_info, 'last_name', '') or ''
            constructed_name = f"{first_name} {last_name}".strip()
            if constructed_name:
                payer_name = constructed_name
        
        # v2 format: payer.name and payer.email_address
        if not payer_email:
            payer_email = getattr(payer, 'email_address', None) or getattr(payer, 'email', None)
        
        if payer_name == "Anonymous" and hasattr(payer, 'name'):
            name_obj = payer.name
            # v2 format: name.full_name or name.given_name/family_name
            if hasattr(name_obj, 'full_name'):
                payer_name = name_obj.full_name or "Anonymous"
            else:
                given_name = getattr(name_obj, 'given_name', '') or ''
                family_name = getattr(name_obj, 'family_name', '') or ''
                constructed_name = f"{given_name} {family_name}".strip()
                if constructed_name:
                    payer_name = constructed_name
    
    return {
        "webhook_id": validated_payload.id,
        "event_type": validated_payload.event_type,
        "transaction_id": transaction_id,
        "sale_id": sale_id,
        "amount": amount_value,
        "currency": currency,
        "state": getattr(resource, 'state', None),
        "create_time": getattr(resource, 'create_time', None),
        "payer_email": payer_email,
        "payer_name": payer_name,
        "payer_id": payer_id
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