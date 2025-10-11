from fastapi import APIRouter, Request, HTTPException, Body
from typing import Dict, Any
from datetime import datetime
import json

from models.form import get_form_by_slug, get_form_by_id
from models.transaction import Transaction
from helpers.paypalHelper import create_order
from config.settings import settings

form_payment_router = APIRouter(prefix="/forms", tags=["Form Payments"])

@form_payment_router.post("/slug/{slug}/payment/create-order")
async def create_form_payment_order(
    slug: str,
    request: Request,
    payment_data: Dict[str, Any] = Body(...)
):
    """Create PayPal payment order for form submission with payment"""
    try:
        print(f"🔍 Creating form payment order for slug: {slug}")
        print(f"🔍 Payment data received: {payment_data}")
        
        # Get the form by slug
        form = await get_form_by_slug(slug)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        print(f"✅ Form found: {form.title}")
        
        # Check if form requires payment
        if not form.requires_payment:
            raise HTTPException(
                status_code=400,
                detail="This form does not require payment"
            )
        
        # Extract payment information
        payment_amount = payment_data.get("payment_amount")
        form_response = payment_data.get("form_response", {})
        return_url = payment_data.get("return_url", f"{settings.FRONTEND_URL}/forms/{slug}/payment/success")
        cancel_url = payment_data.get("cancel_url", f"{settings.FRONTEND_URL}/forms/{slug}/payment/cancel")
        
        # Validate payment amount based on form configuration
        if form.payment_type == "fixed":
            if not form.payment_amount:
                raise HTTPException(status_code=400, detail="Form payment amount not configured")
            payment_amount = form.payment_amount
        elif form.payment_type == "donation":
            if not payment_amount:
                raise HTTPException(status_code=400, detail="Payment amount is required for donation forms")
            payment_amount = float(payment_amount)
            if form.min_payment_amount and payment_amount < form.min_payment_amount:
                raise HTTPException(status_code=400, detail=f"Minimum payment amount is ${form.min_payment_amount}")
            if form.max_payment_amount and payment_amount > form.max_payment_amount:
                raise HTTPException(status_code=400, detail=f"Maximum payment amount is ${form.max_payment_amount}")
        elif form.payment_type == "variable":
            if not payment_amount:
                raise HTTPException(status_code=400, detail="Payment amount is required for variable payment forms")
            payment_amount = float(payment_amount)
            if form.min_payment_amount and payment_amount < form.min_payment_amount:
                raise HTTPException(status_code=400, detail=f"Minimum payment amount is ${form.min_payment_amount}")
            if form.max_payment_amount and payment_amount > form.max_payment_amount:
                raise HTTPException(status_code=400, detail=f"Maximum payment amount is ${form.max_payment_amount}")
        
        if payment_amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")
        
        print(f"🔍 Validated payment amount: ${payment_amount}")
        
        # Create description for PayPal
        description = form.payment_description or f"Form submission: {form.title}"
        
        # Prepare donation data for PayPal helper
        donation_data = {
            "fund_name": f"Form: {form.title}",
            "amount": payment_amount,
            "message": description,
            "return_url": return_url,
            "cancel_url": cancel_url,
            "form_id": form.id,
            "form_title": form.title,
            "form_slug": slug,
            "payment_type": "form_submission",
            "form_response": form_response
        }
        
        print(f"🔍 Donation data prepared: {donation_data}")
        
        # Create the PayPal order using existing helper
        class MockRequest:
            def __init__(self, data):
                self.data = data
            
            async def json(self):
                return self.data
        
        mock_request = MockRequest({"donation": donation_data})
        
        print("🔍 Calling create_order helper function")
        result = await create_order(mock_request)
        print(f"🔍 PayPal helper result type: {type(result)}")
        
        if hasattr(result, 'status_code') and result.status_code != 200:
            print(f"❌ PayPal helper returned error status: {result.status_code}")
            raise HTTPException(status_code=500, detail="Failed to create PayPal order")
        
        print("✅ Form PayPal order created successfully")
        return result
        
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create form payment order: {str(e)}")

@form_payment_router.post("/slug/{slug}/payment/complete-submission")
async def complete_form_payment_submission(
    slug: str,
    request: Request,
    completion_data: Dict[str, Any] = Body(...)
):
    """Complete form submission after successful payment"""
    try:
        print(f"🔍 Completing form payment submission for slug: {slug}")
        print(f"🔍 Completion data received: {completion_data}")
        
        # Get the form by slug
        form = await get_form_by_slug(slug)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        payment_id = completion_data.get("payment_id", "")
        payer_id = completion_data.get("payer_id", "")
        total_amount = completion_data.get("total_amount", 0.0)
        payer_email = completion_data.get("payer_email", "")
        payer_name = completion_data.get("payer_name", "")
        form_response = completion_data.get("form_response", {})
        user_uid = completion_data.get("user_uid")  # Try to get from completion data
        
        # If user_uid not in completion data, try to get from request.state
        if not user_uid:
            try:
                user_uid = request.state.uid
                print(f"🔍 Got user_uid from request.state: {user_uid}")
            except AttributeError:
                print(f"⚠️ No user_uid in request.state, proceeding without user linkage")
                user_uid = None
        
        print(f"🔍 Using user_uid: {user_uid}")
        print(f"🔍 Payment ID: {payment_id}, Total: ${total_amount}")
        
        if not payment_id:
            raise HTTPException(status_code=400, detail="Payment ID is required")
        
        # Check if this payment has already been processed
        existing_transaction = await Transaction.get_transaction_by_id(payment_id)
        if existing_transaction and existing_transaction.form_id == form.id:
            print(f"[FORM_PAYMENT] Payment {payment_id} already processed for form {form.id}")
            return {
                "status": "success",
                "message": "Form submission already completed",
                "form_id": form.id,
                "form_slug": slug,
                "payment_id": payment_id,
                "total_amount": existing_transaction.amount
            }
        
        # Record payment transaction
        if payment_id:
            try:
                print(f"🔍 Recording transaction for form submission")
                
                # Create transaction record with form-specific information
                transaction = Transaction(
                    transaction_id=payment_id,
                    user_email=payer_email or "unknown@example.com",
                    amount=total_amount,
                    status="completed",
                    type="one-time",
                    order_id=payment_id,
                    payment_method="paypal",
                    time=datetime.now().isoformat(),
                    name=payer_name or "Anonymous",
                    fund_name=f"Form: {form.title}",
                    note=form.payment_description or f"Form submission payment for {form.title}",
                    currency="USD",
                    event_type="form_submission",
                    created_on=datetime.now().isoformat(),
                    form_id=form.id,
                    form_slug=slug,
                    payment_type="form_submission",
                    user_uid=user_uid,
                    metadata={
                        "form_title": form.title,
                        "form_slug": slug,
                        "form_response": form_response,
                        "payment_type": form.payment_type,
                        "payment_description": form.payment_description
                    }
                )
                
                # Save transaction to database
                print(f"🔍 Saving transaction to database...")
                saved_transaction = await Transaction.create_transaction(transaction)
                print(f"🔍 Transaction.create_transaction returned: {saved_transaction}")
                
                if saved_transaction:
                    print(f"✅ Transaction recorded: {payment_id} for ${total_amount}")
                else:
                    print(f"❌ Failed to save transaction: {payment_id}")
                    
            except Exception as e:
                print(f"❌ Error recording transaction: {str(e)}")
                # Don't fail the whole operation if transaction recording fails
        
        # Save form response with payment information
        try:
            from models.form import add_response_by_slug
            
            # Add payment information to the form response
            enhanced_response = dict(form_response)
            enhanced_response["payment_info"] = {
                "payment_id": payment_id,
                "amount": total_amount,
                "payer_email": payer_email,
                "payer_name": payer_name,
                "payment_status": "completed",
                "payment_date": datetime.now().isoformat()
            }
            
            print(f"🔍 Saving form response with payment info")
            success, response_id = await add_response_by_slug(slug, enhanced_response, user_id=user_uid)
            
            if success:
                print(f"✅ Form response saved with ID: {response_id}")
                return {
                    "status": "success",
                    "message": "Form submission and payment completed successfully",
                    "form_id": form.id,
                    "form_slug": slug,
                    "payment_id": payment_id,
                    "response_id": response_id,
                    "total_amount": total_amount
                }
            else:
                print(f"❌ Failed to save form response: {response_id}")
                return {
                    "status": "partial_success",
                    "message": "Payment completed but form submission failed",
                    "form_id": form.id,
                    "form_slug": slug,
                    "payment_id": payment_id,
                    "total_amount": total_amount,
                    "error": response_id
                }
                
        except Exception as e:
            print(f"❌ Error saving form response: {str(e)}")
            return {
                "status": "partial_success",
                "message": "Payment completed but form submission failed",
                "form_id": form.id,
                "form_slug": slug,
                "payment_id": payment_id,
                "total_amount": total_amount,
                "error": str(e)
            }
        
    except HTTPException as he:
        raise
    except Exception as e:
        print(f"❌ Error completing form submission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to complete form submission: {str(e)}")

@form_payment_router.get("/{form_id}/payment-summary")
async def get_form_payment_summary(form_id: str, request: Request):
    """Get payment summary for a form (admin only)"""
    try:
        uid = request.state.uid
        
        # Get the form and verify ownership
        form = await get_form_by_id(form_id, uid)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        if not form.requires_payment:
            return {
                "form_id": form_id,
                "form_title": form.title,
                "requires_payment": False,
                "total_submissions": 0,
                "total_revenue": 0.0,
                "payment_summary": {}
            }
        
        # Get transactions for this form
        try:
            from mongo.database import DB
            pipeline = [
                {"$match": {"form_id": form_id}},
                {"$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "total_amount": {"$sum": "$amount"}
                }}
            ]
            result = await DB.db["transactions"].aggregate(pipeline).to_list(None)
            payment_summary = {item["_id"]: {"count": item["count"], "total_amount": item["total_amount"]} for item in result}
            
            # Calculate totals
            total_submissions = sum(item["count"] for item in payment_summary.values())
            total_revenue = sum(item["total_amount"] for item in payment_summary.values() if item["_id"] == "completed")
            
            return {
                "form_id": form_id,
                "form_title": form.title,
                "requires_payment": True,
                "payment_type": form.payment_type,
                "payment_amount": form.payment_amount,
                "total_submissions": total_submissions,
                "total_revenue": total_revenue,
                "payment_summary": payment_summary
            }
            
        except Exception as e:
            print(f"❌ Error getting payment summary: {str(e)}")
            return {
                "form_id": form_id,
                "form_title": form.title,
                "requires_payment": True,
                "total_submissions": 0,
                "total_revenue": 0.0,
                "payment_summary": {},
                "error": str(e)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payment summary: {str(e)}")

@form_payment_router.get("/slug/{slug}/payment-config")
async def get_form_payment_config(slug: str):
    """Get payment configuration for a form (public endpoint for frontend)"""
    try:
        # Get the form by slug
        form = await get_form_by_slug(slug)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        if not form.visible:
            raise HTTPException(status_code=404, detail="Form not found")
        
        return {
            "form_id": form.id,
            "form_title": form.title,
            "form_slug": slug,
            "requires_payment": form.requires_payment,
            "payment_type": form.payment_type,
            "payment_amount": form.payment_amount,
            "payment_description": form.payment_description,
            "allow_partial_payment": form.allow_partial_payment,
            "min_payment_amount": form.min_payment_amount,
            "max_payment_amount": form.max_payment_amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payment config: {str(e)}")