from __future__ import annotations

from fastapi import APIRouter, Request, Body

from controllers.donation_controller import (
    CreateDonationOrder,
    CaptureDonation,
    CreateDonationSubscription,
    create_paypal_order_for_donation,
    capture_paypal_order_for_donation,
    create_subscription_and_return_approval,
)

donation_router = APIRouter(prefix="/donations", tags=["Donations"])


@donation_router.post("/one-time/create")
async def create_one_time_donation(request: Request, body: CreateDonationOrder = Body(...)):
    return await create_paypal_order_for_donation(request=request, body=body)


@donation_router.post("/one-time/capture")
async def capture_one_time_donation(request: Request, body: CaptureDonation = Body(...)):
    return await capture_paypal_order_for_donation(request=request, body=body)


@donation_router.post("/subscription/create")
async def create_donation_subscription(request: Request, body: CreateDonationSubscription = Body(...)):
    return await create_subscription_and_return_approval(request=request, body=body)
