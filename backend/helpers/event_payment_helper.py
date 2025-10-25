import logging
import os
import traceback
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from fastapi import HTTPException
from bson import ObjectId

from models.event import get_event_by_id, update_attendee_payment_status, get_event_payment_summary, get_event_registrations_by_payment_status, rsvp_list
from models.transaction import Transaction
from helpers.paypalHelper import create_order_from_data, capture_payment_by_id
from controllers.event_functions import register_rsvp, register_multiple_people
from mongo.database import DB
from mongo.churchuser import UserHandler

from helpers.audit_logger import payment_audit_logger, AuditEventType



FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

class EventPaymentHelper:
    """Helper class for event payment and bulk registration operations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    # Validation Helper Methods
    async def validate_user_event_access(
        self,
        user_uid: str,
        event,
        user=None
    ) -> Tuple[bool, str]:
        """
        Validate that a user has permission to register for an event.
        
        Note: Event roles are used for management/editing permissions only, not registration.
        Any authenticated user can register for public events.
        """
        try:
            # Get user if not provided
            if user is None:
                user = await UserHandler.find_by_uid(user_uid)
                if not user:
                    payment_audit_logger.log_access_denied(
                        user_uid=user_uid,
                        event_id=event.id,
                        reason="User not found",
                        attempted_action="event_registration_validation"
                    )
                    return False, "User not found"
            
            # Log user data for debugging
            self.logger.info(f"User data for {user_uid}: email={user.get('email', 'NOT_FOUND')}")
            
            # For event registration, all authenticated users are allowed
            # Event roles are only for event management/dashboard access, not registration
            # Any signed-in user can register for public events
            self.logger.info(f"User {user_uid} has valid access for event registration")
            
            return True, "Access granted"
            
        except Exception as e:
            self.logger.error(f"Error validating user event access for user {user_uid}, event {event.id}: {str(e)}")
            return False, "Validation error"

    async def validate_family_member_access(
        self,
        user_uid: str,
        person_id: str
    ) -> Tuple[bool, str]:
        """
        Validate that a user has permission to register a family member.
        """
        try:
            if not person_id:
                return True, "No family member specified"
            
            # Convert person_id to ObjectId
            try:
                person_oid = ObjectId(person_id)
            except:
                return False, "Invalid person_id format"
            
            # Check if family member belongs to the user
            family_member = await UserHandler.get_person(user_uid, person_oid)
            if not family_member:
                payment_audit_logger.log_family_member_access(
                    user_uid=user_uid,
                    family_member_id=person_id,
                    family_member_name="Unknown",
                    access_granted=False,
                    reason="Family member not found or not owned by user"
                )
                return False, "Family member not found or you don't have permission to register them"
            
            family_member_name = f"{family_member.get('first_name', '')} {family_member.get('last_name', '')}".strip()
            payment_audit_logger.log_family_member_access(
                user_uid=user_uid,
                family_member_id=person_id,
                family_member_name=family_member_name,
                access_granted=True,
                reason="Valid family member access"
            )
            return True, "Family member access granted"
            
        except Exception as e:
            self.logger.error(f"Error validating family member access for user {user_uid}, person {person_id}: {str(e)}")
            payment_audit_logger.log_error(
                event_type=AuditEventType.FAMILY_MEMBER_ACCESS,
                user_uid=user_uid,
                event_id=None,  # No event_id in this context, family member validation only
                error_message=f"Error validating family member access for person {person_id}: {str(e)}",
                exception=e
            )
            return False, "Family member validation error"
    
    async def check_duplicate_registration(
        self,
        event_id: str,
        user_uid: str,
        person_id: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Check if a person is already registered for an event.
        """
        try:
            
            # Get current registrations for the event
            rsvp_data = await rsvp_list(event_id)
            attendees = rsvp_data.get('attendees', [])
            
            # Check for duplicate registration
            for attendee in attendees:
                attendee_uid = attendee.get('user_uid')
                attendee_person_id = attendee.get('person_id')
                
                # Match the user and person_id combination
                if attendee_uid == user_uid:
                    if person_id is None and attendee_person_id is None:
                        # User (self) is already registered
                        return False, "You are already registered for this event"
                    elif person_id is not None and attendee_person_id is not None:
                        # Check if this specific family member is already registered
                        if str(attendee_person_id) == person_id:
                            return False, "This family member is already registered for this event"
            
            return True, "No duplicate registration found"
            
        except Exception as e:
            self.logger.error(f"Error checking duplicate registration for user {user_uid}, person {person_id}: {str(e)}")
            # In case of error, allow registration to proceed (fail open)
            return True, "Duplicate check error - proceeding"

    async def validate_bulk_registration_request(
        self,
        registrations: List[Dict[str, Any]],
        user_uid: str
    ) -> List[str]:
        """Validate bulk registration request for security limits and suspicious patterns"""
        try:
            errors = []
            
            # Check for excessive number of registrations
            if len(registrations) > 50:
                errors.append("Too many registrations in a single request (maximum 50)")
            
            # Check for suspicious amounts
            amounts = []
            names = []
            
            for reg in registrations:
                donation_amount = float(reg.get("donation_amount", 0) or 0)
                payment_amount = float(reg.get("payment_amount_per_person", 0) or 0)
                
                if donation_amount > 10000:
                    errors.append(f"Donation amount too high: ${donation_amount}")
                
                if payment_amount > 1000:
                    errors.append(f"Payment amount too high: ${payment_amount}")
                
                amounts.append(donation_amount + payment_amount)
                
                # Collect names for duplicate checking
                name = reg.get("name", "").strip()
                if name:
                    names.append(name.lower())
            
            # Check for duplicate names (potential fraud)
            if len(names) != len(set(names)) and len(names) > 1:
                errors.append("Duplicate names detected in registration list")
            
            # Check for suspicious amount patterns
            if len(amounts) > 5 and len(set(amounts)) == 1 and amounts[0] > 100:
                errors.append("Suspicious payment pattern detected")
            
            return errors
            
        except Exception as e:
            self.logger.error(f"Error validating bulk registration request: {str(e)}")
            return ["Validation error occurred"]

    async def validate_registration_data(
        self,
        registration_data: Dict[str, Any],
        event,
        user_uid: str
    ) -> Tuple[bool, str]:
        """Validate individual registration data"""
        try:
            # Validate required fields
            if not registration_data.get("name"):
                return False, "Missing required field: name"
            
            # Email can come from registration data or will be filled from user profile
            # No need to validate email here as it will be populated later
            
            # Validate amounts
            donation_amount = float(registration_data.get("donation_amount", 0) or 0)
            payment_amount_per_person = float(registration_data.get("payment_amount_per_person", 0) or 0)
            
            if donation_amount < 0 or payment_amount_per_person < 0:
                return False, "Amounts cannot be negative"
            
            # Validate person_id/family_member_id if provided (family member)
            person_id = registration_data.get("person_id") or registration_data.get("family_member_id")
            if person_id:
                try:
                    ObjectId(person_id)
                except:
                    return False, "Invalid person_id/family_member_id format"

                # Validate family member access
                access_valid, access_message = await self.validate_family_member_access(user_uid, person_id)
                if not access_valid:
                    return False, access_message

                # Only enforce duplicate-registration check when a payment amount is expected
                # (i.e., this registration includes a payment_amount_per_person > 0).
                # For donation-only entries (payment_amount_per_person == 0) we allow the donation
                # even if the user/family member is already registered.
                if payment_amount_per_person > 0:
                    duplicate_check_valid, duplicate_message = await self.check_duplicate_registration(event.id, user_uid, person_id)
                    if not duplicate_check_valid:
                        return False, duplicate_message
            else:
                # For self registrations, only check for duplicates if there's an event fee to pay.
                if payment_amount_per_person > 0:
                    duplicate_check_valid, duplicate_message = await self.check_duplicate_registration(event.id, user_uid, None)
                    if not duplicate_check_valid:
                        return False, duplicate_message
            
            return True, "Valid"
            
        except Exception as e:
            self.logger.error(f"Error validating registration data: {str(e)}")
            return False, "Validation error"

    # Main Business Logic Methods
    async def create_bulk_payment_order(
        self,
        event_id: str,
        user_uid: str,
        user,
        bulk_data: Dict[str, Any],
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create PayPal payment order for multiple event registrations"""
        try:
            self.logger.info(f"Creating bulk payment order for event: {event_id}")
            
            # Parse bulk registration request
            registrations = bulk_data.get("registrations", [])
            message = bulk_data.get("message", "")
            return_url = bulk_data.get("return_url", "")
            cancel_url = bulk_data.get("cancel_url", "")
            # Support donation-only flows where donation amount is provided at top-level
            # If registrations don't include donation_amount but bulk_data has donation_amount
            # and there's a single registration, assign the top-level donation to that registration.
            top_level_donation = float(bulk_data.get("donation_amount", 0) or 0)
            if top_level_donation > 0 and len(registrations) == 1:
                reg = registrations[0]
                # Only set if not already provided
                if not reg.get("donation_amount"):
                    reg["donation_amount"] = top_level_donation
            
            # Debug: Log the received URLs
            self.logger.info(f"DEBUG: Received return_url: '{return_url}'")
            self.logger.info(f"DEBUG: Received cancel_url: '{cancel_url}'")
            self.logger.info(f"DEBUG: Full bulk_data: {bulk_data}")
            
            if not registrations:
                raise HTTPException(status_code=400, detail="No registrations provided")
            
            self.logger.info(f"Number of registrations: {len(registrations)}")
            
            # Calculate total amount for logging
            total_amount = 0.0
            for reg in registrations:
                total_amount += float(reg.get("donation_amount", 0) or 0)
                total_amount += float(reg.get("payment_amount_per_person", 0) or 0)
            
            # Log bulk payment request
            payment_audit_logger.log_bulk_payment_request(
                user_uid=user_uid,
                event_id=event_id,
                registration_count=len(registrations),
                total_amount=total_amount,
                validation_passed=False,  # Will update after validation
                request_ip=client_ip
            )
            
            # Validate bulk registration request for security limits
            self.logger.info("Validating bulk registration request...")
            bulk_errors = await self.validate_bulk_registration_request(registrations, user_uid)
            if bulk_errors:
                payment_audit_logger.log_validation_failed(
                    user_uid=user_uid,
                    event_id=event_id,
                    validation_errors=bulk_errors,
                    validation_type="bulk_registration",
                    request_ip=client_ip
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Bulk registration validation failed: {'; '.join(bulk_errors)}"
                )
            self.logger.info("Bulk registration request validated")
            
            # Check PayPal configuration first
            paypal_client_id = os.getenv("PAYPAL_CLIENT_ID")
            paypal_client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
            
            if not paypal_client_id or not paypal_client_secret:
                raise HTTPException(
                    status_code=503, 
                    detail="PayPal is not configured. Please contact the administrator to set up PayPal credentials."
                )
            
            # Get the event
            event = await get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            self.logger.info(f"Event found: {event.name}")
            self.logger.info(f"Event details - Price: {event.price}, PayPal option: {event.has_paypal_option()}")
            
            # Validate user access to event
            access_valid, access_message = await self.validate_user_event_access(user_uid, event, user)
            if not access_valid:
                raise HTTPException(status_code=403, detail=access_message)
            
            # Process individual registration validations
            validated_registrations = []
            total_event_fee = 0.0
            total_donation = 0.0
            
            for i, registration_data in enumerate(registrations):
                # Validate individual registration
                self.logger.info(f"Validating registration {i+1}: {registration_data}")
                is_valid, validation_message = await self.validate_registration_data(registration_data, event, user_uid)
                if not is_valid:
                    self.logger.error(f"Registration {i+1} validation failed: {validation_message}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Registration {i+1} validation failed: {validation_message}"
                    )
                
                # Calculate amounts with safety checks
                try:
                    donation_amount = float(registration_data.get("donation_amount", 0) or 0)
                except (TypeError, ValueError):
                    donation_amount = 0.0
                
                try:
                    payment_amount_per_person = float(registration_data.get("payment_amount_per_person", 0) or 0)
                except (TypeError, ValueError):
                    payment_amount_per_person = 0.0
                
                total_donation += donation_amount
                total_event_fee += payment_amount_per_person
                
                # Ensure email is populated from user profile if not provided
                registration_email = registration_data.get("email")
                self.logger.info(f"Registration {i+1} - email in registration_data: {registration_email}")
                if not registration_email:
                    registration_email = user.get("email") if user else None
                    self.logger.info(f"Registration {i+1} - email from user profile: {registration_email}")
                    if not registration_email:
                        self.logger.error(f"Registration {i+1} - No email found in registration data or user profile")
                        raise HTTPException(
                            status_code=400,
                            detail=f"Registration {i+1} validation failed: No email available in user profile"
                        )
                
                validated_registrations.append({
                    **registration_data,
                    "email": registration_email,
                    "donation_amount": donation_amount,
                    "payment_amount_per_person": payment_amount_per_person,
                    "validation_status": "validated"
                })
            
            # Create PayPal order
            paypal_order_data = await self._create_paypal_order_data(
                event=event,
                event_id=event_id,
                user_uid=user_uid,
                validated_registrations=validated_registrations,
                total_event_fee=total_event_fee,
                total_donation=total_donation,
                return_url=return_url,
                cancel_url=cancel_url
            )
            
            # Create the order
            order_data = await create_order_from_data(paypal_order_data)
            
            # Check for errors in the response
            if "error" in order_data:
                status_code = order_data.get("status_code", 500)
                error_msg = order_data.get("error", "Failed to create PayPal order")
                self.logger.error(f"PayPal order creation failed: {error_msg}")
                raise HTTPException(status_code=status_code, detail=error_msg)
            
            if not order_data or "payment_id" not in order_data:
                raise HTTPException(status_code=500, detail="Failed to create PayPal order")
            
            payment_id = order_data["payment_id"]
            
            # Store registration data for completion
            bulk_registration_data = {
                "payment_id": payment_id,
                "event_id": event_id,
                "user_uid": user_uid,
                "registrations": validated_registrations,
                "total_event_fee": total_event_fee,
                "total_donation": total_donation,
                "message": message,
                "created_at": datetime.now().isoformat(),
                "status": "pending"
            }
            
            # Store in database
            await DB.insert_document("bulk_registrations", bulk_registration_data)
            
            # Log successful order creation
            payment_audit_logger.log_payment_order_created(
                user_uid=user_uid,
                event_id=event_id,
                registration_count=len(validated_registrations),
                total_amount=total_event_fee + total_donation,
                payment_method="paypal",
                request_ip=client_ip
            )
            
            # Check for existing transaction
            existing_transaction = await Transaction.get_transaction_by_id(payment_id)
            if existing_transaction and existing_transaction.event_id == event_id:
                self.logger.info(f"Existing transaction found for payment_id: {payment_id}")
                
                # Extract registration preview for existing transaction too
                existing_registration_preview = []
                for registration in validated_registrations:
                    person_preview = {
                        "first_name": registration.get("first_name", ""),
                        "last_name": registration.get("last_name", ""),
                        "email": registration.get("email", ""),
                        "payment_amount": round(float(registration.get("payment_amount_per_person", 0) or 0), 2),
                        "donation_amount": round(float(registration.get("donation_amount", 0) or 0), 2)
                    }
                    # Create full name
                    full_name = f"{person_preview['first_name']} {person_preview['last_name']}".strip()
                    person_preview["full_name"] = full_name if full_name else "Unknown"
                    existing_registration_preview.append(person_preview)
                
                return {
                    "success": True,
                    "order_id": payment_id,
                    "payment_id": payment_id,  # Add payment_id for Flutter compatibility
                    "approval_url": order_data.get("approval_url"),
                    "total_amount": round(float(existing_transaction.amount or 0), 2),
                    "currency": "USD",
                    "registrations_count": len(validated_registrations),
                    "registration_preview": existing_registration_preview,
                    "existing_transaction": True
                }
            
            # Ensure proper number formatting
            total_amount = round(total_event_fee + total_donation, 2)
            
            # Extract registration preview with names
            registration_preview = []
            for registration in validated_registrations:
                person_preview = {
                    "first_name": registration.get("first_name", ""),
                    "last_name": registration.get("last_name", ""),
                    "email": registration.get("email", ""),
                    "payment_amount": round(float(registration.get("payment_amount_per_person", 0) or 0), 2),
                    "donation_amount": round(float(registration.get("donation_amount", 0) or 0), 2)
                }
                # Create full name
                full_name = f"{person_preview['first_name']} {person_preview['last_name']}".strip()
                person_preview["full_name"] = full_name if full_name else "Unknown"
                registration_preview.append(person_preview)
            
            return {
                "success": True,
                "order_id": payment_id,
                "payment_id": payment_id,  # Add payment_id for Flutter compatibility
                "approval_url": order_data.get("approval_url"),
                "total_amount": total_amount,
                "currency": "USD",
                "registrations_count": len(validated_registrations),
                "registration_preview": registration_preview,
                "registration_breakdown": {
                    "total_event_fees": round(total_event_fee, 2),
                    "total_donations": round(total_donation, 2)
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error in bulk payment creation: {str(e)}")
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            payment_audit_logger.log_error(
                event_type=AuditEventType.PAYMENT_ORDER_FAILED,
                user_uid=user_uid,
                event_id=event_id,
                error_message=f"Unexpected error in payment creation: {str(e)}",
                exception=e,
                request_ip=client_ip
            )
            raise HTTPException(status_code=500, detail=f"Failed to create bulk payment order: {str(e)}")

    async def complete_bulk_registration(
        self,
        event_id: str,
        user_uid: str,
        completion_data: Dict[str, Any],
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Complete bulk event registration after successful payment"""
        try:
            self.logger.info(f"[BULK_REGISTRATION] Completing bulk registration for event: {event_id}, user: {user_uid}")
            logging.info(f"[BULK_REGISTRATION] Completion data: {completion_data}")

            payment_id = completion_data.get("payment_id")
            if not payment_id:
                raise HTTPException(status_code=400, detail="payment_id is required")
            
            # Retrieve stored registration data
            bulk_registration = await DB.db["bulk_registrations"].find_one({
                "payment_id": payment_id,
                "event_id": event_id,
                "user_uid": user_uid
            })
            
            if not bulk_registration:
                raise HTTPException(status_code=404, detail="Bulk registration not found")
            
            if bulk_registration.get("status") == "completed":
                # Calculate total amount safely for already completed registration
                total_event_fee = float(bulk_registration.get("total_event_fee", 0) or 0)
                total_donation = float(bulk_registration.get("total_donation", 0) or 0)
                total_amount = total_event_fee + total_donation
                
                # Extract registration details with names for already completed
                completed_registrations = bulk_registration.get("registrations", [])
                completed_people = []
                for registration in completed_registrations:
                    # Handle different name field formats
                    first_name = registration.get("first_name", "")
                    last_name = registration.get("last_name", "")
                    full_name_from_name_field = registration.get("name", "")
                    
                    # Use the name field if first_name/last_name are empty
                    if not first_name and not last_name and full_name_from_name_field:
                        # Try to split the name field into first and last
                        name_parts = full_name_from_name_field.strip().split(" ", 1)
                        first_name = name_parts[0] if len(name_parts) > 0 else ""
                        last_name = name_parts[1] if len(name_parts) > 1 else ""
                        full_name = full_name_from_name_field
                    else:
                        # Create full name from first/last
                        full_name = f"{first_name} {last_name}".strip()
                    
                    # Fallback to "Event Registration" if no name available
                    if not full_name:
                        full_name = full_name_from_name_field if full_name_from_name_field else "Event Registration"
                    
                    person_info = {
                        "first_name": first_name,
                        "last_name": last_name,
                        "full_name": full_name,
                        "email": registration.get("email", ""),
                        "payment_amount": float(registration.get("payment_amount_per_person", 0) or 0),
                        "donation_amount": float(registration.get("donation_amount", 0) or 0)
                    }
                    completed_people.append(person_info)
                
                self.logger.info(f"Already completed registration: total_amount={total_amount}, registrations={len(completed_registrations)}")
                
                return {
                    "success": True,
                    "message": "Registration already completed",
                    "payment_id": payment_id,
                    # Top-level fields for frontend compatibility
                    "registrations_completed": len(completed_registrations),
                    "total_amount": total_amount,
                    "registered_people": completed_people,
                    "total_event_fee": total_event_fee,
                    "total_donation": total_donation,
                    # Also include in data object for API consistency
                    "data": {
                        "registrations_completed": len(completed_registrations),
                        "total_amount": total_amount,
                        "registered_people": completed_people,
                        "total_event_fee": total_event_fee,
                        "total_donation": total_donation
                    }
                }
            
            # Get the event
            event = await get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Process registrations
            successful_registrations = []
            failed_registrations = []
            
            registrations = bulk_registration.get("registrations", [])
            for registration_data in registrations:
                try:
                    # Register for the event - handle both person_id and family_member_id
                    # Mark as PayPal payment since this is bulk payment completion
                    person_id = registration_data.get("person_id") or registration_data.get("family_member_id")
                    result, reason = await register_rsvp(event_id, user_uid, person_id, payment_option="paypal")
                    
                    if result:
                        registration_data["registration_status"] = "success"
                        registration_data["registration_key"] = result.get("registration_key") if isinstance(result, dict) else None
                        successful_registrations.append(registration_data)
                        
                        # Update payment status to completed after successful PayPal payment
                        try:
                            
                            
                            # Also update event attendee payment status
                            person_object_id = ObjectId(person_id) if person_id else None
                            person_id_str = str(person_object_id) if person_object_id else 'self'
                            attendee_key = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                            await update_attendee_payment_status(
                                event_id=event_id,
                                attendee_key=attendee_key,
                                payment_status='completed',
                                transaction_id=payment_id
                            )
                            
                            self.logger.info(f"Successfully updated payment status to 'completed' for {registration_data.get('name')}")
                        except Exception as update_error:
                            self.logger.warning(f"Failed to update payment status for {registration_data.get('name')}: {str(update_error)}")
                            # Don't fail the whole registration, just log the warning
                    else:
                        registration_data["registration_status"] = "failed"
                        registration_data["failure_reason"] = reason
                        failed_registrations.append(registration_data)
                        
                except Exception as reg_error:
                    self.logger.error(f"Registration error for {registration_data.get('name')}: {str(reg_error)}")
                    registration_data["registration_status"] = "failed"
                    registration_data["failure_reason"] = str(reg_error)
                    failed_registrations.append(registration_data)
            
            # Record payment transaction for successful registrations
            if successful_registrations:
                self.logger.info(f"Recording transaction for {len(successful_registrations)} successful registrations")
                
                total_event_fee = bulk_registration.get("total_event_fee", 0)
                total_donation = bulk_registration.get("total_donation", 0)
                total_amount = total_event_fee + total_donation
                
                # Determine transaction type based on actual amounts
                if total_donation > 0 and total_event_fee > 0:
                    transaction_type = "event_payment_and_donation"
                elif total_donation > 0:
                    transaction_type = "event_donation"
                else:
                    transaction_type = "event_payment"
                
                self.logger.info(f"Transaction type: {transaction_type}")
                
                # Create transaction record
                transaction = Transaction(
                    transaction_id=payment_id,
                    user_email=successful_registrations[0].get("email", ""),
                    amount=total_amount,
                    status="COMPLETED",
                    type="one-time",
                    order_id=payment_id,
                    payment_method="paypal",
                    time=datetime.now().isoformat(),
                    name=successful_registrations[0].get("name", ""),
                    fund_name=transaction_type,
                    currency="USD",
                    event_type=transaction_type,
                    event_id=event_id,
                    event_name=event.name,
                    payment_type="event_registration",
                    user_uid=user_uid,
                    metadata={
                        "registration_count": len(successful_registrations),
                        "event_fee_total": total_event_fee,
                        "donation_total": total_donation,
                        "bulk_registration": True
                    }
                )
                
                saved_transaction = await Transaction.create_transaction(transaction)
                if saved_transaction:
                    self.logger.info(f"Transaction saved successfully: {saved_transaction.transaction_id}")
                else:
                    self.logger.error("Failed to save transaction")
            
            # Update bulk registration status
            await DB.update_document(
                "bulk_registrations",
                {"payment_id": payment_id},
                {
                    "status": "completed",
                    "completed_at": datetime.now().isoformat(),
                    "successful_registrations": len(successful_registrations),
                    "failed_registrations": len(failed_registrations)
                }
            )
            
            # Log completion
            payment_audit_logger.log_registration_completed(
                user_uid=user_uid,
                event_id=event_id,
                registration_count=len(successful_registrations),
                payment_id=payment_id,
                total_amount=bulk_registration.get("total_event_fee", 0) + bulk_registration.get("total_donation", 0),
                request_ip=client_ip
            )
            
            # Calculate total amount safely
            total_event_fee = float(bulk_registration.get("total_event_fee", 0) or 0)
            total_donation = float(bulk_registration.get("total_donation", 0) or 0)
            total_amount = total_event_fee + total_donation
            
            self.logger.info(f"Completion data calculated: total_amount={total_amount}, successful_registrations={len(successful_registrations)}")
            self.logger.info(f"Bulk registration data: total_event_fee={bulk_registration.get('total_event_fee', 'MISSING')}, total_donation={bulk_registration.get('total_donation', 'MISSING')}")
            
            # Extract registration details with names
            completed_people = []
            for registration in successful_registrations:
                # Handle different name field formats
                first_name = registration.get("first_name", "")
                last_name = registration.get("last_name", "")
                full_name_from_name_field = registration.get("name", "")
                
                # Use the name field if first_name/last_name are empty
                if not first_name and not last_name and full_name_from_name_field:
                    # Try to split the name field into first and last
                    name_parts = full_name_from_name_field.strip().split(" ", 1)
                    first_name = name_parts[0] if len(name_parts) > 0 else ""
                    last_name = name_parts[1] if len(name_parts) > 1 else ""
                    full_name = full_name_from_name_field
                else:
                    # Create full name from first/last
                    full_name = f"{first_name} {last_name}".strip()
                
                # Fallback to "Event Registration" if no name available
                if not full_name:
                    full_name = full_name_from_name_field if full_name_from_name_field else "Event Registration"
                
                person_info = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "full_name": full_name,
                    "email": registration.get("email", ""),
                    "payment_amount": float(registration.get("payment_amount_per_person", 0) or 0),
                    "donation_amount": float(registration.get("donation_amount", 0) or 0)
                }
                completed_people.append(person_info)
            
            return {
                "success": True,
                "message": "Bulk registration completed",
                "payment_id": payment_id,
                # Top-level fields for frontend compatibility
                "registrations_completed": len(successful_registrations),
                "total_amount": total_amount,
                "registered_people": completed_people,
                "total_event_fee": total_event_fee,
                "total_donation": total_donation,
                # Also include in data object for API consistency
                "data": {
                    "registrations_completed": len(successful_registrations),
                    "total_amount": total_amount,
                    "registered_people": completed_people,
                    "total_event_fee": total_event_fee,
                    "total_donation": total_donation
                },
                "registrations": {
                    "successful": len(successful_registrations),
                    "failed": len(failed_registrations),
                    "total": len(registrations)
                },
                "details": {
                    "successful_registrations": successful_registrations,
                    "failed_registrations": failed_registrations
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error completing bulk registration: {str(e)}")
            payment_audit_logger.log_error(
                event_type=AuditEventType.REGISTRATION_FAILED,
                user_uid=user_uid,
                event_id=event_id,
                error_message=f"Bulk registration completion failed: {str(e)}",
                exception=e,
                request_ip=client_ip
            )
            raise HTTPException(status_code=500, detail=f"Failed to complete bulk registration: {str(e)}")

    async def get_payment_status(
        self,
        event_id: str,
        user_uid: str
    ) -> Dict[str, Any]:
        """Get payment status for an event"""
        try:
            # Get the event
            event = await get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Get payment summary
            payment_summary = await get_event_payment_summary(event_id)
            
            # Get transaction details for paid registrations
            transactions = await Transaction.get_transactions_by_event(event_id)
            
            return {
                "success": True,
                "event_id": event_id,
                "event_name": event.name,
                "payment_summary": payment_summary,
                "transactions": [tx.model_dump() for tx in transactions],
                "total_transactions": len(transactions)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error getting payment status for event {event_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get payment status: {str(e)}")

    async def get_registrations_by_payment_status(
        self,
        event_id: str,
        payment_status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get event registrations filtered by payment status"""
        try:
            # Get the event
            event = await get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Get registrations by payment status
            registrations = await get_event_registrations_by_payment_status(event_id, payment_status)
            
            return {
                "success": True,
                "event_id": event_id,
                "event_name": event.name,
                "payment_status_filter": payment_status,
                "registrations": registrations,
                "total_registrations": len(registrations)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error getting payment registrations for event {event_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get payment registrations: {str(e)}")

    async def update_registration_payment_status(
        self,
        event_id: str,
        registration_key: str,
        status_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update payment status for a specific registration (admin only)"""
        try:
            # Get the event
            event = await get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            payment_status = status_data.get("payment_status")
            transaction_id = status_data.get("transaction_id")
            
            if payment_status not in ["not_required", "pending", "completed", "failed"]:
                raise HTTPException(
                    status_code=400,
                    detail="payment_status must be one of: not_required, pending, completed, failed"
                )
            
            # Update the payment status
            updated = await update_attendee_payment_status(
                event_id=event_id,
                registration_key=registration_key,
                payment_status=payment_status,
                transaction_id=transaction_id
            )
            
            if updated:
                return {
                    "success": True,
                    "message": "Payment status updated successfully",
                    "event_id": event_id,
                    "registration_key": registration_key,
                    "payment_status": payment_status
                }
            else:
                raise HTTPException(
                    status_code=404,
                    detail="Registration not found or update failed"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error updating payment status for registration {registration_key}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to update payment status: {str(e)}")

    # Private helper methods
    async def _create_paypal_order_data(
        self,
        event,
        event_id: str,
        user_uid: str,
        validated_registrations: List[Dict[str, Any]],
        total_event_fee: float,
        total_donation: float,
        return_url: str,
        cancel_url: str
    ) -> Dict[str, Any]:
        """Create PayPal order data structure"""
        try:
            items = []
            total_amount = total_event_fee + total_donation
            
            if total_event_fee > 0:
                items.append({
                    "name": f"{event.name} - Event Registration ({len(validated_registrations)} people)",
                    "quantity": "1",
                    "unit_amount": {
                        "currency_code": "USD",
                        "value": f"{total_event_fee:.2f}"
                    }
                })
            
            if total_donation > 0:
                items.append({
                    "name": f"{event.name} - Donation",
                    "quantity": "1",
                    "unit_amount": {
                        "currency_code": "USD",
                        "value": f"{total_donation:.2f}"
                    }
                })
            
            paypal_order_data = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {
                        "currency_code": "USD",
                        "value": f"{total_amount:.2f}",
                        "breakdown": {
                            "item_total": {
                                "currency_code": "USD",
                                "value": f"{total_amount:.2f}"
                            }
                        }
                    },
                    "items": items,
                    "description": f"Event registration for {event.name} - {len(validated_registrations)} people - Event ID: {event_id} - User: {user_uid}"
                }],
                "application_context": {
                    "return_url": return_url or f"{FRONTEND_URL}/events/{event.id}/payment/success",
                    "cancel_url": cancel_url or f"{FRONTEND_URL}/events/{event.id}/payment/cancel",
                    "brand_name": "Church Event Registration",
                    "locale": "en-US",
                    "landing_page": "BILLING",
                    "user_action": "PAY_NOW"
                }
            }
            
            # Debug: Log the final URLs being sent to PayPal
            final_return_url = return_url or f"{FRONTEND_URL}/events/{event.id}/payment/success"
            final_cancel_url = cancel_url or f"{FRONTEND_URL}/events/{event.id}/payment/cancel"
            self.logger.info(f"DEBUG: Final return_url sent to PayPal: '{final_return_url}'")
            self.logger.info(f"DEBUG: Final cancel_url sent to PayPal: '{final_cancel_url}'")
            
            return paypal_order_data
            
        except Exception as e:
            self.logger.error(f"Error creating PayPal order data: {str(e)}")
            raise

    async def handle_paypal_success(
        self,
        event_id: str,
        payment_id: str,
        payer_id: str,
        token: str,
        client_ip: str,
        request
    ) -> Dict[str, Any]:
        """Handle PayPal success callback and complete payment for individual registrations"""
        try:
            self.logger.info(f"Processing PayPal success for event {event_id}, payment {payment_id}, token {token}")
            
            # Capture the payment using PayPal API
            capture_result = await capture_payment_by_id(payment_id, payer_id)
            
            if "error" in capture_result:
                self.logger.error(f"Payment capture failed: {capture_result['error']}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Payment capture failed: {capture_result['error']}"
                )
            
            # For the simplified registration system, try to get registration details from payment session
            registration_session = None
            registration_count = 1  # Default
            total_registrations = []
            
            # Try to find the payment session by payment_id (order ID) or token
            try:
                registration_session = await DB.db["payment_sessions"].find_one({"payment_id": payment_id})
                if not registration_session and token:
                    registration_session = await DB.db["payment_sessions"].find_one({"payment_id": token})
                
                # If no payment session found, check bulk_registrations collection
                bulk_registration = None
                if not registration_session:
                    bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": payment_id})
                    if not bulk_registration and token:
                        bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": token})
                
                if registration_session:
                    registration_count = registration_session.get("registration_count", 1)
                    raw_registrations = registration_session.get("registrations", [])
                    user_uid = registration_session.get("user_uid")
                    
                    # Actually register the people for the event after payment confirmation
                    
                    
                    if user_uid:
                        self.logger.info(f"Attempting to register {registration_count} people for event {event_id} by user {user_uid}")
                        
                        try:
                            # Register the people using the stored registration data
                            success, message = await register_multiple_people(
                                event_id=event_id,
                                uid=user_uid,
                                registrations=raw_registrations,
                                payment_option="paypal",
                                donation_amount=registration_session.get("donation_amount", 0.0)
                            )
                            
                            if success:
                                self.logger.info(f"Successfully registered people after payment: {message}")
                                
                                # Now update payment status for all registered attendees to 'paid'
                                
                                
                                for registration in raw_registrations:
                                    person_id = registration.get('person_id')  # None for self, ObjectId string for family members
                                    
                                    # Generate attendee key to identify the specific attendee
                                    person_object_id = ObjectId(person_id) if person_id else None
                                    person_id_str = str(person_object_id) if person_object_id else 'self'
                                    attendee_key = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                                    
                                    # Update payment status to 'completed'
                                    update_success = await update_attendee_payment_status(
                                        event_id=event_id,
                                        attendee_key=attendee_key,
                                        payment_status='completed',
                                        transaction_id=payment_id
                                    )
                                    
                                    if update_success:
                                        self.logger.info(f"Updated payment status to 'completed' for attendee {attendee_key}")
                                    else:
                                        self.logger.error(f"Failed to update payment status for attendee {attendee_key}")
                                
                            else:
                                self.logger.error(f"Failed to register people after payment: {message}")
                                
                        except Exception as e:
                            self.logger.error(f"Exception while registering people after payment: {str(e)}")
                    else:
                        self.logger.error("No user_uid found in payment session - cannot register people")
                    
                    # Transform registrations to expected format for response
                    total_registrations = []
                    for reg in raw_registrations:
                        # Parse the full name into first and last name
                        full_name = reg.get("name", "Unknown")
                        name_parts = full_name.split(" ", 1)
                        first_name = name_parts[0] if len(name_parts) > 0 else ""
                        last_name = name_parts[1] if len(name_parts) > 1 else ""
                        
                        transformed_reg = {
                            "first_name": first_name,
                            "last_name": last_name, 
                            "full_name": full_name,
                            "email": "",  # Not available in current registration data
                            "payment_amount": float(reg.get("payment_amount_per_person", 0)),
                            "donation_amount": float(reg.get("donation_amount", 0))
                        }
                        total_registrations.append(transformed_reg)
                    
                    self.logger.info(f"Found payment session with {registration_count} registrations")
                    
                    # Update the session status to completed
                    await DB.update_document(
                        "payment_sessions",
                        {"_id": registration_session["_id"]},
                        {
                            "status": "completed",
                            "payment_captured_at": datetime.now().isoformat(),
                            "capture_details": capture_result
                        }
                    )
                elif bulk_registration:
                    # Handle bulk registration flow
                    self.logger.info(f"Found bulk registration with {len(bulk_registration.get('registrations', []))} registrations")
                    
                    registration_count = len(bulk_registration.get("registrations", []))
                    raw_registrations = bulk_registration.get("registrations", [])
                    user_uid = bulk_registration.get("user_uid")
                    
                    # Transform registrations to expected format for response
                    total_registrations = []
                    
                    for reg in raw_registrations:
                        # Try to get name from different possible fields
                        full_name = (
                            reg.get("name") or 
                            reg.get("full_name") or 
                            f"{reg.get('first_name', '')} {reg.get('last_name', '')}".strip() or
                            "Unknown"
                        )
                        
                        # Parse the full name into first and last name
                        name_parts = full_name.split(" ", 1)
                        first_name = name_parts[0] if len(name_parts) > 0 else ""
                        last_name = name_parts[1] if len(name_parts) > 1 else ""
                        
                        transformed_reg = {
                            "first_name": first_name,
                            "last_name": last_name, 
                            "full_name": full_name,
                            "email": reg.get("email", ""),
                            "payment_amount": float(reg.get("payment_amount_per_person", 0)),
                            "donation_amount": float(reg.get("donation_amount", 0))
                        }
                        total_registrations.append(transformed_reg)
                    
                    # Now actually register each person to the event after payment confirmation
                    try:
                        
                        
                        self.logger.info(f"Processing registration and payment status update for {registration_count} people")
                        
                        successful_registrations = 0
                        for i, registration in enumerate(raw_registrations):
                            person_id = registration.get('person_id')  # None for self, ObjectId string for family members
                            display_name = registration.get('name')
                            
                            try:
                                # Register this person to the event
                                success, message = await register_rsvp(
                                    event_id=event_id,
                                    uid=user_uid,
                                    person_id=person_id,
                                    display_name=display_name,
                                    scope="occurrence",  # Single event registration
                                    payment_option="paypal"
                                )
                                
                                if success:
                                    self.logger.info(f"Successfully registered {display_name} for event")
                                    successful_registrations += 1
                                elif message == "already_registered":
                                    self.logger.info(f"{display_name} is already registered - updating payment status only")
                                    successful_registrations += 1  # Count as success since they're registered
                                else:
                                    self.logger.error(f"Failed to register {display_name}: {message}")
                                    continue  # Skip payment status update for failed registrations
                                
                                # Update payment status to 'completed' for both new and existing registrations
                                try:
                                    
                                    
                                    # Generate attendee key to match the format used in register_rsvp
                                    # Note: person_id gets converted to ObjectId in register_rsvp, so we need to match that
                                    person_object_id = ObjectId(person_id) if person_id else None
                                    person_id_str = str(person_object_id) if person_object_id else 'self'
                                    attendee_key = f"{user_uid}|{person_id_str}|rsvp|occurrence"
                                    
                                    self.logger.info(f"Updating payment status for {display_name} with attendee_key: {attendee_key}")
                                    
                                    # Update event attendee payment status (payment status is event-specific)
                                    
                                    # NOTE: Payment status is tracked per-event in the events collection, not in user's my_events
                                    # This is the correct approach because payment status is event-specific, not a global user property
                                    # A user can have different payment statuses across different events
                                    
                                    # Update event attendee payment status
                                    update_success = await update_attendee_payment_status(
                                        event_id=event_id,
                                        attendee_key=attendee_key,
                                        payment_status='completed',
                                        transaction_id=payment_id
                                    )
                                    
                                    if update_success:
                                        self.logger.info(f"Successfully updated event attendee payment status for {display_name}")
                                    else:
                                        self.logger.error(f"Failed to update event attendee payment status for {display_name}")
                                        # Let's also log the event to see if the attendee exists
                                        try:
                                            event_doc = await DB.db["events"].find_one({"_id": ObjectId(event_id)}, {"attendees": 1})
                                            if event_doc:
                                                attendee_keys = [att.get("key") for att in event_doc.get("attendees", [])]
                                                self.logger.error(f"Available attendee keys: {attendee_keys}")
                                                self.logger.error(f"Looking for key: {attendee_key}")
                                            else:
                                                self.logger.error(f"Event not found: {event_id}")
                                        except Exception as debug_e:
                                            self.logger.error(f"Debug query failed: {debug_e}")
                                        
                                except Exception as e:
                                    self.logger.error(f"Exception while updating payment status for {display_name}: {str(e)}")
                                    self.logger.error(f"Traceback: {traceback.format_exc()}")
                                    
                            except Exception as e:
                                self.logger.error(f"Exception while registering {display_name}: {str(e)}")
                        
                        self.logger.info(f"Registration completed: {successful_registrations}/{registration_count} people registered successfully")
                        
                    except Exception as e:
                        self.logger.error(f"Exception during bulk registration: {str(e)}")
                    
                    self.logger.info(f"Found bulk registration with {registration_count} registrations")
                    
                    # Update the bulk registration status to completed
                    await DB.update_document(
                        "bulk_registrations",
                        {"_id": bulk_registration["_id"]},
                        {
                            "status": "completed",
                            "payment_captured_at": datetime.now().isoformat(),
                            "capture_details": capture_result
                        }
                    )
            except Exception as e:
                self.logger.warning(f"Could not retrieve payment session: {str(e)}")
            
            # Create and save transaction to database
            try:
                # Get event details for transaction
                event = await get_event_by_id(event_id)
                user_uid = None
                
                # Try to get user_uid from payment session or bulk registration
                if registration_session:
                    user_uid = registration_session.get("user_uid")
                elif 'bulk_registration' in locals() and bulk_registration:
                    user_uid = bulk_registration.get("user_uid")
                
                # Check if transaction already exists to prevent duplicates
                existing_transaction = await Transaction.get_transaction_by_id(payment_id)
                if existing_transaction:
                    self.logger.info(f"✅ Transaction already exists: {payment_id}")
                    saved_transaction = existing_transaction
                else:
                    # Create new transaction record
                    transaction = Transaction(
                        transaction_id=payment_id,
                        user_email=capture_result.get("payer_email", ""),
                        amount=float(capture_result.get("amount", 0)),
                        status="COMPLETED",
                        type="one-time",
                        order_id=payment_id,
                        payment_method="paypal",
                        time=capture_result.get("create_time", datetime.now().isoformat()),
                        name=capture_result.get("payer_name", ""),
                        fund_name=f"Event: {event.name if event else 'Unknown Event'}",
                        currency=capture_result.get("currency", "USD"),
                        event_type="event_registration",
                        event_id=event_id,
                        event_name=event.name if event else "Unknown Event",
                        payment_type="event_registration",
                        user_uid=user_uid,
                        metadata={
                            "registration_count": registration_count,
                            "event_fee_total": float(capture_result.get("amount", 0)),
                            "donation_total": 0.0,
                            "bulk_registration": registration_count > 1,
                            "payer_id": payer_id,
                            "payment_token": token
                        }
                    )
                    
                    saved_transaction = await Transaction.create_transaction(transaction)
                    if saved_transaction:
                        self.logger.info(f"✅ Transaction saved successfully: {saved_transaction.transaction_id}")
                    else:
                        self.logger.error("❌ Failed to save transaction")
                        # Try to get more detailed error info
                        try:
                            # Check if it's a duplicate key error by trying to find the transaction again
                            check_transaction = await Transaction.get_transaction_by_id(payment_id)
                            if check_transaction:
                                self.logger.error(f"❌ Transaction was created by another process: {payment_id}")
                                saved_transaction = check_transaction
                            else:
                                self.logger.error(f"❌ Unknown error creating transaction for payment: {payment_id}")
                        except Exception as check_e:
                            self.logger.error(f"❌ Error checking transaction existence: {str(check_e)}")
                    
            except Exception as e:
                self.logger.error(f"❌ Error saving transaction: {str(e)}")
                # Don't fail the payment completion if transaction saving fails
                pass

            # Log successful payment completion
            payment_audit_logger.log_payment_completed(
                user_uid=user_uid if 'user_uid' in locals() else None,
                event_id=event_id,
                payment_id=payment_id,
                amount=float(capture_result.get("amount", 0)),
                successful_registrations=registration_count,
                failed_registrations=0,
                request_ip=client_ip
            )
            
            return {
                "success": True,
                "message": "Payment completed successfully",
                "payment_id": payment_id,
                "registration_count": registration_count,  # Keep for backward compatibility
                "registrations_completed": registration_count,  # Add for consistency with bulk flow
                "registered_people": total_registrations,
                "total_amount": capture_result.get("amount", 0),
                "total_event_fee": capture_result.get("amount", 0),  # For individual flow, all amount is event fee
                "total_donation": 0,  # Individual flow doesn't handle donations separately
                "redirect_url": f"{FRONTEND_URL}/events/{event_id}/payment/success-confirmation",
                "capture_details": capture_result
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error processing PayPal success: {str(e)}")
            
            # Log failed payment completion attempt
            payment_audit_logger.log_paypal_capture_failed(
                payment_id=payment_id,
                error_message=str(e),
                request_ip=client_ip
            )
            
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process payment completion: {str(e)}"
            )

    async def handle_paypal_cancel(
        self,
        event_id: str,
        token: str,
        client_ip: str,
        request
    ) -> Dict[str, Any]:
        """Handle PayPal cancel callback and cleanup"""
        try:
            self.logger.info(f"Processing PayPal cancellation for event {event_id}, token {token}")
            
            # Try to find bulk registration by token (if we stored it) or by status
            bulk_registration = await DB.db["bulk_registrations"].find_one(
                {"status": "pending", "event_id": event_id}
            )
            
            if bulk_registration:
                # Update status to cancelled
                await DB.update_document(
                    "bulk_registrations",
                    {"_id": bulk_registration["_id"]},
                    {
                        "status": "cancelled",
                        "cancelled_at": datetime.now().isoformat(),
                        "cancellation_reason": "user_cancelled_paypal"
                    }
                )
                
                # Log payment cancellation
                payment_audit_logger.log_error(
                    event_type=AuditEventType.PAYMENT_FAILED,
                    user_uid=bulk_registration.get("user_uid"),
                    event_id=event_id,
                    error_message="PayPal payment cancelled by user",
                    request_ip=client_ip
                )
                
                payment_id = bulk_registration.get("payment_id")
            else:
                payment_id = None
                self.logger.warning(f"No pending registration found for event {event_id}")
            
            return {
                "success": True,
                "message": "Payment cancelled successfully",
                "payment_id": payment_id,
                "redirect_url": f"{FRONTEND_URL}/events/{event_id}/payment/cancel"
            }
            
        except Exception as e:
            self.logger.error(f"Error processing PayPal cancellation: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process payment cancellation: {str(e)}"
            )


# Create singleton instance for easy import
event_payment_helper = EventPaymentHelper()