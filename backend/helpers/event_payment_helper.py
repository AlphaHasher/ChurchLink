import logging
import os
import json
import traceback
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from fastapi import HTTPException
from bson import ObjectId

from models.event import get_event_by_id, update_attendee_payment_status, get_event_payment_summary, get_event_registrations_by_payment_status
from models.transaction import Transaction
from helpers.paypalHelper import create_order
from controllers.event_functions import register_rsvp
from mongo.database import DB
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler
from helpers.audit_logger import payment_audit_logger


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
        Checks user roles against event role requirements.
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
            
            # Check if user has required roles for this event
            if event.roles:
                user_role_ids = user.get("roles", [])
                user_role_names = await RoleHandler.ids_to_names(user_role_ids)
                
                # Check if user has at least one required role
                has_required_role = any(role in user_role_names for role in event.roles)
                if not has_required_role:
                    payment_audit_logger.log_access_denied(
                        user_uid=user_uid,
                        event_id=event.id,
                        reason=f"User lacks required roles. Required: {event.roles}, User has: {user_role_names}",
                        attempted_action="event_registration_role_check"
                    )
                    return False, f"You do not have the required roles to register for this event. Required roles: {', '.join(event.roles)}"
            
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
                    access_granted=False,
                    reason="Family member not found or not owned by user"
                )
                return False, "Family member not found or you don't have permission to register them"
            
            payment_audit_logger.log_family_member_access(
                user_uid=user_uid,
                family_member_id=person_id,
                access_granted=True,
                reason="Valid family member access"
            )
            return True, "Family member access granted"
            
        except Exception as e:
            self.logger.error(f"Error validating family member access for user {user_uid}, person {person_id}: {str(e)}")
            payment_audit_logger.log_error(
                event_type=payment_audit_logger.AuditEventType.FAMILY_MEMBER_ACCESS,
                user_uid=user_uid,
                family_member_id=person_id,
                error_message=f"Error validating family member access: {str(e)}",
                exception=e
            )
            return False, "Family member validation error"

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
            required_fields = ["name", "email"]
            for field in required_fields:
                if not registration_data.get(field):
                    return False, f"Missing required field: {field}"
            
            # Validate amounts
            donation_amount = float(registration_data.get("donation_amount", 0) or 0)
            payment_amount_per_person = float(registration_data.get("payment_amount_per_person", 0) or 0)
            
            if donation_amount < 0 or payment_amount_per_person < 0:
                return False, "Amounts cannot be negative"
            
            # Validate person_id if provided (family member)
            person_id = registration_data.get("person_id")
            if person_id:
                try:
                    ObjectId(person_id)
                except:
                    return False, "Invalid person_id format"
            
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
                is_valid, validation_message = await self.validate_registration_data(registration_data, event, user_uid)
                if not is_valid:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Registration {i+1} validation failed: {validation_message}"
                    )
                
                # Calculate amounts
                donation_amount = float(registration_data.get("donation_amount", 0) or 0)
                payment_amount_per_person = float(registration_data.get("payment_amount_per_person", 0) or 0)
                
                total_donation += donation_amount
                total_event_fee += payment_amount_per_person
                
                validated_registrations.append({
                    **registration_data,
                    "donation_amount": donation_amount,
                    "payment_amount_per_person": payment_amount_per_person,
                    "validation_status": "validated"
                })
            
            # Create PayPal order
            paypal_order_data = await self._create_paypal_order_data(
                event=event,
                validated_registrations=validated_registrations,
                total_event_fee=total_event_fee,
                total_donation=total_donation,
                return_url=return_url,
                cancel_url=cancel_url
            )
            
            # Create the order
            order_response = await create_order(paypal_order_data)
            
            if not order_response or "id" not in order_response:
                raise HTTPException(status_code=500, detail="Failed to create PayPal order")
            
            payment_id = order_response["id"]
            
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
                order_id=payment_id,
                total_amount=total_event_fee + total_donation,
                registration_count=len(validated_registrations),
                request_ip=client_ip
            )
            
            # Check for existing transaction
            existing_transaction = await Transaction.get_transaction_by_id(payment_id)
            if existing_transaction and existing_transaction.event_id == event_id:
                self.logger.info(f"Existing transaction found for payment_id: {payment_id}")
                return {
                    "success": True,
                    "order_id": payment_id,
                    "approval_url": order_response.get("approval_url"),
                    "total_amount": existing_transaction.amount,
                    "currency": "USD",
                    "registrations_count": len(validated_registrations),
                    "existing_transaction": True
                }
            
            return {
                "success": True,
                "order_id": payment_id,
                "approval_url": order_response.get("approval_url"),
                "total_amount": total_event_fee + total_donation,
                "currency": "USD",
                "registrations_count": len(validated_registrations),
                "registration_breakdown": {
                    "total_event_fees": total_event_fee,
                    "total_donations": total_donation
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error in bulk payment creation: {str(e)}")
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            payment_audit_logger.log_error(
                event_type=payment_audit_logger.AuditEventType.PAYMENT_ORDER_FAILED,
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
            self.logger.info(f"Completing bulk registration for event: {event_id}")
            
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
                return {
                    "success": True,
                    "message": "Registration already completed",
                    "payment_id": payment_id
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
                    # Register for the event
                    person_id = registration_data.get("person_id")
                    result, reason = await register_rsvp(event_id, user_uid, person_id)
                    
                    if result:
                        registration_data["registration_status"] = "success"
                        registration_data["registration_key"] = result.get("registration_key") if isinstance(result, dict) else None
                        successful_registrations.append(registration_data)
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
            
            return {
                "success": True,
                "message": "Bulk registration completed",
                "payment_id": payment_id,
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
                event_type=payment_audit_logger.AuditEventType.REGISTRATION_FAILED,
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
                    "description": f"Event registration for {event.name} - {len(validated_registrations)} people"
                }],
                "application_context": {
                    "return_url": return_url or "https://example.com/success",
                    "cancel_url": cancel_url or "https://example.com/cancel",
                    "brand_name": "Church Event Registration",
                    "locale": "en-US",
                    "landing_page": "BILLING",
                    "user_action": "PAY_NOW"
                }
            }
            
            return paypal_order_data
            
        except Exception as e:
            self.logger.error(f"Error creating PayPal order data: {str(e)}")
            raise


# Create singleton instance for easy import
event_payment_helper = EventPaymentHelper()