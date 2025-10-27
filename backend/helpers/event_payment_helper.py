import logging
import os
import traceback
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from fastapi import HTTPException
from bson import ObjectId

from models.event import get_event_by_id, get_event_payment_summary, rsvp_list, update_attendee_payment_status, generate_attendee_key
from models.transaction import Transaction, PaymentStatus, RegistrationPaymentStatus
from models.bulk_transaction import TransactionManager
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
            name = registration_data.get("name")
            if not name:
                return False, "Missing required field: name"
            
            # Validate name format (basic validation for reasonable characters)
            import re
            if not re.match(r"^[a-zA-Z\s\-\.\']+$", name.strip()):
                return False, "Name contains invalid characters. Only letters, spaces, hyphens, dots, and apostrophes are allowed"
            
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
            
            
            if not registrations:
                raise HTTPException(status_code=400, detail="No registrations provided")
            
            
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
                if not registration_email:
                    registration_email = user.get("email") if user else None
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

    def _extract_person_info_from_registrations(self, registrations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract standardized person info from registration data"""
        completed_people = []
        for registration in registrations:
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
        return completed_people

    async def complete_bulk_registration(
        self,
        event_id: str,
        user_uid: str,
        completion_data: Dict[str, Any],
        client_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Complete bulk event registration after successful payment"""
        try:
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
            
            # Check if already completed and return early
            if bulk_registration.get("status") == "completed":
                # Calculate total amount safely for already completed registration
                total_event_fee = float(bulk_registration.get("total_event_fee", 0) or 0)
                total_donation = float(bulk_registration.get("total_donation", 0) or 0)
                total_amount = total_event_fee + total_donation
                
                # Extract registration details with names for already completed
                completed_registrations = bulk_registration.get("registrations", [])
                completed_people = self._extract_person_info_from_registrations(completed_registrations)
                
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
                self.logger.error(f"Event not found for event_id: {event_id}")
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
                    result, reason = await register_rsvp(event_id, user_uid, person_id, payment_option="paypal", transaction_id=payment_id)
                    
                    if result:
                        registration_data["registration_status"] = "success"
                        registration_data["registration_key"] = result.get("registration_key") if isinstance(result, dict) else None
                        successful_registrations.append(registration_data)
                        
                        # Update payment status immediately after successful registration
                        # Webhooks are reserved for external events (refunds, disputes, cancellations from PayPal website)
                        # Direct updates provide immediate feedback and reliability for normal payment flow
                        try:
                                                        
                            person_object_id = ObjectId(person_id) if person_id else None
                            person_id_str = str(person_object_id) if person_object_id else 'self'
                            scope = "series" if getattr(event, "is_recurring", False) else "occurrence"
                            attendee_key = generate_attendee_key(user_uid, person_id_str, "rsvp", scope)
                            
                            payment_updated = await update_attendee_payment_status(
                                event_id=event_id,
                                attendee_key=attendee_key,
                                payment_status=PaymentStatus.COMPLETED,
                                transaction_id=payment_id
                            )
                            
                            if payment_updated:
                                self.logger.info(f"✅ Payment status updated immediately for {registration_data.get('name')}")
                            else:
                                self.logger.warning(f"⚠️ Failed to update payment status for {registration_data.get('name')}")
                                
                        except Exception as status_error:
                            self.logger.error(f"Error updating payment status for {registration_data.get('name')}: {str(status_error)}")
                            # Don't fail the registration if payment status update fails
                        
                    else:
                        registration_data["registration_status"] = "failed"
                        registration_data["failure_reason"] = reason
                        failed_registrations.append(registration_data)
                        
                except Exception as reg_error:
                    self.logger.error(f"Registration error for {registration_data.get('name')}: {str(reg_error)}")
                    registration_data["registration_status"] = "failed"
                    registration_data["failure_reason"] = str(reg_error)
                    failed_registrations.append(registration_data)
            
            # Record payment transaction for successful registrations using new bulk structure
            if successful_registrations:
                total_event_fee = bulk_registration.get("total_event_fee", 0)
                total_donation = bulk_registration.get("total_donation", 0)
                total_amount = total_event_fee + total_donation
                per_person_amount = total_event_fee / len(successful_registrations) if successful_registrations else 0
                
                # Prepare attendee data for bulk transaction
                attendee_registrations = []
                for registration in successful_registrations:
                    # Generate attendee key for each registration
                    person_id = registration.get("person_id") or registration.get("family_member_id")
                    person_object_id = ObjectId(person_id) if person_id else None
                    person_id_str = str(person_object_id) if person_object_id else 'self'
                    scope = "series" if getattr(event, "is_recurring", False) else "occurrence"
                    attendee_key = generate_attendee_key(user_uid, person_id_str, "rsvp", scope)
                    
                    attendee_registrations.append({
                        "key": attendee_key,
                        "display_name": registration.get("name", "Unknown"),
                        "user_uid": user_uid,
                        "person_id": person_id
                    })
                
                # Create bulk transaction structure
                bulk_result = await TransactionManager.create_transaction_structure(
                    parent_transaction_id=payment_id,
                    attendee_registrations=attendee_registrations,
                    total_amount=total_amount,
                    per_person_amount=per_person_amount,
                    user_email=successful_registrations[0].get("email", ""),
                    event_id=event_id,
                    event_name=event.name,
                    payment_method="paypal"
                )
                
                if bulk_result.get("success"):
                    # Update attendees with their individual child transaction IDs
                    child_transactions = bulk_result.get("child_transactions", [])
                    for i, child_tx in enumerate(child_transactions):
                        if i < len(attendee_registrations):
                            attendee_key = attendee_registrations[i]["key"]
                            # Update attendee record with child transaction ID
                            # child_tx can be either a Transaction object or a dict, handle both
                            transaction_id = child_tx.transaction_id if hasattr(child_tx, 'transaction_id') else child_tx.get('transaction_id')
                            await Transaction.update_attendee_transaction_reference(
                                event_id, attendee_key, transaction_id
                            )
                    
                    self.logger.info(f"✅ Bulk transaction structure created successfully for {len(successful_registrations)} attendees")
                else:
                    self.logger.error(f"❌ Failed to create bulk transaction structure: {bulk_result.get('error')}")
                    raise Exception(f"Failed to create bulk transaction structure: {bulk_result.get('error')}")
            
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
            
            
            # Extract registration details with names using helper method
            completed_people = self._extract_person_info_from_registrations(successful_registrations)
            
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
            
            # Get registrations by payment status using centralized approach
            registrations = await Transaction.get_event_registrations_by_payment_status(event_id, payment_status)
            
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
        """
        Update payment status for a specific registration (admin only).
        
        Uses transaction_id as single source of truth for payment status.
        """
        try:
            # Get the event
            event = await get_event_by_id(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            transaction_id = status_data.get("transaction_id")
            
            if not transaction_id:
                raise HTTPException(
                    status_code=400,
                    detail="transaction_id is required"
                )
            
            # Update attendee with transaction reference
            updated = await Transaction.update_attendee_transaction_reference(
                event_id=event_id,
                attendee_key=registration_key,
                transaction_id=transaction_id
            )
            
            if updated:
                # Get the actual payment status from the transaction
                actual_status = await Transaction.get_attendee_payment_status(event_id, registration_key)
                
                return {
                    "success": True,
                    "message": "Payment transaction reference updated successfully",
                    "event_id": event_id,
                    "registration_key": registration_key,
                    "transaction_id": transaction_id,
                    "computed_payment_status": actual_status
                }
            else:
                raise HTTPException(
                    status_code=404,
                    detail="Registration not found or failed to update"
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
            
            # Try to find the bulk_registrations record by payment_id (order ID) or token
            try:
                bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": payment_id})
                if not bulk_registration and token:
                    bulk_registration = await DB.db["bulk_registrations"].find_one({"payment_id": token})
                
                if not bulk_registration:
                    raise HTTPException(status_code=404, detail="Bulk registration not found")
                
                # Handle bulk registration flow with new transaction system
                registration_count = len(bulk_registration.get("registrations", []))
                raw_registrations = bulk_registration.get("registrations", [])
                user_uid = bulk_registration.get("user_uid")
                
                # Get the event for scope calculation
                event = await get_event_by_id(event_id)
                if not event:
                    self.logger.error(f"Event not found for event_id: {event_id}")
                    raise HTTPException(status_code=404, detail="Event not found")
                
                # First, ensure user record has my_events array initialized
                try:
                    # Ensure the user has a my_events array
                    await DB.db["users"].update_one(
                        {"uid": user_uid},
                        {"$setOnInsert": {"my_events": []}},
                        upsert=False  # Don't create user, just update if exists
                    )
                    # Also ensure my_events field exists if user exists but field is missing
                    await DB.db["users"].update_one(
                        {"uid": user_uid, "my_events": {"$exists": False}},
                        {"$set": {"my_events": []}}
                    )
                    self.logger.info(f"✅ User my_events array verified for {user_uid}")
                except Exception as user_init_error:
                    self.logger.error(f"❌ Failed to initialize my_events array for {user_uid}: {str(user_init_error)}")
                    # Continue anyway - the registration might still work
                
                # Register each person to the event after payment confirmation
                successful_registrations = []
                failed_registrations = []
                
                for registration_data in raw_registrations:
                    try:
                        # Register for the event - handle both person_id and family_member_id
                        person_id = registration_data.get("person_id") or registration_data.get("family_member_id")
                        display_name = registration_data.get("name") or registration_data.get("display_name")
                        
                        # Register this person to the event with correct scope
                        scope = "series" if getattr(event, "is_recurring", False) else "occurrence"
                        result, reason = await register_rsvp(
                            event_id=event_id, 
                            uid=user_uid, 
                            person_id=person_id,
                            scope=scope,
                            payment_option="paypal", 
                            transaction_id=payment_id  # Will be updated with child transaction ID later
                        )
                        
                        if result:
                            registration_data["registration_status"] = "success"
                            registration_data["registration_key"] = result.get("registration_key") if isinstance(result, dict) else None
                            successful_registrations.append(registration_data)
                            self.logger.info(f"✅ Successfully registered {display_name} for event")
                            
                            # Verify my_events was created
                            try:
                                user_events = await UserHandler.list_my_events(user_uid, expand=False, person_id=ObjectId(person_id) if person_id else None)
                                event_found = any(event.get("event_id") == ObjectId(event_id) for event in user_events)
                                if event_found:
                                    self.logger.info(f"✅ my_events record created successfully for {display_name}")
                                else:
                                    self.logger.warning(f"⚠️ my_events record not found for {display_name} - attempting manual creation")
                                    # Manually create the my_events record as fallback
                                    try:
                                        await UserHandler.add_to_my_events(
                                            uid=user_uid,
                                            event_id=ObjectId(event_id),
                                            reason="rsvp",
                                            scope=scope,  # Use the same scope as the registration
                                            person_id=ObjectId(person_id) if person_id else None
                                        )
                                        self.logger.info(f"✅ Manual my_events record created for {display_name}")
                                    except Exception as manual_error:
                                        self.logger.error(f"❌ Failed to manually create my_events record for {display_name}: {str(manual_error)}")
                            except Exception as verify_error:
                                self.logger.error(f"❌ Error verifying my_events creation for {display_name}: {str(verify_error)}")
                                
                        else:
                            self.logger.error(f"❌ Failed to register {display_name}: {reason}")
                            registration_data["registration_status"] = "failed"
                            registration_data["failure_reason"] = reason
                            failed_registrations.append(registration_data)
                            
                    except Exception as reg_error:
                        self.logger.error(f"Registration error for {registration_data.get('name')}: {str(reg_error)}")
                        registration_data["registration_status"] = "failed"
                        registration_data["failure_reason"] = str(reg_error)
                        failed_registrations.append(registration_data)
                
                # Create bulk transaction structure for successful registrations
                if successful_registrations:
                    total_event_fee = bulk_registration.get("total_event_fee", 0)
                    total_donation = bulk_registration.get("total_donation", 0)
                    total_amount = total_event_fee + total_donation
                    per_person_amount = total_event_fee / len(successful_registrations) if successful_registrations else 0
                    
                    # Prepare attendee data for bulk transaction
                    attendee_registrations = []
                    for registration in successful_registrations:
                        # Generate attendee key for each registration
                        person_id = registration.get("person_id") or registration.get("family_member_id")
                        person_object_id = ObjectId(person_id) if person_id else None
                        person_id_str = str(person_object_id) if person_object_id else 'self'
                        scope = "series" if getattr(event, "is_recurring", False) else "occurrence"
                        attendee_key = generate_attendee_key(user_uid, person_id_str, "rsvp", scope)
                        
                        attendee_registrations.append({
                            "key": attendee_key,
                            "display_name": registration.get("name", "Unknown"),
                            "user_uid": user_uid,
                            "person_id": person_id
                        })
                    
                    # Create bulk transaction structure
                    bulk_result = await TransactionManager.create_transaction_structure(
                        parent_transaction_id=payment_id,
                        attendee_registrations=attendee_registrations,
                        total_amount=total_amount,
                        per_person_amount=per_person_amount,
                        user_email=capture_result.get("payer_email", ""),
                        event_id=event_id,
                        event_name=event.name,
                        payment_method="paypal"
                    )
                    
                    if bulk_result.get("success"):
                        # Update attendees with their individual child transaction IDs
                        child_transactions = bulk_result.get("child_transactions", [])
                        for i, child_tx in enumerate(child_transactions):
                            if i < len(attendee_registrations):
                                attendee_key = attendee_registrations[i]["key"]
                                # Update attendee record with child transaction ID
                                # child_tx can be either a Transaction object or a dict, handle both
                                transaction_id = child_tx.transaction_id if hasattr(child_tx, 'transaction_id') else child_tx.get('transaction_id')
                                await Transaction.update_attendee_transaction_reference(
                                    event_id, attendee_key, transaction_id
                                )
                        
                        self.logger.info(f"✅ Bulk transaction structure created successfully for {len(successful_registrations)} attendees")
                    else:
                        self.logger.error(f"❌ Failed to create bulk transaction structure: {bulk_result.get('error')}")
                        raise Exception(f"Failed to create bulk transaction structure: {bulk_result.get('error')}")
                
                # Transform registrations to expected format for response
                total_registrations = []
                for reg in successful_registrations:
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
                
                self.logger.info(f"Found bulk registration with {len(successful_registrations)} successful registrations")
                
            except Exception as e:
                self.logger.error(f"Error processing bulk registration: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to process bulk registration: {str(e)}")

            # Log successful payment completion
            payment_audit_logger.log_payment_completed(
                user_uid=user_uid,
                event_id=event_id,
                payment_id=payment_id,
                amount=float(capture_result.get("amount", 0)),
                successful_registrations=len(successful_registrations) if successful_registrations else 0,
                failed_registrations=len(failed_registrations) if failed_registrations else 0,
                request_ip=client_ip
            )
            
            return {
                "success": True,
                "message": "Payment completed successfully",
                "payment_id": payment_id,
                "registrations_completed": len(successful_registrations) if successful_registrations else 0,
                "registered_people": total_registrations,
                "total_amount": capture_result.get("amount", 0),
                "total_event_fee": bulk_registration.get("total_event_fee", 0),
                "total_donation": bulk_registration.get("total_donation", 0),
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