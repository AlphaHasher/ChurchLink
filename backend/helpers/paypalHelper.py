# TODO: UNCOMMENTING AND DEALING WITH THIS

'''import os
import paypalrestsdk
import datetime
import requests
from models.donation_subscription import DonationSubscription
from models.transaction import Transaction
from mongo.database import DB
from fastapi.responses import JSONResponse
from fastapi import Query, Request, HTTPException
import re
import traceback
import logging
from helpers.audit_logger import payment_audit_logger, get_client_ip, get_user_agent
from helpers.Firebase_helpers import get_uid_by_email
from models.event import update_attendee_payment_status, get_event_by_id
from mongo.churchuser import UserHandler

# PayPal configuration from environment variables
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox")
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

def get_paypal_base_url():
    """Get PayPal base URL based on mode"""
    if PAYPAL_MODE == "live":
        return "https://api.paypal.com"
    else:
        return "https://api.sandbox.paypal.com"

def get_paypal_access_token():
    """Get PayPal access token for REST API calls"""
    try:
        # Check if credentials are available
        if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
            raise Exception("PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.")
            
        url = f"{get_paypal_base_url()}/v1/oauth2/token"
        headers = {
            'Accept': 'application/json',
            'Accept-Language': 'en_US',
        }
        data = 'grant_type=client_credentials'
        
        response = requests.post(
            url,
            headers=headers,
            data=data,
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
        )
        
        if response.status_code == 200:
            return response.json().get('access_token')
        else:
            return None
    except Exception as e:
        return None

def configure_paypal():
    """Configure PayPal SDK with credentials"""
    if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
        raise Exception("PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.")
    
    paypalrestsdk.configure({
        "mode": PAYPAL_MODE,  # sandbox or live
        "client_id": PAYPAL_CLIENT_ID,
        "client_secret": PAYPAL_CLIENT_SECRET
    })

async def validate_and_extract_donation(donation):
    # Get settings from database
    paypal_settings = await DB.get_paypal_settings() or {}
    allowed_funds = paypal_settings.get("ALLOWED_FUNDS") or ["General", "Building", "Missions", "Youth", "Other"]
    
    errors = []
    fund_name = donation.get("fund_name")
    amount = donation.get("amount")
    message = donation.get("message", "")
    interval_unit = donation.get("interval_unit")
    interval_count = donation.get("interval_count")
    cycles = donation.get("cycles")
    cancel_url = donation.get("cancel_url", f"{FRONTEND_URL}/donation/cancel")
    return_url = donation.get("return_url", f"{FRONTEND_URL}/donation/success")
    start_date = donation.get("start_date")
    first_name = donation.get("first_name", "").strip()
    last_name = donation.get("last_name", "").strip()
    
    # Validate required fields
    if not fund_name or not amount:
        errors.append("fund_name and amount are required.")
    
    if fund_name not in allowed_funds:
        errors.append(f"fund_name must be one of: {', '.join(allowed_funds)}.")
    
    # Validate cycles
    try:
        cycles = int(cycles) if cycles and int(cycles) > 0 else 9999
    except (TypeError, ValueError):
        cycles = 9999
    
    # Validate amount
    try:
        amount = float(amount)
        if amount <= 0 or amount > 10000:
            errors.append("Amount must be greater than zero and less than or equal to $10,000.")
    except (TypeError, ValueError):
        errors.append("Amount must be a number.")
    
    # Validate interval information
    if interval_unit and interval_count:
        valid_units = ["DAY", "WEEK", "MONTH", "YEAR"]
        if interval_unit not in valid_units:
            errors.append(f"interval_unit must be one of: {', '.join(valid_units)}.")
        try:
            interval_count = int(interval_count)
            if interval_count <= 0:
                errors.append("interval_count must be a positive integer.")
        except (TypeError, ValueError):
            errors.append("interval_count must be a valid integer.")
    elif interval_unit or interval_count:
        errors.append("Both interval_unit and interval_count are required for subscriptions.")
    
    # Validate URLs
    url_regex = re.compile(r"^(https?://)([a-zA-Z0-9\-._]+|localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(/.*)?$", re.IGNORECASE)
    if not url_regex.match(cancel_url):
        errors.append("cancel_url must be a valid URL.")
    if not url_regex.match(return_url):
        errors.append("return_url must be a valid URL.")
    
    return {
        "fund_name": fund_name,
        "amount": amount,
        "message": message,
        "interval_unit": interval_unit,
        "interval_count": interval_count,
        "cycles": cycles,
        "cancel_url": cancel_url,
        "return_url": return_url,
        "start_date": start_date,
        "first_name": first_name,
        "last_name": last_name,
        "errors": errors
    }

async def create_order_from_data(order_data: dict):
    """Create PayPal order from dictionary data using PayPal v2 API structure"""
    try:
        logging.info("🔍 PayPal create_order_from_data called")

        # Configure PayPal SDK first
        logging.info("🔍 Configuring PayPal SDK")
        configure_paypal()
        logging.info("✅ PayPal SDK configured successfully")

        logging.info(f"🔍 Order data: {order_data}")

        if not order_data or not isinstance(order_data, dict):
            logging.error("❌ Missing or invalid order data")
            return {"error": "Missing or invalid order data.", "status_code": 400}

        # Extract total amount from purchase units for validation
        purchase_units = order_data.get("purchase_units", [])
        if not purchase_units:
            logging.error("❌ No purchase units found")
            return {"error": "No purchase units found in order data.", "status_code": 400}
        
        total_amount = float(purchase_units[0].get("amount", {}).get("value", 0))
        if total_amount <= 0:
            logging.error("❌ Invalid total amount")
            return {"error": "Total amount must be positive.", "status_code": 400}

        logging.info(f"🔍 Processing total amount: {total_amount}")

        # Create PayPal order using the provided structure
        logging.info("🔍 Creating PayPal order object")



        # Convert v2 structure to v1 Payment structure
        purchase_unit = purchase_units[0]
        items = purchase_unit.get("items", [])
        
        # Convert items to v1 format
        v1_items = []
        for item in items:
            v1_items.append({
                "name": item.get("name", "Event Registration"),
                "sku": "event",
                "price": item.get("unit_amount", {}).get("value", "0.00"),
                "currency": item.get("unit_amount", {}).get("currency_code", "USD"),
                "quantity": int(item.get("quantity", 1))
            })
        
        # Get redirect URLs from application_context
        app_context = order_data.get("application_context", {})
        return_url = app_context.get("return_url", f"{FRONTEND_URL}/payment/success")
        cancel_url = app_context.get("cancel_url", f"{FRONTEND_URL}/payment/cancel")
        
        # Create v1 Payment object
        payment = paypalrestsdk.Payment({
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "transactions": [{
                "amount": {
                    "total": purchase_unit.get("amount", {}).get("value", "0.00"),
                    "currency": purchase_unit.get("amount", {}).get("currency_code", "USD")
                },
                "description": purchase_unit.get("description", "Event registration payment"),
                "item_list": {
                    "items": v1_items
                }
            }],
            "redirect_urls": {
                "return_url": return_url,
                "cancel_url": cancel_url
            }
        })

        logging.info("🔍 Attempting to create PayPal payment")
        if payment.create():
            logging.info("✅ PayPal payment created successfully")

            # Find approval URL
            approval_url = None
            for link in payment.links:
                if link.rel == "approval_url":
                    approval_url = link.href
                    break

            logging.info(f"✅ Approval URL: {approval_url}")

            # Log successful PayPal order creation
            description = purchase_units[0].get("description", "Event registration")
            payment_audit_logger.log_paypal_order_created(
                user_email=None,  # Will be available during capture
                amount=total_amount,
                fund_name=description,
                payment_method="paypal",
                payment_id=payment.id,
                request_ip=None  # No request object available
            )
            
            return {"approval_url": approval_url, "payment_id": payment.id}
        else:
            logging.error(f"❌ PayPal payment creation failed: {payment.error}")

            # Log PayPal order creation failure
            payment_audit_logger.log_paypal_capture_failed(
                payment_id="unknown",
                error_message=f"PayPal payment creation failed: {payment.error}",
                amount=total_amount,
                request_ip=None
            )
            
            return {"error": "Failed to create PayPal payment.", "details": payment.error, "status_code": 500}
            
    except Exception as e:
        logging.error(f"❌ Exception in create_order_from_data: {str(e)}")
        logging.error(f"❌ Traceback: {traceback.format_exc()}")
        return {"error": str(e), "status_code": 500}

async def capture_payment_by_id(payment_id: str, payer_id: str):
    """Capture PayPal payment and return dictionary result"""
    try:
        logging.info(f"🔍 Capturing PayPal payment {payment_id} with payer {payer_id}")

        if not payment_id or not payer_id:
            return {"error": "Missing payment_id or payer_id.", "status_code": 400}
        
        # Configure PayPal SDK
        configure_paypal()
        
        # Find the payment
        payment = paypalrestsdk.Payment.find(payment_id)
        
        if not payment:
            return {"error": "Payment not found.", "status_code": 404}
        
        # Check payment state and execute if needed
        if payment.state == "approved":
            # Payment already executed
            logging.info("✅ Payment already approved")
            transaction = payment.to_dict()
        elif payment.state == "created":
            # Execute the payment
            logging.info("🔍 Executing payment")
            if payment.execute({"payer_id": payer_id}):
                logging.info("✅ Payment executed successfully")
                transaction = payment.to_dict()
            else:
                logging.error(f"❌ Payment execution failed: {payment.error}")
                return {
                    "error": "Failed to execute payment", 
                    "details": payment.error, 
                    "status_code": 422
                }
        else:
            return {
                "error": f"Payment is in invalid state: {payment.state}", 
                "status_code": 422
            }
        
        # Extract transaction details
        payer_info = transaction.get("payer", {}).get("payer_info", {})
        transactions = transaction.get("transactions", [])
        
        if not transactions:
            return {"error": "No transaction data found", "status_code": 422}
        
        transaction_data = transactions[0]
        amount_data = transaction_data.get("amount", {})
        
        # Log successful capture using the existing payment_completed method
        payment_audit_logger.log_payment_completed(
            user_uid=None,  # User UID not available in this context
            event_id=None,  # Event ID not available in this context
            payment_id=payment_id,
            amount=float(amount_data.get("total", 0)),
            successful_registrations=1,  # Single payment capture
            failed_registrations=0,
            request_ip=None
        )
        
        return {
            "success": True,
            "payment_id": payment_id,
            "payer_id": payer_id,
            "state": payment.state,
            "amount": amount_data.get("total"),
            "currency": amount_data.get("currency", "USD"),
            "payer_email": payer_info.get("email"),
            "payer_name": f"{payer_info.get('first_name', '')} {payer_info.get('last_name', '')}".strip(),
            "transaction_id": transaction.get("id"),
            "create_time": transaction.get("create_time"),
            "update_time": transaction.get("update_time")
        }
        
    except Exception as e:
        logging.error(f"❌ Exception in capture_payment_by_id: {str(e)}")

        # Log capture failure
        payment_audit_logger.log_paypal_capture_failed(
            payment_id=payment_id,
            error_message=str(e),
            amount=None,
            request_ip=None
        )
        
        return {"error": str(e), "status_code": 500}

async def create_order(request: Request):
    try:
        logging.info("🔍 PayPal create_order called")

        # Configure PayPal SDK first
        logging.info("🔍 Configuring PayPal SDK")
        configure_paypal()
        logging.info("✅ PayPal SDK configured successfully")

        logging.info("🔍 Parsing request JSON")
        request_body = await request.json()
        donation = request_body.get("donation")
        logging.info(f"🔍 Donation data: {donation}")

        if not donation or not isinstance(donation, dict):
            logging.error("❌ Missing or invalid donation object")
            return JSONResponse(status_code=400, content={"error": "Missing or invalid donation object."})

        fund_name = donation.get("fund_name")
        if not fund_name or not isinstance(fund_name, str) or not fund_name.strip():
            logging.error("❌ Invalid fund_name")
            return JSONResponse(status_code=400, content={"error": "fund_name is required and must be a non-empty string."})
        
        amount = donation.get("amount")
        logging.info(f"🔍 Processing amount: {amount}")
        try:
            amount = float(amount)
            if amount <= 0 or not isinstance(amount, float):
                logging.error("❌ Invalid amount (not positive)")
                return JSONResponse(status_code=400, content={"error": "amount must be a positive number."})
        except (TypeError, ValueError):
            logging.error("❌ Invalid amount (not a number)")
            return JSONResponse(status_code=400, content={"error": "amount must be a positive number."})
        
        message = donation.get("message", "")
        
        # Get settings from database; DB may contain ALLOWED_* and plan details.
        logging.info("🔍 Getting PayPal settings from database")
        paypal_settings = await DB.get_paypal_settings() or {}
        church_name = paypal_settings.get("CHURCH_NAME") or "Church"
        logging.info(f"🔍 Church name: {church_name}")

        logging.info("🔍 Creating PayPal payment object")
        payment = paypalrestsdk.Payment({
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "transactions": [
                {
                    "amount": {
                        "total": str(amount),
                        "currency": "USD"
                    },
                    "description": f"Donation to {church_name} - {fund_name} fund. Message: {message}",
                    "item_list": {
                        "items": [
                            {
                                "name": f"Donation: {church_name} - {fund_name} fund",
                                "sku": "donation",
                                "price": str(amount),
                                "currency": "USD",
                                "quantity": 1
                            }
                        ]
                    }
                }
            ],
            "redirect_urls": {
                "cancel_url": donation.get("cancel_url", f"{settings.FRONTEND_URL}/donation/cancel"),
                "return_url": donation.get("return_url", f"{settings.FRONTEND_URL}/donation/success"),
            }
        })

        logging.info("🔍 Attempting to create PayPal payment")
        if payment.create():
            logging.info("✅ PayPal payment created successfully")
            approval_url = next((link.href for link in payment.links if link.rel == "approval_url"), None)
            logging.info(f"✅ Approval URL: {approval_url}")

            # Log successful PayPal order creation
            client_ip = get_client_ip(request) if hasattr(request, 'headers') else None
            payment_audit_logger.log_paypal_order_created(
                user_email=None,  # Will be available during capture
                amount=amount,
                fund_name=fund_name,
                payment_method="paypal",
                payment_id=payment.id,
                request_ip=client_ip
            )
            
            return JSONResponse(content={"approval_url": approval_url, "payment_id": payment.id})
        else:
            logging.error(f"❌ PayPal payment creation failed: {payment.error}")

            # Log PayPal order creation failure
            client_ip = get_client_ip(request) if hasattr(request, 'headers') else None
            payment_audit_logger.log_paypal_capture_failed(
                payment_id="unknown",
                error_message=f"PayPal order creation failed: {payment.error}",
                amount=amount,
                request_ip=client_ip
            )
            
            return JSONResponse(status_code=500, content={"error": "Failed to create PayPal payment.", "details": payment.error})
    except Exception as e:
        logging.error(f"❌ Exception in create_order: {str(e)}")
        logging.error(f"❌ Traceback: {traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


async def capture_order(payment_id: str, payer_id: str = Query(...)):
    try:
        if not payment_id or not payer_id:
            return JSONResponse(status_code=400, content={"error": "Missing payment_id or payer_id."})
            
        # Load PayPal-related settings from DB (do not read env here)
        paypal_settings = await DB.get_paypal_settings() or {}
        church_name_meta = paypal_settings.get('CHURCH_NAME') or 'Church'

        payment = paypalrestsdk.Payment.find(payment_id)
        
        # Check if payment is already executed
        if payment.state == "approved":
            # Payment is already executed, use it as is
            transaction = payment.to_dict()
        elif payment.state == "created":
            # Payment needs to be executed
            if payment.execute({"payer_id": payer_id}):
                transaction = payment.to_dict()
            else:
                return JSONResponse(status_code=422, content={"error": "Failed to execute payment", "details": payment.error})
        else:
            return JSONResponse(status_code=422, content={"error": f"Payment is in invalid state: {payment.state}"})
        
        # Get payer information
        payer_info = transaction.get("payer", {}).get("payer_info", {})
        first_name = payer_info.get("first_name", "")
        last_name = payer_info.get("last_name", "")
        donor_name = f"{first_name} {last_name}".strip()
        user_email = payer_info.get("email", "")
        
        logging.info(f"[PAYPAL_CAPTURE] Extracted payer info - first_name: {first_name}, last_name: {last_name}, donor_name: {donor_name}")
        
        # Get shipping address
        address = {}
        if payer_info.get("shipping_address"):
            address = payer_info.get("shipping_address", {})
        
        # Check transactions for shipping address if not found
        if not address:
            transactions_list = transaction.get("transactions", [])
            for txn in transactions_list:
                item_list = txn.get("item_list", {})
                if item_list.get("shipping_address"):
                    address = item_list.get("shipping_address", {})
                    break
        
        # Parse description for fund name
        description = transaction.get("transactions", [{}])[0].get("description", "")
        fund_name = "General"
        message = ""
        
        if "Donation to" in description and " fund by " in description:
            try:
                church_name_and_fund = description.split("Donation to ")[1].split(" fund by ")[0]
                if " - " in church_name_and_fund:
                    fund_name = church_name_and_fund.split(" - ")[1].strip()
            except:
                fund_name = "General"
        
        if "Message:" in description:
            message = description.split("Message:")[1].strip()
        
        # Ensure donor name
        if not donor_name:
            donor_name = "Anonymous"
        
        # Get amount
        amount_str = transaction.get("transactions", [{}])[0].get("amount", {}).get("total", "0")
        try:
            amount = float(amount_str)
        except ValueError:
            amount = 0.0
        
        # Create transaction data
        transaction_data = {
            "transaction_id": payment_id,
            "user_email": user_email,
            "amount": amount,
            "status": transaction.get("state", "completed"),
            "time": transaction.get("create_time", ""),
            "payment_method": "paypal",
            "type": "one-time",
            "order_id": payment_id,
            "currency": transaction.get("transactions", [{}])[0].get("amount", {}).get("currency", "USD"),
            "name": donor_name.strip() if donor_name.strip() else "Anonymous",
            "note": message,
            "created_on": datetime.datetime.utcnow().isoformat(),
            "fund_name": fund_name,
        }
        
        # Check if this is an event payment by examining the description
        description = transaction.get("transactions", [{}])[0].get("description", "")
        logging.info(f"[PAYPAL_CAPTURE] Checking payment description: {description}")
        logging.info(f"[PAYPAL_CAPTURE] Fund name: {fund_name}")

        if "Event registration" in description or "Event:" in description or fund_name.startswith("Event:"):
            # Extract event information from fund_name or description
            transaction_data["payment_type"] = "event_registration"
            logging.info(f"[PAYPAL_CAPTURE] Detected event payment")

            # Extract event ID and user UID from description (works for both fund_name and description)
            event_id_match = re.search(r'Event ID:\s*([a-fA-F0-9]{24})', description)
            user_uid_match = re.search(r'User:\s*([a-zA-Z0-9]+)', description)
            
            if event_id_match:
                event_id = event_id_match.group(1)
                transaction_data["event_id"] = event_id
                logging.info(f"[PAYPAL_CAPTURE] Extracted Event ID: {event_id}")

                if user_uid_match:
                    user_uid = user_uid_match.group(1)
                    transaction_data["user_uid"] = user_uid
                    logging.info(f"[PAYPAL_CAPTURE] Extracted User UID: {user_uid}")
                else:
                    logging.info(f"[PAYPAL_CAPTURE] No User UID found in description, trying email lookup")
                    # Fallback: try to get UID from email
                    if user_email:
                        try:
                            user_uid = await get_uid_by_email(user_email)
                            if user_uid:
                                transaction_data["user_uid"] = user_uid
                                logging.info(f"[PAYPAL_CAPTURE] Got user UID from email - User: {user_uid}")
                        except Exception as e:
                            logging.error(f"[PAYPAL_CAPTURE] Failed to get UID from email: {str(e)}")
            else:
                logging.info(f"[PAYPAL_CAPTURE] No Event ID found in description")

            # Extract event name if available
            if fund_name.startswith("Event:"):
                event_name = fund_name.replace("Event:", "").strip()
                transaction_data["event_name"] = event_name
            else:
                transaction_data["payment_type"] = "donation"
            
            # Add metadata
            transaction_data["metadata"] = {
                "payer_name": donor_name,
                "fund_name": fund_name,
                "shipping_address": address,
                "payer_id": payer_id,
                "shipping_line_1": address.get("line1", ""),
                "shipping_line_2": address.get("line2", ""),
                "shipping_city": address.get("city", ""),
                "shipping_state": address.get("state", ""),
                "shipping_postal_code": address.get("postal_code", ""),
                "shipping_country_code": address.get("country_code", "")
            }
            
            # Create transaction in database - but check if it already exists first
            existing_tx = await Transaction.get_transaction_by_id(payment_id)
            
            if existing_tx:
                # Transaction already exists, return the existing data
                logging.info(f"[PAYPAL_CAPTURE] Transaction {payment_id} already exists, returning existing data")

                # Log duplicate transaction attempt
                payment_audit_logger.log_donation_completed(
                    user_email=user_email,
                    amount=amount,
                    fund_name=fund_name,
                    payment_id=payment_id,
                    donor_name=donor_name.strip() if donor_name.strip() else "Anonymous",
                    transaction_type="one-time"
                )
                
                return JSONResponse(content={
                    "status": "success", 
                    "transaction_id": payment_id,
                    "amount": amount,
                    "fund_name": fund_name,
                    "user_email": user_email,
                    "payer_name": donor_name.strip() if donor_name.strip() else "Anonymous"
                })
            else:
                # Create new transaction
                tx = await Transaction.create_transaction(Transaction(**transaction_data))
                
                if tx:
                    # Log successful donation completion
                    payment_audit_logger.log_donation_completed(
                        user_email=user_email,
                        amount=amount,
                        fund_name=fund_name,
                        payment_id=payment_id,
                        donor_name=donor_name.strip() if donor_name.strip() else "Anonymous",
                        transaction_type="one-time"
                    )
                    
                    # Check for large transaction
                    payment_audit_logger.log_large_transaction(
                        user_identifier=user_email,
                        amount=amount,
                        transaction_type="donation",
                        payment_method="paypal",
                        threshold=1000.0
                    )
                    
                    # If this is an event payment, update the registration status to "completed"
                    if transaction_data.get("payment_type") == "event_registration":
                        event_id = transaction_data.get("event_id")
                        user_uid = transaction_data.get("user_uid")

                        logging.info(f"[PAYPAL_CAPTURE] Event payment status update - Event ID: {event_id}, User UID: {user_uid}")

                        if event_id and user_uid:
                            try:
                                logging.info(f"[PAYPAL_CAPTURE] Updating event registration status - Event: {event_id}, User: {user_uid}")

                                # Get the user's registrations for this event
                                user_data = await UserHandler.find_by_uid(user_uid)
                                logging.info(f"[PAYPAL_CAPTURE] Found user data: {user_data is not None}")

                                if user_data and "events" in user_data:
                                    event_registrations = user_data["events"].get(event_id, {})
                                    logging.info(f"[PAYPAL_CAPTURE] Found {len(event_registrations)} registrations for event {event_id}")
                                    updated_count = 0
                                    
                                    # Update all registrations that are awaiting payment
                                    for attendee_key, registration in event_registrations.items():
                                        current_status = registration.get("payment_status", "unknown")
                                        logging.info(f"[PAYPAL_CAPTURE] Registration {attendee_key} has status: {current_status}")

                                        if registration.get("payment_status") in ["awaiting_payment", None, ""]:
                                            logging.info(f"[PAYPAL_CAPTURE] Updating registration: {attendee_key}")
                                            success = await update_attendee_payment_status(
                                                event_id=event_id,
                                                attendee_key=attendee_key,
                                                payment_status="completed",
                                                transaction_id=payment_id
                                            )
                                            logging.info(f"[PAYPAL_CAPTURE] Update result for {attendee_key}: {success}")
                                            if success:
                                                updated_count += 1

                                    logging.info(f"[PAYPAL_CAPTURE] Successfully updated {updated_count} registrations to 'completed'")
                                else:
                                    logging.info(f"[PAYPAL_CAPTURE] No user data or events found for user {user_uid}")

                            except Exception as e:
                                logging.error(f"[PAYPAL_CAPTURE] Error updating registration payment status: {str(e)}")
                                # Don't fail the entire payment capture if this fails
                                pass
                    
                    return JSONResponse(content={
                        "status": "success", 
                        "transaction_id": payment_id,
                        "amount": amount,
                        "fund_name": fund_name,
                        "user_email": user_email,
                        "payer_name": donor_name.strip() if donor_name.strip() else "Anonymous"
                    })
                else:
                    # Log transaction creation failure
                    payment_audit_logger.log_paypal_capture_failed(
                        payment_id=payment_id,
                        error_message="Payment processed but failed to save transaction",
                        user_email=user_email,
                        amount=amount
                    )
                    
                    return JSONResponse(
                        status_code=500, 
                        content={"status": "error", "message": "Payment processed but failed to save transaction"}
                )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

async def update_transaction_status_api(transaction_id: str, status: str, reason: str = None):
    """
    Update the status of a transaction
    
    Args:
        transaction_id: ID of the transaction to update
        status: New status value (completed, refunded, cancelled, failed, etc.)
        reason: Optional reason for the status change
        
    Returns:
        JSONResponse with success or error message
    """
    # Validate status
    valid_statuses = ['completed', 'refunded', 'cancelled', 'failed', 'pending', 'processing']
    if status not in valid_statuses:
        return JSONResponse(
            status_code=400,
            content={"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}
        )
    
    try:
        # First get the transaction to check if it exists
        tx = await Transaction.get_transaction_by_id(transaction_id)
        if not tx:
            return JSONResponse(status_code=404, content={"error": "Transaction not found"})
        
        # Update transaction status
        result = await Transaction.update_transaction_status(transaction_id, status)
        
        if result:
            # If reason provided, store it in transaction note
            if reason:
                await DB.update_document(
                    "transactions", 
                    {"transaction_id": transaction_id}, 
                    {"note": f"Status changed to {status}: {reason}"}
                )
            
            # Get updated transaction
            updated_tx = await Transaction.get_transaction_by_id(transaction_id)
            
            # Format response
            if updated_tx:
                return JSONResponse(
                    content={
                        "success": True, 
                        "transaction_id": transaction_id, 
                        "status": status,
                        "previous_status": tx.status,
                        "updated_at": datetime.datetime.utcnow().isoformat()
                    }
                )
            
        return JSONResponse(
            status_code=500, 
            content={"error": "Failed to update transaction status"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"error": "Failed to update transaction status", "details": str(e)}
        )


async def list_all_transactions(skip: int = 0, limit: int = 20, fund_name: str = None, status: str = None):
    """
    Get all transactions with pagination and filtering options
    
    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return
        fund_name: Optional filter by fund name
        status: Optional filter by transaction status
        
    Returns:
        Dictionary with transactions array and total count
    """
    try:
        # Build query
        query = {}
        if fund_name:
            query["fund_name"] = fund_name
        if status:
            query["status"] = status
            
        # Get total count for pagination info
        total_count = await DB.db["transactions"].count_documents(query)
        
        # Get transactions with pagination - use multiple sort fields as fallback
        sort_options = [("created_on", -1), ("time", -1), ("_id", -1)]
        tx_docs = await DB.db["transactions"].find(query).sort(sort_options).skip(skip).limit(limit).to_list(length=limit)
        
        result = []
        for tx in tx_docs:
            tx["id"] = str(tx.pop("_id"))
            # Convert datetime objects to ISO strings for multiple possible date fields
            for date_field in ["created_on", "time", "start_time", "next_billing_time"]:
                if date_field in tx and hasattr(tx[date_field], "isoformat"):
                    tx[date_field] = tx[date_field].isoformat()
            result.append(tx)
        
        return {
            "transactions": result,
            "pagination": {
                "total": total_count,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transactions: {str(e)}") 

async def get_transaction_by_id(transaction_id: str):
    """
    Get a transaction by ID
    
    Args:
        transaction_id: The ID of the transaction to retrieve
        
    Returns:
        Dictionary with transaction details or error response
    """
    try:
        if not transaction_id or not isinstance(transaction_id, str):
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid transaction ID"}
            )
            
        tx = await Transaction.get_transaction_by_id(transaction_id)
        if tx:
            # Ensure created_on is a string
            if hasattr(tx, "created_on") and hasattr(tx.created_on, "isoformat"):
                tx.created_on = tx.created_on.isoformat()
                
            # Add payment method details based on transaction type
            payment_details = {}
            if tx.payment_method == "paypal":
                if tx.type == "one-time":
                    payment_details["payment_type"] = "One-time donation"
                    payment_details["order_id"] = tx.order_id
                elif tx.type == "subscription":
                    payment_details["payment_type"] = "Recurring donation"
                    payment_details["subscription_id"] = tx.subscription_id
                    payment_details["plan_id"] = tx.plan_id
                
            return {
                "transaction": tx.model_dump(),
                "payment_details": payment_details
            }
        
        return JSONResponse(
            status_code=404, 
            content={"error": "Transaction not found", "transaction_id": transaction_id}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Error retrieving transaction", "details": str(e)}
        )

async def create_subscription_helper(request):
    try:
        request_body = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Invalid request body: {str(e)}"})

    donation = request_body.get("donation")
    if not donation or not isinstance(donation, dict):
        return JSONResponse(status_code=400, content={"error": "Missing or invalid donation object."})

    donor_id = request_body.get("donor_id") or donation.get("donor_id") or None
    # Try to get user_id from request.state.user if available
    user_id = None
    try:
        user = getattr(request.state, "user", None)
        if user and hasattr(user, "id"):
            user_id = str(user.id)
        elif user and isinstance(user, dict) and "id" in user:
            user_id = str(user["id"])
    except Exception:
        user_id = None
    
    custom_id = request_body.get("custom_id") or donation.get("custom_id") or None
    church_account_id = request_body.get("church_account_id") or donation.get("church_account_id") or None
    consent_flag = request_body.get("consent") or donation.get("consent") or False
    approval_timestamp = request_body.get("approval_timestamp") or donation.get("approval_timestamp") or datetime.datetime.utcnow().isoformat()
    ip_address = request.client.host if hasattr(request, "client") and request.client else None
    user_agent = request.headers.get("user-agent")
    redirect_token = request_body.get("redirect_token") or donation.get("redirect_token") or None
    used_return_url = donation.get("return_url")
    used_cancel_url = donation.get("cancel_url")


    data = await validate_and_extract_donation(donation)
    if data["errors"]:
        return JSONResponse(status_code=400, content={"error": data["errors"]})

    fund_name = data["fund_name"]
    amount = data["amount"]
    message = data["message"]
    interval_unit = data["interval_unit"]
    interval_count = data["interval_count"]
    cycles = data["cycles"]
    cancel_url = data["cancel_url"]
    return_url = data["return_url"]
    start_date = data["start_date"]
    first_name = data["first_name"]
    last_name = data["last_name"]

    # Validate that interval information is provided for subscriptions
    if not interval_unit or not interval_count:
        return JSONResponse(status_code=400, content={"error": "interval_unit and interval_count are required for subscriptions."})

    # Convert interval system to PayPal format
    paypal_interval_map = {
        "DAY": "Day",
        "WEEK": "Week", 
        "MONTH": "Month",
        "YEAR": "Year"
    }
    interval = paypal_interval_map.get(interval_unit, "Month")
    frequency = str(interval_count)
    
    # Create description for recurrence
    if interval_count == 1:
        if interval_unit == "DAY":
            recurrence_description = "daily"
        elif interval_unit == "WEEK":
            recurrence_description = "weekly"
        elif interval_unit == "MONTH":
            recurrence_description = "monthly"
        elif interval_unit == "YEAR":
            recurrence_description = "annually"
    else:
        unit_name = interval_unit.lower() + ("s" if interval_count > 1 else "")
        recurrence_description = f"every {interval_count} {unit_name}"

    # Use DB-stored plan name/description when available, otherwise fall back to env
    db_settings = await DB.get_paypal_settings() or {}
    plan_name = db_settings.get('PAYPAL_PLAN_NAME') or 'Church Donation Subscription'
    plan_description_base = db_settings.get('PAYPAL_PLAN_DESCRIPTION') or 'Recurring donation to'
    church_name_for_description = db_settings.get('CHURCH_NAME') or 'Church'

    # Create billing plan using available SDK
    billing_plan = paypalrestsdk.BillingPlan({
        "name": f"{plan_name} - {fund_name} fund",
        "description": f"{plan_description_base} {church_name_for_description} - {fund_name} fund" + (f". Message: {message}" if message else ""),
        "type": "INFINITE" if cycles == 9999 else "FIXED",
        "payment_definitions": [{
            "name": f"Regular payment for {fund_name} fund",
            "type": "REGULAR",
            "frequency_interval": str(interval_count),
            "frequency": interval_unit.upper(),
            "cycles": str(cycles) if cycles != 9999 else "0",
            "amount": {
                "currency": "USD",
                "value": str(amount)
            }
        }],
        "merchant_preferences": {
            "setup_fee": {
                "currency": "USD",
                "value": "0"
            },
            "return_url": return_url,
            "cancel_url": cancel_url,
            "auto_bill_amount": "YES",
            "initial_fail_amount_action": "CONTINUE",
            "max_fail_attempts": "3"
        }
    })

    if not billing_plan.create():
        return JSONResponse(status_code=500, content={"error": "Failed to create PayPal billing plan.", "details": billing_plan.error})

    # Activate the plan
    try:
        # Check if the plan has an update method
        if hasattr(billing_plan, 'update') and callable(getattr(billing_plan, 'update')):
            update_result = billing_plan.update([{
                "op": "replace",
                "path": "/",
                "value": {
                    "state": "ACTIVE"
                }
            }])
            if not update_result:
                pass  # Plan update returned False, but continuing
        else:
            # Fallback: try to activate using direct API call
            
            # Get access token
            access_token = get_paypal_access_token()
            if not access_token:
                return JSONResponse(status_code=500, content={"error": "Failed to get PayPal access token"})
            
            # Activate plan via REST API
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {access_token}',
            }
            
            patch_data = [{
                "op": "replace",
                "path": "/",
                "value": {
                    "state": "ACTIVE"
                }
            }]
            
            response = requests.patch(
                f"{get_paypal_base_url()}/v1/payments/billing-plans/{billing_plan.id}",
                json=patch_data,
                headers=headers
            )
            
            if response.status_code not in [200, 204]:
                return JSONResponse(status_code=500, content={"error": "Failed to activate PayPal plan", "details": response.text})
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Failed to activate PayPal plan", "details": str(e)})

    now = datetime.datetime.utcnow()
    safe_date = None
    
    try:
        if start_date:
            # Parse the input date
            input_date = datetime.datetime.fromisoformat(start_date.replace("Z", ""))
            
            # Always use the provided start date if it's valid, regardless of whether it's in the future
            # PayPal allows past dates for billing agreements
            safe_date = input_date
        else:
            # Only use fallback if no start_date provided
            safe_date = now + datetime.timedelta(minutes=10)
    except Exception as e:
        # Use provided date string as-is if possible, otherwise fallback
        if start_date:
            # Try to create a valid date from the provided string
            try:
                # Handle different date formats
                if 'T' in start_date:
                    safe_date = datetime.datetime.fromisoformat(start_date.replace("Z", ""))
                else:
                    # Assume date-only format, add time
                    safe_date = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            except:
                safe_date = now + datetime.timedelta(minutes=10)
        else:
            safe_date = now + datetime.timedelta(minutes=10)
    
    start_date_iso = safe_date.replace(microsecond=0).isoformat() + "Z"

    agreement = paypalrestsdk.BillingAgreement({
        "name": f"{plan_name} - {fund_name} fund",
        "description": f"{plan_description_base} {church_name_for_description} - {fund_name} fund" + (f". Message: {message}" if message else ""),
        "start_date": start_date_iso,
        "plan": {"id": billing_plan.id},
        "payer": {"payment_method": "paypal"},
    })
    
    
    if not agreement.create():
        return JSONResponse(status_code=500, content={"error": "Failed to create billing agreement.", "details": agreement.error})

    approval_url = next((link.href for link in agreement.links if link.rel == "approval_url"), None)
    agreement_dict = agreement.to_dict()
    
    # Log the start_date that PayPal returned
    returned_start_date = agreement_dict.get("start_date")
    
    subscription_id = agreement_dict.get("plan", {}).get("id")
    status_val = agreement_dict.get("state", "pending")

    # Create standardized subscription record
    subscription_data = {
        "user_email": "Anonymous",  # Will be updated from PayPal when subscription is executed
        "amount": amount,
        "status": status_val,
        "time": agreement_dict.get("start_date", ""),
        "payment_method": "paypal",
        "type": "subscription",
        "subscription_id": subscription_id,
        "plan_id": billing_plan.id,
        "start_time": agreement_dict.get("start_date", ""),
        "next_billing_time": None,
        "name": f"{first_name} {last_name}".strip() if first_name or last_name else "Anonymous",
        "currency": "USD",
        "note": message,
        "created_on": datetime.datetime.utcnow().isoformat(),
        "recurrence": recurrence_description,
        "cycles": cycles,
        "start_date": start_date_iso,
        "donor_id": donor_id,
        "custom_id": custom_id,
        "church_account_id": church_account_id,
        "consent_flag": consent_flag,
        "approval_timestamp": approval_timestamp,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "redirect_token": redirect_token,
        "used_return_url": used_return_url,
        "used_cancel_url": used_cancel_url,
        "fund_name": fund_name,
        # Add detailed metadata for reporting
        "metadata": {
            "fund_name": fund_name,
            "church_name": db_settings.get('CHURCH_NAME') or 'Church',
            "payment_type": "subscription",
            "recurrence_details": f"{recurrence_description} ({frequency} {interval}(s))",
            "interval_unit": interval_unit,
            "interval_count": interval_count
        }
    }
    
    donation_sub = DonationSubscription(**subscription_data)
    await DonationSubscription.create_donation_subscription(donation_sub)
    
    
    transaction_data = {
        "transaction_id": f"sub_{subscription_id}",
        "user_email": "Anonymous",  # Will be updated from PayPal when subscription is executed
        "amount": amount,
        "status": "pending",  # Will be updated upon execution
        "time": agreement_dict.get("start_date", ""),
        "payment_method": "paypal",
        "type": "subscription",
        "subscription_id": subscription_id,
        "plan_id": billing_plan.id,
        "currency": "USD",
        "name": f"{first_name} {last_name}".strip() if first_name or last_name else "Anonymous",  # Use manually entered name
        "note": message,
        "created_on": datetime.datetime.utcnow().isoformat(),
        "fund_name": fund_name,  # Add fund_name as a top-level field
        "metadata": {
            "fund_name": fund_name,
            "church_name": db_settings.get('CHURCH_NAME') or 'Church',
            "recurrence": recurrence_description,
            "cycles": cycles,
            "recurrence_details": f"{recurrence_description} ({frequency} {interval}(s))",
            "interval_unit": interval_unit,
            "interval_count": interval_count
        }
    }
    
    await Transaction.create_transaction(Transaction(**transaction_data))
    return JSONResponse(content={"approval_url": approval_url, "agreement": agreement_dict})

async def create_subscription_helper_with_user(donation_data):
    """Create subscription with user information from PayPal Login"""
    try:
        
        # Extract user information if provided
        user_info = donation_data.get("user_info", {})
        
        # Extract donation information
        donation = donation_data.get("donation") if "donation" in donation_data else donation_data
        
        # Validate and extract donation data (reuse existing validation)
        data = await validate_and_extract_donation(donation)
        if data["errors"]:
            return JSONResponse(status_code=400, content={"error": data["errors"]})

        fund_name = data["fund_name"]
        amount = data["amount"]
        message = data["message"]
        interval_unit = data["interval_unit"]
        interval_count = data["interval_count"]
        cycles = data["cycles"]
        cancel_url = data["cancel_url"]
        return_url = data["return_url"]
        start_date = data["start_date"]

        # Validate interval information
        if not interval_unit or not interval_count:
            return JSONResponse(status_code=400, content={"error": "interval_unit and interval_count are required for subscriptions."})

        # Convert interval system to PayPal format
        paypal_interval_map = {
            "DAY": "Day",
            "WEEK": "Week", 
            "MONTH": "Month",
            "YEAR": "Year"
        }
        interval = paypal_interval_map.get(interval_unit, "Month")
        frequency = str(interval_count)
        
        # Create description for recurrence
        if interval_count == 1:
            if interval_unit == "DAY":
                recurrence_description = "Daily"
            elif interval_unit == "WEEK":
                recurrence_description = "Weekly"
            elif interval_unit == "MONTH":
                recurrence_description = "Monthly"
            elif interval_unit == "YEAR":
                recurrence_description = "Yearly"
            else:
                recurrence_description = f"Every {interval}"
        else:
            recurrence_description = f"Every {interval_count} {interval}s"

        # Get database settings for church name
        db_settings = await DB.get_paypal_settings() or {}
        church_name = db_settings.get('CHURCH_NAME', 'Church')
        
        # Create billing plan
        billing_plan = paypalrestsdk.BillingPlan({
            "name": f"{fund_name} - {recurrence_description}",
            "description": f"Recurring donation to {church_name} - {fund_name}",
            "type": "INFINITE",
            "payment_definitions": [{
                "name": "Regular payment",
                "type": "REGULAR",
                "frequency": interval,
                "frequency_interval": frequency,
                "amount": {
                    "value": str(amount),
                    "currency": "USD"
                },
                "cycles": str(cycles),
                "charge_models": []
            }],
            "merchant_preferences": {
                "auto_bill_amount": "YES",
                "cancel_url": cancel_url,
                "initial_fail_amount_action": "CONTINUE",
                "max_fail_attempts": "3",
                "return_url": return_url,
                "setup_fee": {
                    "value": "0",
                    "currency": "USD"
                }
            }
        })

        if billing_plan.create():
            # Activate the billing plan
            patch = [{"op": "replace", "path": "/", "value": {"state": "ACTIVE"}}]
            if billing_plan.replace(patch):
                
                # Create billing agreement
                billing_agreement = paypalrestsdk.BillingAgreement({
                    "name": f"Recurring donation to {church_name} - {fund_name}",
                    "description": f"Recurring donation to {church_name} - {fund_name}",
                    "start_date": start_date,
                    "plan": {"id": billing_plan.id},
                    "payer": {"payment_method": "paypal"}
                })

                if billing_agreement.create():
                    approval_url = None
                    for link in billing_agreement.links:
                        if link.rel == "approval_url":
                            approval_url = link.href
                            break

                    if approval_url:
                        agreement_dict = billing_agreement.to_dict()
                        
                        # If user info is provided, store it for later use during execution
                        if user_info:
                            # Store user info in the transaction data for later use
                            agreement_dict["stored_user_info"] = {
                                "given_name": user_info.get("given_name"),
                                "family_name": user_info.get("family_name"),
                                "email": user_info.get("email"),
                                "user_id": user_info.get("user_id")
                            }
                        
                        # Store transaction in database
                        transaction_data = {
                            "id": billing_agreement.id,
                            "status": "pending_approval",
                            "amount": amount,
                            "currency": "USD",
                            "fund_name": fund_name,
                            "message": message,
                            "transaction_type": "subscription",
                            "church_account_id": donation.get("church_account_id"),
                            "user_id": donation.get("user_id"),
                            "custom_id": donation.get("custom_id"),
                            "consent": donation.get("consent", False),
                            "ip_address": donation.get("ip_address"),
                            "user_agent": donation.get("user_agent"),
                            "approval_timestamp": datetime.datetime.utcnow().isoformat(),
                            "redirect_token": donation.get("redirect_token"),
                            "return_url": return_url,
                            "cancel_url": cancel_url,
                            "interval_unit": interval_unit,
                            "interval_count": interval_count,
                            "cycles": cycles,
                            "start_date": start_date,
                            "paypal_data": {
                                "billing_plan_id": billing_plan.id,
                                "billing_agreement_id": billing_agreement.id,
                                "approval_url": approval_url,
                                "church_name": church_name,
                                "recurrence": recurrence_description,
                                "cycles": cycles,
                                "recurrence_details": f"{recurrence_description} ({frequency} {interval}(s))",
                                "interval_unit": interval_unit,
                                "interval_count": interval_count,
                                "user_info": user_info if user_info else None  # Store user info
                            }
                        }
                        
                        await Transaction.create_transaction(Transaction(**transaction_data))
                        return JSONResponse(content={"approval_url": approval_url, "agreement": agreement_dict})
                    else:
                        return JSONResponse(status_code=500, content={"error": "No approval URL found"})
                else:
                    return JSONResponse(status_code=500, content={"error": "Failed to create billing agreement"})
            else:
                return JSONResponse(status_code=500, content={"error": "Failed to activate billing plan"})
        else:
            return JSONResponse(status_code=500, content={"error": "Failed to create billing plan"})
            
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

async def execute_subscription_helper(token):
    try:        
        agreement = paypalrestsdk.BillingAgreement.execute(token)
        if agreement:
            agreement_dict = agreement.to_dict() if hasattr(agreement, 'to_dict') else agreement

            # Get payer information
            payer_info = agreement_dict.get("payer", {}).get("payer_info", {})
            payer_email = payer_info.get("email")
            
            # Initialize name
            name = "Anonymous"
            
            # Get execution details
            agreement_id = agreement_dict.get("id")
            subscription_id = agreement_dict.get("id")
            next_billing_time = agreement_dict.get("agreement_details", {}).get("next_billing_date")
            status_val = agreement_dict.get("state", "pending")
            start_time = agreement_dict.get("start_date", "")
            
            # Find most recent pending subscription and get manually entered name
            recent_sub = await DB.db["donations_subscriptions"].find_one(
                {"status": "pending", "agreement_id": {"$exists": False}},
                sort=[("created_on", -1)]
            )
            
            if recent_sub:
                # Get manually entered name
                if recent_sub.get("name"):
                    name = recent_sub.get("name")
                
                # Update subscription with execution details
                await DB.db["donations_subscriptions"].update_one(
                    {"_id": recent_sub["_id"]},
                    {"$set": {
                        "user_email": payer_email,
                        "status": status_val,
                        "agreement_id": agreement_id,
                        "next_billing_time": next_billing_time,
                        "start_time": start_time
                    }}
                )

            

            return {
                "success": True,
                "name": name,
                "agreement": agreement_dict,
                "execution_details": {
                    "payer_name": name,
                    "payer_email": payer_email,
                    "agreement_id": agreement_id,
                    "subscription_id": subscription_id,
                    "next_billing_time": next_billing_time,
                    "start_time": start_time,
                    "status": status_val
                }
            }
        else:
            return {"success": False, "error": "Failed to execute PayPal agreement"}

    except Exception as e:
        return {"success": False, "error": str(e)}

async def get_all_subscriptions_helper(skip: int = 0, limit: int = 20, status: str = None, fund_name: str = None):
    """Get all donation subscriptions with pagination and filtering"""
    try:
        query = {}
        if status:
            query["status"] = status
        if fund_name:
            query["fund_name"] = fund_name
            
        total_count = await DB.db["donations_subscriptions"].count_documents(query)
        
        sub_docs = await DB.db["donations_subscriptions"].find(query).sort([("created_on", -1), ("start_time", -1), ("_id", -1)]).skip(skip).limit(limit).to_list(length=limit)
        
        subs = []
        for sub in sub_docs:
            sub["id"] = str(sub.pop("_id"))
            
            # Convert datetime objects to ISO strings
            for date_field in ["created_on", "start_time", "next_billing_time"]:
                if date_field in sub and hasattr(sub[date_field], "isoformat"):
                    sub[date_field] = sub[date_field].isoformat()
            
            subs.append(sub)
        
        return {
            "subscriptions": subs,
            "pagination": {
                "total": total_count,
                "skip": skip,
                "limit": limit,
                "has_more": (skip + limit) < total_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subscriptions: {str(e)}")

'''