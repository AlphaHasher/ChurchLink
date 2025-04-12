from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
import os
import logging

from paypalserversdk.http.auth.o_auth_2 import ClientCredentialsAuthCredentials
from paypalserversdk.logging.configuration.api_logging_configuration import (
    LoggingConfiguration,
    RequestLoggingConfiguration,
    ResponseLoggingConfiguration,
)
from paypalserversdk.paypal_serversdk_client import PaypalServersdkClient
from paypalserversdk.controllers.orders_controller import OrdersController
from paypalserversdk.models.amount_with_breakdown import AmountWithBreakdown
from paypalserversdk.models.checkout_payment_intent import CheckoutPaymentIntent
from paypalserversdk.models.order_request import OrderRequest
from paypalserversdk.models.purchase_unit_request import PurchaseUnitRequest
from paypalserversdk.api_helper import ApiHelper


# Define request models for PayPal
class CartItem(BaseModel):
    # Define your cart item structure here
    # Example: id: str, name: str, price: float, quantity: int
    pass

class OrderRequestBody(BaseModel):
    cart: List[CartItem]

paypal_router = APIRouter()

#####################################################
# PayPal SDK Configuration
#####################################################

paypal_client: PaypalServersdkClient = PaypalServersdkClient(
    client_credentials_auth_credentials=ClientCredentialsAuthCredentials(
        o_auth_client_id=os.getenv("PAYPAL_CLIENT_ID"),
        o_auth_client_secret=os.getenv("PAYPAL_CLIENT_SECRET"),
    ),
    logging_configuration=LoggingConfiguration(
        log_level=logging.INFO,
        # Disable masking of sensitive headers for Sandbox testing.
        # This should be set to True (the default if unset)in production.
        mask_sensitive_headers=False,
        request_logging_config=RequestLoggingConfiguration(
            log_headers=True, log_body=True
        ),
        response_logging_config=ResponseLoggingConfiguration(
            log_headers=True, log_body=True
        ),
    ),
)

orders_controller: OrdersController = paypal_client.orders

@paypal_router.post("/api/orders")
async def create_order(request_body: OrderRequestBody):
    """
    Create an order to start the transaction.

    See: https://developer.paypal.com/docs/api/orders/v2/#orders_create
    """
    # use the cart information passed from the front-end to calculate the order amount details
    cart = request_body.cart
    order = orders_controller.create_order(
        {
            "body": OrderRequest(
                intent=CheckoutPaymentIntent.CAPTURE,
                purchase_units=[
                    PurchaseUnitRequest(
                        AmountWithBreakdown(currency_code="USD", value="100.00")
                    )
                ],
            ),
            "prefer": "return=representation",
        }
    )
    return JSONResponse(
        content=ApiHelper.json_deserialize(ApiHelper.json_serialize(order.body)),
        status_code=200
    )

@paypal_router.post("/api/orders/{order_id}/capture")
async def capture_order(order_id: str):
    """
    Capture payment for the created order to complete the transaction.

    See: https://developer.paypal.com/docs/api/orders/v2/#orders_capture
    """
    order = orders_controller.capture_order(
        {"id": order_id, "prefer": "return=representation"}
    )
    return JSONResponse(
        content=ApiHelper.json_deserialize(ApiHelper.json_serialize(order.body)),
        status_code=200
    )
