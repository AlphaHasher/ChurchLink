from __future__ import annotations

from typing import Dict, Any
from fastapi import APIRouter, Request, Body, HTTPException
from pydantic import BaseModel

from controllers.form_payment_controller import (
    create_paypal_order_for_form,
    capture_and_submit_form,
    AdminRefundFormPayment,
    admin_refund_form_payment
)

form_payment_router = APIRouter(prefix="/forms/payments", tags=["Forms Payments"])
admin_form_payment_router = APIRouter(prefix="/admin/forms/payments", tags=["Admin Form Payments"])


class CreateOrderBody(BaseModel):
    slug: str

class CaptureAndSubmitBody(BaseModel):
    slug: str
    order_id: str
    answers: Dict[str, Any] = {}

@form_payment_router.post("/create")
async def create_form_payment_order(request: Request, body: CreateOrderBody = Body(...)):
    return await create_paypal_order_for_form(request=request, slug=body.slug)


@form_payment_router.post("/capture-and-submit")
async def capture_and_submit_route(request: Request, body: CaptureAndSubmitBody = Body(...)):
    if not body.slug or not body.order_id:
        raise HTTPException(status_code=422, detail="slug and order_id are required")
    return await capture_and_submit_form(
        request=request,
        slug=body.slug,
        order_id=body.order_id,
        answers=body.answers or {},
    )

@admin_form_payment_router.post("/refund")
async def admin_refund_form_payment_route(request: Request, body: AdminRefundFormPayment = Body(...)):
    """
    Admin-only endpoint to refund a PayPal-backed form payment.

    Body:
      {
        "paypal_capture_id": "CAPTURE_ID",
        "amount": 3.00   # optional, partial refund; omit for full refund
      }
    """
    return await admin_refund_form_payment(request=request, body=body)