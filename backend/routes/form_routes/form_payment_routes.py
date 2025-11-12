from __future__ import annotations

from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, Body, HTTPException
from pydantic import BaseModel

from controllers.form_payment_controller import (
    create_paypal_order_for_form,
    capture_and_submit_form,
)

form_payment_router = APIRouter(prefix="/forms/payments", tags=["Forms Payments"])



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
