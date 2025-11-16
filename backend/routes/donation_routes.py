from __future__ import annotations


from fastapi import APIRouter, Request, Body,  HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from helpers.Firebase_helpers import authenticate_uid

from controllers.donation_controller import (
    CreateDonationOrder,
    CaptureDonation,
    CreateDonationSubscription,
    CancelDonationSubscription,
    create_paypal_order_for_donation,
    capture_paypal_order_for_donation,
    create_subscription_and_return_approval,
    cancel_donation_subscription,
    AdminRefundDonationSubscriptionPayment,
    AdminRefundOneTimeDonation,
    admin_refund_donation_subscription_payment,
    admin_refund_one_time_donation
)

donation_router = APIRouter(prefix="/donations", tags=["Donations"])

private_donation_router = APIRouter(prefix="/donations", tags=["Donations (Private)"])

admin_donation_router = APIRouter(prefix="/admin-donations", tags=["Admin Donations"])


async def attach_optional_uid_to_request_state(request: Request):
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header:
        request.state.uid = None
        return

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        request.state.uid = None
        return

    token = parts[1]
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    try:
        uid = await authenticate_uid(creds)
        request.state.uid = uid
    except HTTPException:
        request.state.uid = None

@donation_router.post("/one-time/create")
async def create_one_time_donation(
    request: Request,
    body: CreateDonationOrder = Body(...),
):
    await attach_optional_uid_to_request_state(request)
    return await create_paypal_order_for_donation(request=request, body=body)

@donation_router.post("/one-time/capture")
async def capture_one_time_donation(
    request: Request,
    body: CaptureDonation = Body(...),
):
    await attach_optional_uid_to_request_state(request)
    return await capture_paypal_order_for_donation(request=request, body=body)

@donation_router.post("/subscription/create")
async def create_donation_subscription(
    request: Request,
    body: CreateDonationSubscription = Body(...),
):
    await attach_optional_uid_to_request_state(request)
    return await create_subscription_and_return_approval(request=request, body=body)

@private_donation_router.post("/subscription/cancel")
async def cancel_donation_subscription_private(
    request: Request,
    body: CancelDonationSubscription = Body(...),
):
    return await cancel_donation_subscription(request=request, body=body)

@admin_donation_router.post("/subscription/cancel")
async def admin_cancel_donation_subscription_route(
    request: Request,
    body: CancelDonationSubscription = Body(...),
):
    # main.py ensures only admins hit this router
    return await cancel_donation_subscription(
        request=request,
        body=body,
        admin_override=True,  # new kwarg
    )

@admin_donation_router.post("/one-time/refund")
async def admin_refund_one_time_donation_route(
    request: Request,
    body: AdminRefundOneTimeDonation = Body(...),
):
    return await admin_refund_one_time_donation(request=request, body=body)


@admin_donation_router.post("/subscription-payment/refund")
async def admin_refund_donation_subscription_payment_route(
    request: Request,
    body: AdminRefundDonationSubscriptionPayment = Body(...),
):
    return await admin_refund_donation_subscription_payment(request=request, body=body)
