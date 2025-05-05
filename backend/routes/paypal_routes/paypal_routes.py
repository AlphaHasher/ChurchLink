import os
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from paypalserversdk.http.auth.o_auth_2 import ClientCredentialsAuthCredentials
from paypalserversdk.logging.configuration.api_logging_configuration import (
    LoggingConfiguration,
    RequestLoggingConfiguration,
    ResponseLoggingConfiguration,
)
from paypalserversdk.paypal_serversdk_client import PaypalServersdkClient
from paypalserversdk.controllers.orders_controller import OrdersController
from paypalserversdk.controllers.payments_controller import PaymentsController
from paypalserversdk.models.amount_breakdown import AmountBreakdown
from paypalserversdk.models.amount_with_breakdown import AmountWithBreakdown
from paypalserversdk.models.checkout_payment_intent import CheckoutPaymentIntent
from paypalserversdk.models.order_request import OrderRequest
# from paypalserversdk.models.capture_request import CaptureRequest
from paypalserversdk.models.money import Money
# from paypalserversdk.models.shipping_details import ShippingDetails
# from paypalserversdk.models.shipping_option import ShippingOption
# from paypalserversdk.models.shipping_type import ShippingType
from paypalserversdk.models.purchase_unit_request import PurchaseUnitRequest
# from paypalserversdk.models.payment_source import PaymentSource
# from paypalserversdk.models.card_request import CardRequest
# from paypalserversdk.models.card_attributes import CardAttributes
from paypalserversdk.models.item import Item
from paypalserversdk.models.item_category import ItemCategory
# from paypalserversdk.models.paypal_wallet import PaypalWallet
# from paypalserversdk.models.paypal_wallet_experience_context import PaypalWalletExperienceContext
# from paypalserversdk.models.shipping_preference import ShippingPreference
# from paypalserversdk.models.paypal_experience_landing_page import PaypalExperienceLandingPage
# from paypalserversdk.models.paypal_experience_user_action import PaypalExperienceUserAction
# from paypalserversdk.exceptions.error_exception import ErrorException
from paypalserversdk.api_helper import ApiHelper

paypal_router = APIRouter(prefix="/paypal", tags=["paypal"])

# Initialize the PayPal client with required credentials and logging configuration.
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
payments_controller: PaymentsController = paypal_client.payments

# ------------------------------------------------------------------------------
# Endpoint to Create an Order
# ------------------------------------------------------------------------------
@paypal_router.post("/orders", status_code=200)
async def create_order(request: Request):
    request_body = await request.json()

    cart = request_body.get("cart")

    # Build the order request
    order = orders_controller.create_order({
        "body": OrderRequest(
            intent=CheckoutPaymentIntent.CAPTURE,
            purchase_units=[
                PurchaseUnitRequest(
                    amount=AmountWithBreakdown(
                        currency_code="USD",
                        value="100",
                        breakdown=AmountBreakdown(
                            item_total=Money(currency_code="USD", value="100")
                        ),
                    ),
                    items=[
                        Item(
                            name="T-Shirt",
                            unit_amount=Money(currency_code="USD", value="100"),
                            quantity="1",
                            description="Super Fresh Shirt",
                            sku="sku01",
                            category=ItemCategory.PHYSICAL_GOODS,
                        )
                    ],
                )
            ],
        )
    })

    # Return the order details as JSON.
    return JSONResponse(
        content=ApiHelper.json_serialize(order.body)
    )

# ------------------------------------------------------------------------------
# Endpoint to Capture the Payment for an Order
# ------------------------------------------------------------------------------
@paypal_router.post("/orders/{order_id}/capture", status_code=200)
async def capture_order(order_id: str):
    # Capture the order payment.
    order = orders_controller.capture_order(
        {
            "id": order_id,
            "prefer": "return=representation"
        }
    )

    # Return the captured order details as JSON.
    return JSONResponse(
        content=ApiHelper.json_serialize(order.body),
    )
