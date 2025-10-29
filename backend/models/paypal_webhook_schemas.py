from typing import Dict, Any, Optional, Union
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
    Supports both PayPal v1 (SALE) and v2 (CAPTURE) webhook event types.
    Based on: https://developer.paypal.com/docs/api/webhooks/v1/
    """
    id: str = Field(..., description="Webhook event ID")
    event_type: str = Field(..., description="Event type (e.g., PAYMENT.SALE.COMPLETED, PAYMENT.CAPTURE.COMPLETED)")
    create_time: str = Field(..., description="ISO 8601 event creation timestamp")
    resource_type: str = Field(..., description="Resource type (e.g., sale, capture)")
    # Accept both v1 (SALE) and v2 (CAPTURE) payload shapes
    resource: Dict[str, Any] = Field(..., description="Event resource data")
    event_version: Optional[str] = "1.0"
    summary: Optional[str] = None
    
    @validator('event_type')
    def validate_event_type(cls, v):
        """Validate supported event types for both PayPal v1 (SALE) and v2 (CAPTURE) APIs"""
        supported_events = [
            # PayPal v1 API events (intent: "sale")
            "PAYMENT.SALE.COMPLETED",
            "PAYMENT.SALE.DENIED", 
            "PAYMENT.SALE.REFUNDED",
            "PAYMENT.SALE.REVERSED",
            # PayPal v2 API events (intent: "CAPTURE")
            "PAYMENT.CAPTURE.COMPLETED",
            "PAYMENT.CAPTURE.DECLINED",
            "PAYMENT.CAPTURE.REFUNDED",
            "PAYMENT.CAPTURE.PENDING"
        ]
        if v not in supported_events:
            logging.warning(f"Unsupported webhook event type: {v}")
        return v
    
    @validator('resource')
    def validate_resource_state(cls, v, values):
        """Validate resource state matches event type for both v1 (SALE) and v2 (CAPTURE) events"""
        event_type = values.get('event_type')
        # v1 uses "state", v2 uses "status"
        resource_state = (v or {}).get('state') or (v or {}).get('status')
        
        # v1 SALE events validation
        if event_type == "PAYMENT.SALE.COMPLETED" and str(resource_state).lower() != "completed":
            raise ValueError(f"Invalid state '{resource_state}' for PAYMENT.SALE.COMPLETED event")
        
        # v2 CAPTURE events validation
        if event_type == "PAYMENT.CAPTURE.COMPLETED" and str(resource_state).lower() != "completed":
            raise ValueError(f"Invalid state '{resource_state}' for PAYMENT.CAPTURE.COMPLETED event")
        
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
    resource = validated_payload.resource or {}
    
    # Extract transaction_id with fallbacks (v1/v2 compatibility)
    transaction_id = resource.get('parent_payment')
    if not transaction_id:
        # v2 format: check supplementary_data.related_ids or related_ids
        supp = (resource.get('supplementary_data') or {})
        related_ids = supp.get('related_ids')
        if related_ids:
            if isinstance(related_ids, dict) and related_ids.get('order_id'):
                transaction_id = related_ids.get('order_id')
            elif isinstance(related_ids, (list, tuple)) and related_ids:
                transaction_id = related_ids[0]
    
    # Extract sale_id with fallbacks
    sale_id = resource.get('id') or resource.get('sale_id')
    
    # Extract amount with v1/v2 fallbacks
    amount_value = 0.0
    currency = "USD"  # Default currency
    
    if 'amount' in resource:
        amount_obj = resource['amount']
        # v1 format: amount.total, v2 format: amount.value
        amount_str = amount_obj.get('total') or amount_obj.get('value')
        if amount_str:
            try:
                amount_value = float(amount_str)
            except (ValueError, TypeError):
                amount_value = 0.0
        
        # v1 format: amount.currency, v2 format: amount.currency_code
        currency = amount_obj.get('currency') or amount_obj.get('currency_code') or "USD"
    
    # Extract payer information with v1/v2 fallbacks
    payer_email = None
    payer_name = "Anonymous"
    payer_id = None
    
    payer = resource.get('payer') or {}
    if payer:
        # v1 format: payer.payer_info
        payer_info = payer.get('payer_info') or {}
        if payer_info:
            payer_email = payer_info.get('email')
            payer_id = payer_info.get('payer_id')
            
            # Construct name from first_name/last_name
            first_name = payer_info.get('first_name') or ''
            last_name = payer_info.get('last_name') or ''
            constructed_name = f"{first_name} {last_name}".strip()
            if constructed_name:
                payer_name = constructed_name
        
        # v2 format: payer.name and payer.email_address
        if not payer_email:
            payer_email = payer.get('email_address') or payer.get('email')
        
        if payer_name == "Anonymous" and payer.get('name'):
            name_obj = payer['name']
            # v2 format: name.full_name or name.given_name/family_name
            if 'full_name' in name_obj:
                payer_name = name_obj.get('full_name') or "Anonymous"
            else:
                given_name = name_obj.get('given_name') or ''
                family_name = name_obj.get('family_name') or name_obj.get('surname') or ''
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
        "state": resource.get('state') or resource.get('status'),
        "create_time": resource.get('create_time'),
        "payer_email": payer_email,
        "payer_name": payer_name,
        "payer_id": payer_id
    }

# Example test payloads for validation
VALID_WEBHOOK_PAYLOAD_V1 = {
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

VALID_WEBHOOK_PAYLOAD_V2 = {
    "id": "WH-2BA34567DE890-123456789",
    "event_type": "PAYMENT.CAPTURE.COMPLETED",
    "create_time": "2024-01-15T10:30:00Z",
    "resource_type": "capture",
    "event_version": "2.0",
    "summary": "Payment captured for $30.00 USD",
    "resource": {
        "id": "9Y103481D92095551",
        "amount": {
            "value": "30.00",
            "currency_code": "USD"
        },
        "status": "COMPLETED",
        "create_time": "2024-01-15T10:30:00Z",
        "update_time": "2024-01-15T10:30:05Z",
        "supplementary_data": {
            "related_ids": {
                "order_id": "PAYID-ND6FK5I08A4595089705973J"
            }
        },
        "payer": {
            "name": {
                "given_name": "John",
                "surname": "Doe"
            },
            "email_address": "user@example.com",
            "payer_id": "ABC123XYZ"
        }
    }
}

if __name__ == "__main__":
    # Test payload validation for both v1 and v2
    try:
        # Test v1 SALE payload
        validated_v1 = validate_webhook_payload(VALID_WEBHOOK_PAYLOAD_V1)
        payment_info_v1 = extract_payment_info(validated_v1)
        print("✅ v1 SALE payload validation successful")
        print(f"📋 v1 Payment info: {payment_info_v1}")
        
        # Test v2 CAPTURE payload  
        validated_v2 = validate_webhook_payload(VALID_WEBHOOK_PAYLOAD_V2)
        payment_info_v2 = extract_payment_info(validated_v2)
        print("✅ v2 CAPTURE payload validation successful")
        print(f"📋 v2 Payment info: {payment_info_v2}")
    except Exception as e:
        print(f"❌ Payload validation failed: {e}")