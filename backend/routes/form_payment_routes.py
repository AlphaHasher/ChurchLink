from fastapi import APIRouter, Request, HTTPException, Body, status
from fastapi.security import HTTPAuthorizationCredentials
from typing import Dict, Any
from helpers.form_payment_helper import form_payment_helper
from helpers.audit_logger import get_client_ip, get_user_agent
from helpers.Firebase_helpers import authenticate_uid

form_payment_router = APIRouter(prefix="/forms", tags=["Form Payments"])


@form_payment_router.post("/slug/{slug}/payment/create-order")
async def create_form_payment_order(
    slug: str,
    request: Request,
    payment_data: Dict[str, Any] = Body(...)
):
    """Create PayPal payment order for form submission with payment"""
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    return await form_payment_helper.create_form_payment_order(
        slug=slug,
        payment_data=payment_data,
        client_ip=client_ip,
        user_agent=user_agent
    )


@form_payment_router.post("/slug/{slug}/payment/complete-submission")
async def complete_form_submission(
    slug: str,
    request: Request,
    completion_data: Dict[str, Any] = Body(...)
):
    """Complete form submission after payment processing"""
    client_ip = get_client_ip(request)
    
    # Authenticate the user
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")

    token = parts[1]
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    try:
        user_id = await authenticate_uid(creds)
    except HTTPException:
        raise

    # Ensure we have a valid user ID
    if not user_id or user_id.strip() == "":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required - anonymous submissions not allowed")
    
    # Add authenticated user_id to completion data
    completion_data["user_id"] = user_id
    
    return await form_payment_helper.complete_form_submission(
        slug=slug,
        completion_data=completion_data,
        client_ip=client_ip
    )


@form_payment_router.post("/slug/{slug}/payment/complete-paypal")
async def complete_paypal_payment(
    slug: str,
    request: Request,
    completion_data: Dict[str, Any] = Body(...)
):
    """Complete PayPal payment and finalize form submission"""
    client_ip = get_client_ip(request)
    
    # Authenticate the user (same pattern as complete-submission)
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")

    token = parts[1]
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    try:
        user_id = await authenticate_uid(creds)
    except HTTPException:
        raise

    # Ensure we have a valid user ID
    if not user_id or user_id.strip() == "":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required - anonymous submissions not allowed")
    
    # Add authenticated user_id to completion data
    completion_data["user_id"] = user_id
    
    return await form_payment_helper.complete_paypal_payment(
        slug=slug,
        completion_data=completion_data,
        client_ip=client_ip
    )


@form_payment_router.get("/{form_id}/payment-summary")
async def get_form_payment_summary(
    form_id: str,
    request: Request
):
    """Get payment summary for a form"""
    user_id = getattr(request.state, 'current_user_uid', 'unknown')
    client_ip = get_client_ip(request)
    
    return await form_payment_helper.get_form_payment_summary(
        form_id=form_id,
        user_id=user_id,
        client_ip=client_ip
    )


@form_payment_router.get("/slug/{slug}/payment-config")
async def get_form_payment_config(
    slug: str,
    request: Request
):
    """Get payment configuration for a form"""
    client_ip = get_client_ip(request)
    
    return await form_payment_helper.get_form_payment_config(
        slug=slug,
        client_ip=client_ip
    )