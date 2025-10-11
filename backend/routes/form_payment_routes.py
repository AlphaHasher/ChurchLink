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
        # First check the explicit requires_payment flag
        form_requires_payment = getattr(form, 'requires_payment', False)
        
        # If not explicitly set, check if form has price fields in schema
        if not form_requires_payment and hasattr(form, 'data') and form.data:
            # Check if any field in the form schema is a price field
            schema_data = form.data if isinstance(form.data, list) else []
            has_price_fields = any(field.get('type') == 'price' for field in schema_data if isinstance(field, dict))
            form_requires_payment = has_price_fields
        
        # Also check if the frontend is sending schema information about price fields
        form_schema = payment_data.get("form_schema", [])
        if not form_requires_payment and form_schema:
            has_price_fields_in_request = any(field.get('type') == 'price' for field in form_schema)
            form_requires_payment = has_price_fields_in_request
        
        print(f"🔍 Form requires payment: {form_requires_payment}")
        print(f"🔍 Form.requires_payment flag: {getattr(form, 'requires_payment', 'Not set')}")
        
        if not form_requires_payment:
            raise HTTPException(
                status_code=400,
                detail="This form does not require payment"
            )
        
        # Extract payment information
        payment_amount = payment_data.get("payment_amount")
        form_response = payment_data.get("form_response", {})
        
        # Include payment amount in return URL for frontend
        base_return_url = payment_data.get("return_url", f"{settings.FRONTEND_URL}/forms/{slug}/payment/success")
        return_url = f"{base_return_url}?amount={payment_amount}" if payment_amount else base_return_url
        cancel_url = payment_data.get("cancel_url", f"{settings.FRONTEND_URL}/forms/{slug}/payment/cancel")
        
        # Validate payment amount based on form configuration
        payment_type = getattr(form, 'payment_type', None)
        print(f"🔍 Form payment type: {payment_type}")
        
        if payment_type == "fixed":
            if not getattr(form, 'payment_amount', None):
                # If no fixed amount is configured but we have price fields, treat as variable
                if form_schema or (hasattr(form, 'data') and any(field.get('type') == 'price' for field in (form.data or []) if isinstance(field, dict))):
                    print("🔍 No fixed amount configured but price fields detected, treating as variable payment")
                    if not payment_amount:
                        raise HTTPException(status_code=400, detail="Payment amount is required")
                    payment_amount = float(payment_amount)
                else:
                    raise HTTPException(status_code=400, detail="Form payment amount not configured")
            else:
                payment_amount = form.payment_amount
        elif payment_type == "donation":
            if not payment_amount:
                raise HTTPException(status_code=400, detail="Payment amount is required for donation forms")
            payment_amount = float(payment_amount)
            if getattr(form, 'min_payment_amount', None) and payment_amount < form.min_payment_amount:
                raise HTTPException(status_code=400, detail=f"Minimum payment amount is ${form.min_payment_amount}")
            if getattr(form, 'max_payment_amount', None) and payment_amount > form.max_payment_amount:
                raise HTTPException(status_code=400, detail=f"Maximum payment amount is ${form.max_payment_amount}")
        elif payment_type == "variable":
            if not payment_amount:
                raise HTTPException(status_code=400, detail="Payment amount is required for variable payment forms")
            payment_amount = float(payment_amount)
            if getattr(form, 'min_payment_amount', None) and payment_amount < form.min_payment_amount:
                raise HTTPException(status_code=400, detail=f"Minimum payment amount is ${form.min_payment_amount}")
            if getattr(form, 'max_payment_amount', None) and payment_amount > form.max_payment_amount:
                raise HTTPException(status_code=400, detail=f"Maximum payment amount is ${form.max_payment_amount}")
        else:
            # No payment type configured but form has price fields - use calculated amount
            if not payment_amount:
                raise HTTPException(status_code=400, detail="Payment amount is required")
            payment_amount = float(payment_amount)
        
        if payment_amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")
        
        print(f"🔍 Validated payment amount: ${payment_amount}")
        
        # Create description for PayPal
        description = form.payment_description or f"Form submission: {form.title}"
        
        # Create PayPal order using Orders API v2
        from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url
        import requests
        
        access_token = get_paypal_access_token()
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to get PayPal access token")
        
        # Create order data
        order_data = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": "USD",
                        "value": str(payment_amount)
                    },
                    "description": description
                }
            ],
            "application_context": {
                "return_url": return_url,
                "cancel_url": cancel_url,
                "brand_name": "ChurchLink",
                "landing_page": "LOGIN",
                "shipping_preference": "NO_SHIPPING",
                "user_action": "PAY_NOW"
            }
        }
        
        # Create order via PayPal API
        create_url = f"{get_paypal_base_url()}/v2/checkout/orders"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
        }
        
        create_response = requests.post(create_url, headers=headers, json=order_data)
        
        if create_response.status_code != 201:
            print(f"❌ PayPal order creation failed: {create_response.text}")
            raise HTTPException(status_code=500, detail=f"Failed to create PayPal order: {create_response.text}")
        
        order_response = create_response.json()
        order_id = order_response.get("id")
        
        # Find the approval URL
        approval_url = None
        for link in order_response.get("links", []):
            if link.get("rel") == "approve":
                approval_url = link.get("href")
                break
        
        if not approval_url:
            raise HTTPException(status_code=500, detail="Failed to get PayPal approval URL")
        
        print(f"✅ PayPal order created successfully: {order_id}")
        print(f"� Approval URL: {approval_url}")
        
        return {
            "success": True,
            "approval_url": approval_url,
            "order_id": order_id,
            "payment_amount": payment_amount
        }
        
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
        # Don't use total_amount from frontend - we'll get it from PayPal
        payer_email = completion_data.get("payer_email", "")
        payer_name = completion_data.get("payer_name", "")
        form_response = completion_data.get("form_response", {})
        user_uid = completion_data.get("user_uid")  # Try to get from completion data
        
        if not payment_id:
            raise HTTPException(status_code=400, detail="Payment ID is required")
        if not payer_id:
            raise HTTPException(status_code=400, detail="Payer ID is required")
        
        # Capture the PayPal payment to get the real amount
        print(f"🔍 Capturing PayPal payment: {payment_id}")
        
        from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url
        import requests
        
        access_token = get_paypal_access_token()
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to get PayPal access token")
        
        # Capture the order
        capture_url = f"{get_paypal_base_url()}/v2/checkout/orders/{payment_id}/capture"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
        }
        
        capture_response = requests.post(capture_url, headers=headers)
        
        if capture_response.status_code != 201:
            raise HTTPException(
                status_code=400, 
                detail=f"PayPal payment capture failed: {capture_response.text}"
            )
        
        capture_data = capture_response.json()
        print(f"🔍 PayPal capture response: {capture_data}")
        
        # Extract real payment amount from PayPal response
        purchase_units = capture_data.get("purchase_units", [])
        if not purchase_units:
            raise HTTPException(status_code=400, detail="No purchase units found in PayPal response")
        
        purchase_unit = purchase_units[0]
        payments = purchase_unit.get("payments", {})
        captures = payments.get("captures", [])
        
        if not captures:
            raise HTTPException(status_code=400, detail="No captures found in PayPal response")
        
        capture = captures[0]
        amount_data = capture.get("amount", {})
        total_amount = float(amount_data.get("value", 0))  # Real amount from PayPal
        
        # Get real payer information from PayPal response
        payer = capture_data.get("payer", {})
        payer_name_data = payer.get("name", {})
        real_payer_name = f"{payer_name_data.get('given_name', '')} {payer_name_data.get('surname', '')}".strip()
        real_payer_email = payer.get("email_address", "")
        
        # Use PayPal data if frontend data is missing
        if not payer_name:
            payer_name = real_payer_name
        if not payer_email:
            payer_email = real_payer_email
            
        print(f"💰 Real payment amount from PayPal: ${total_amount}")
        print(f"👤 Real payer info from PayPal: {real_payer_name} ({real_payer_email})")
        
        # If user_uid not in completion data, try to get from request.state
        if not user_uid:
            try:
                user_uid = request.state.uid
                print(f"🔍 Got user_uid from request.state: {user_uid}")
            except AttributeError:
                print(f"⚠️ No user_uid in request.state, proceeding without user linkage")
                user_uid = None
        
        print(f"🔍 Using user_uid: {user_uid}")
        
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
                
                # Try to get Firebase user information if available
                final_user_uid = user_uid
                final_user_email = payer_email or "unknown@example.com"
                final_user_name = payer_name or "Anonymous"
                
                try:
                    # Check if user is authenticated via request state
                    if hasattr(request, 'state') and hasattr(request.state, 'uid'):
                        final_user_uid = request.state.uid
                        print(f"🔍 Found authenticated user UID: {final_user_uid}")
                        
                        # Get additional user info from Firebase if needed
                        from helpers.Firebase_helpers import get_user_info_by_uid
                        user_info = await get_user_info_by_uid(final_user_uid)
                        if user_info:
                            final_user_email = user_info.get('email') or final_user_email
                            final_user_name = user_info.get('displayName') or user_info.get('name') or final_user_name
                            print(f"🔍 Using Firebase user info - email: {final_user_email}, name: {final_user_name}")
                    
                    # If no authenticated user but we have payer email, try to find Firebase user by email
                    elif final_user_email and final_user_email != "unknown@example.com":
                        from helpers.Firebase_helpers import get_uid_by_email
                        try:
                            found_uid = await get_uid_by_email(final_user_email)
                            if found_uid:
                                final_user_uid = found_uid
                                print(f"🔍 Found Firebase user by email: {final_user_uid}")
                        except Exception as e:
                            print(f"🔍 Could not find Firebase user by email: {e}")
                            
                except Exception as e:
                    print(f"⚠️ Error getting Firebase user info: {e}")
                
                # Create transaction record with form-specific information
                transaction = Transaction(
                    transaction_id=payment_id,
                    user_email=final_user_email,
                    amount=total_amount,
                    status="completed",
                    type="one-time",
                    order_id=payment_id,
                    payment_method="paypal",
                    time=datetime.now().isoformat(),
                    name=final_user_name,
                    fund_name=f"Form: {form.title}",
                    note=form.payment_description or f"Form submission payment for {form.title}",
                    currency="USD",
                    event_type="form_submission",
                    created_on=datetime.now().isoformat(),
                    form_id=form.id,
                    form_slug=slug,
                    payment_type="form_submission",
                    user_uid=final_user_uid,
                    metadata={
                        "form_title": form.title,
                        "form_slug": slug,
                        "form_response": form_response,
                        "payment_type": form.payment_type,
                        "payment_description": form.payment_description,
                        "firebase_uid": final_user_uid,
                        "original_payer_email": payer_email,
                        "original_payer_name": payer_name
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

@form_payment_router.post("/slug/{slug}/payment/complete-paypal")
async def complete_paypal_payment(
    slug: str,
    request: Request,
    payment_data: Dict[str, Any] = Body(...)
):
    """Complete PayPal payment after user returns from PayPal"""
    try:
        print(f"🔍 Completing PayPal payment for slug: {slug}")
        print(f"🔍 Payment data: {payment_data}")
        
        # Get the form by slug
        form = await get_form_by_slug(slug)
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        payment_id = payment_data.get("payment_id")
        token = payment_data.get("token")
        payer_id = payment_data.get("payer_id")
        
        if not all([payment_id, token, payer_id]):
            raise HTTPException(status_code=400, detail="Missing required payment parameters")
        
        # Import PayPal helper to capture the payment
        from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url
        import requests
        
        # Capture the PayPal payment using direct API call
        access_token = get_paypal_access_token()
        if not access_token:
            raise HTTPException(status_code=500, detail="Failed to get PayPal access token")
        
        # Capture the order
        capture_url = f"{get_paypal_base_url()}/v2/checkout/orders/{payment_id}/capture"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
        }
        
        capture_response = requests.post(capture_url, headers=headers)
        
        if capture_response.status_code != 201:
            raise HTTPException(
                status_code=400, 
                detail=f"PayPal payment capture failed: {capture_response.text}"
            )
        
        capture_data = capture_response.json()
        print(f"🔍 PayPal capture response: {capture_data}")
        
        # Extract transaction details from PayPal response
        status = capture_data.get("status", "")
        if status != "COMPLETED":
            raise HTTPException(
                status_code=400, 
                detail=f"PayPal payment not completed. Status: {status}"
            )
        
        # Get payment details
        purchase_units = capture_data.get("purchase_units", [])
        if not purchase_units:
            raise HTTPException(status_code=400, detail="No purchase units found in PayPal response")
        
        purchase_unit = purchase_units[0]
        payments = purchase_unit.get("payments", {})
        captures = payments.get("captures", [])
        
        if not captures:
            raise HTTPException(status_code=400, detail="No captures found in PayPal response")
        
        capture = captures[0]
        transaction_id = capture.get("id", payment_id)
        amount_data = capture.get("amount", {})
        amount = float(amount_data.get("value", 0))
        
        # Get payer information
        payer = capture_data.get("payer", {})
        payer_name_data = payer.get("name", {})
        payer_name = f"{payer_name_data.get('given_name', '')} {payer_name_data.get('surname', '')}".strip()
        payer_email = payer.get("email_address", "")
        # Get payer information
        payer = capture_data.get("payer", {})
        payer_name_data = payer.get("name", {})
        payer_name = f"{payer_name_data.get('given_name', '')} {payer_name_data.get('surname', '')}".strip()
        payer_email = payer.get("email_address", "")
        
        # Try to get Firebase user information if available
        user_uid = None
        user_email = payer_email
        user_name = payer_name
        
        try:
            # Check if user is authenticated via request state
            if hasattr(request, 'state') and hasattr(request.state, 'uid'):
                user_uid = request.state.uid
                print(f"🔍 Found authenticated user UID: {user_uid}")
                
                # Get additional user info from Firebase if needed
                from helpers.Firebase_helpers import get_user_info_by_uid
                user_info = await get_user_info_by_uid(user_uid)
                if user_info:
                    # Use Firebase user info if available, fallback to PayPal info
                    user_email = user_info.get('email') or payer_email
                    user_name = user_info.get('displayName') or user_info.get('name') or payer_name
                    print(f"🔍 Using Firebase user info - email: {user_email}, name: {user_name}")
            
            # If no authenticated user but we have payer email, try to find Firebase user by email
            elif payer_email:
                from helpers.Firebase_helpers import get_uid_by_email
                try:
                    found_uid = await get_uid_by_email(payer_email)
                    if found_uid:
                        user_uid = found_uid
                        print(f"🔍 Found Firebase user by email: {user_uid}")
                except Exception as e:
                    print(f"🔍 Could not find Firebase user by email: {e}")
                    
        except Exception as e:
            print(f"⚠️ Error getting Firebase user info: {e}")
            # Continue with PayPal info if Firebase lookup fails
        
        # Ensure we have required values
        final_email = user_email or payer_email or "anonymous@example.com"
        final_name = user_name or payer_name or "Anonymous"
        
        print(f"🔍 Final user info - UID: {user_uid}, Email: {final_email}, Name: {final_name}")
        
        # Check if this transaction already exists to prevent duplicates
        try:
            existing_transaction = await Transaction.get_transaction_by_id(transaction_id)
            if existing_transaction:
                print(f"✅ Transaction {transaction_id} already exists, returning existing data")
                return {
                    "success": True,
                    "message": "Payment already completed",
                    "transaction_id": transaction_id,
                    "amount": existing_transaction.amount,
                    "form_id": form.id,
                    "form_slug": slug
                }
        except Exception as e:
            print(f"🔍 No existing transaction found (which is expected): {e}")
        
        # Create transaction record
        transaction = Transaction(
            transaction_id=transaction_id,  # Required field
            user_email=final_email,  # Required field  
            type="one-time",  # Required field
            id=transaction_id,  # Optional but useful for lookups
            form_id=form.id,
            form_slug=slug,
            amount=amount,
            payment_method="paypal",
            status="completed",
            name=final_name,
            order_id=payment_id,
            payment_type="form_submission",
            user_uid=user_uid,  # Link to Firebase user if available
            created_on=datetime.utcnow().isoformat(),
            time=datetime.utcnow().isoformat(),
            metadata={
                "paypal_payer_id": payer_id,
                "paypal_order_id": payment_id,
                "firebase_uid": user_uid,
                "payer_paypal_email": payer_email,
                "payer_paypal_name": payer_name
            }
        )
        
        # Save the transaction with duplicate handling
        try:
            saved_transaction = await Transaction.create_transaction(transaction)
            
            if not saved_transaction:
                raise HTTPException(status_code=500, detail="Failed to save transaction record")
                
        except Exception as e:
            # Check if this is a duplicate key error
            if "dup key" in str(e) or "duplicate" in str(e).lower():
                print(f"🔍 Duplicate transaction detected, checking existing record")
                try:
                    existing_transaction = await Transaction.get_transaction_by_id(transaction_id)
                    if existing_transaction:
                        print(f"✅ Using existing transaction record")
                        return {
                            "success": True,
                            "message": "Payment already completed",
                            "transaction_id": transaction_id,
                            "amount": existing_transaction.amount,
                            "form_id": form.id,
                            "form_slug": slug
                        }
                except:
                    pass
            
            # If it's not a duplicate error or we couldn't find existing transaction, re-raise
            print(f"❌ Failed to save transaction: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save transaction record: {str(e)}")
        
        print(f"✅ PayPal payment captured and transaction saved: {transaction_id}")
        
        return {
            "success": True,
            "message": "Payment completed successfully",
            "transaction_id": transaction_id,
            "amount": amount,
            "form_id": form.id,
            "form_slug": slug
        }
        
    except HTTPException as he:
        raise
    except Exception as e:
        print(f"❌ Error completing PayPal payment: {str(e)}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to complete PayPal payment: {str(e)}")

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