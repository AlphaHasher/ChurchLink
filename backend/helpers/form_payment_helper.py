import logging
import os
import json
import traceback
import requests
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime
from fastapi import HTTPException

from mongo.database import DB
from models.form import get_form_by_slug, get_form_by_id, add_response_by_slug
from models.transaction import Transaction
from config.settings import settings
from helpers.audit_logger import payment_audit_logger
from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url


class FormPaymentHelper:
    """Helper class for form payment operations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def create_form_payment_order(
        self,
        slug: str,
        payment_data: Dict[str, Any],
        client_ip: str,
        user_agent: str
    ) -> Dict[str, Any]:
        """Create PayPal payment order for form submission with payment"""
        try:
            user_id = payment_data.get("user_id", "anonymous")
            payment_amount = payment_data.get("payment_amount", 0)
            
            self.logger.info(f"Creating form payment order for slug: {slug}")
            
            # Log payment initiation
            payment_audit_logger.log_form_payment_started(
                user_id=user_id,
                form_slug=slug,
                amount=payment_amount,
                client_ip=client_ip,
                user_agent=user_agent,
                metadata={
                    "form_response_fields": list(payment_data.get("form_response", {}).keys()),
                    "initiation_phase": "form_validation"
                }
            )
            
            # Get the form by slug
            form = await get_form_by_slug(slug)
            if not form:
                payment_audit_logger.log_form_payment_failed(
                    user_id=user_id,
                    form_slug=slug,
                    error="Form not found",
                    client_ip=client_ip,
                    user_agent=user_agent,
                    metadata={"validation_phase": "form_lookup"}
                )
                raise HTTPException(status_code=404, detail="Form not found")
            
            # Check if form requires payment
            form_requires_payment = await self._validate_form_requires_payment(form, payment_data)
            
            if not form_requires_payment:
                payment_audit_logger.log_form_payment_failed(
                    user_id=user_id,
                    form_slug=slug,
                    error="Form does not require payment",
                    client_ip=client_ip,
                    user_agent=user_agent,
                    metadata={
                        "validation_phase": "payment_requirement_check",
                        "form_title": form.title
                    }
                )
                raise HTTPException(
                    status_code=400,
                    detail="This form does not require payment"
                )
            
            # Validate payment amount
            validated_amount = await self._validate_payment_amount(payment_amount, form, user_id, client_ip)
            
            # Check PayPal configuration
            if not self._check_paypal_config():
                payment_audit_logger.log_form_payment_failed(
                    user_id=user_id,
                    form_slug=slug,
                    error="PayPal not configured",
                    client_ip=client_ip,
                    user_agent=user_agent,
                    metadata={"validation_phase": "paypal_config_check"}
                )
                raise HTTPException(
                    status_code=503,
                    detail="Payment system is not configured. Please contact the administrator."
                )
            
            # Create PayPal order
            paypal_order = await self._create_paypal_order(
                validated_amount,
                form,
                payment_data,
                user_id,
                client_ip
            )
            
            # Store payment session data
            await self._store_payment_session(
                paypal_order["id"],
                slug,
                payment_data,
                validated_amount,
                user_id
            )
            
            # Log successful order creation
            payment_audit_logger.log_form_payment_order_created(
                user_id=user_id,
                form_slug=slug,
                order_id=paypal_order["id"],
                amount=validated_amount,
                client_ip=client_ip,
                metadata={"form_title": form.title}
            )
            
            return {
                "success": True,
                "order_id": paypal_order["id"],
                "approval_url": paypal_order.get("approval_url"),
                "amount": validated_amount,
                "currency": "USD",
                "form_title": form.title
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error creating form payment order for {slug}: {str(e)}")
            payment_audit_logger.log_form_payment_failed(
                user_id=payment_data.get("user_id", "anonymous"),
                form_slug=slug,
                error=f"Order creation failed: {str(e)}",
                client_ip=client_ip,
                user_agent=user_agent,
                metadata={"exception": str(e)}
            )
            raise HTTPException(status_code=500, detail=f"Failed to create payment order: {str(e)}")

    async def complete_form_submission(
        self,
        slug: str,
        completion_data: Dict[str, Any],
        client_ip: str
    ) -> Dict[str, Any]:
        """Complete form submission after payment processing"""
        try:
            user_id = completion_data.get("user_id", "anonymous")
            payment_id = completion_data.get("payment_id")
            
            self.logger.info(f"Completing form submission for slug: {slug}, payment_id: {payment_id}")
            
            # Get the form
            form = await get_form_by_slug(slug)
            if not form:
                raise HTTPException(status_code=404, detail="Form not found")
            
            # Retrieve payment session data
            payment_session = await self._get_payment_session(payment_id)
            if not payment_session:
                raise HTTPException(status_code=404, detail="Payment session not found")
            
            # Submit the form response
            form_response = completion_data.get("form_response", {})
            submission_result = await self._submit_form_response(
                slug,
                form_response,
                payment_session,
                user_id,
                client_ip
            )
            
            # Create transaction record
            transaction = await self._create_transaction_record(
                payment_id,
                payment_session,
                form,
                user_id
            )
            
            # Log successful completion
            payment_audit_logger.log_form_submission_completed(
                user_id=user_id,
                form_slug=slug,
                payment_id=payment_id,
                submission_id=submission_result.get("submission_id"),
                client_ip=client_ip
            )
            
            return {
                "success": True,
                "message": "Form submission completed successfully",
                "payment_id": payment_id,
                "submission_id": submission_result.get("submission_id"),
                "transaction_id": transaction.id if transaction else None
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error completing form submission for {slug}: {str(e)}")
            payment_audit_logger.log_form_payment_failed(
                user_id=completion_data.get("user_id", "anonymous"),
                form_slug=slug,
                error=f"Submission completion failed: {str(e)}",
                client_ip=client_ip,
                user_agent="",
                metadata={"payment_id": completion_data.get("payment_id")}
            )
            raise HTTPException(status_code=500, detail=f"Failed to complete form submission: {str(e)}")

    async def complete_paypal_payment(
        self,
        slug: str,
        completion_data: Dict[str, Any],
        client_ip: str
    ) -> Dict[str, Any]:
        """Complete PayPal payment and finalize form submission"""
        try:
            payment_id = completion_data.get("payment_id")
            payer_id = completion_data.get("PayerID")
            
            self.logger.info(f"Completing PayPal payment for slug: {slug}, payment_id: {payment_id}")
            
            # Verify PayPal payment
            payment_details = await self._verify_paypal_payment(payment_id, payer_id)
            
            # Get payment session
            payment_session = await self._get_payment_session(payment_id)
            if not payment_session:
                raise HTTPException(status_code=404, detail="Payment session not found")
            
            # Get form
            form = await get_form_by_slug(slug)
            if not form:
                raise HTTPException(status_code=404, detail="Form not found")
            
            # Submit form with payment details
            submission_result = await self._finalize_form_submission(
                slug,
                payment_session,
                payment_details,
                client_ip
            )
            
            # Create final transaction record
            transaction = await self._create_final_transaction(
                payment_id,
                payment_session,
                payment_details,
                form
            )
            
            # Clean up payment session
            await self._cleanup_payment_session(payment_id)
            
            return {
                "success": True,
                "message": "Payment completed and form submitted successfully",
                "payment_id": payment_id,
                "submission_id": submission_result.get("submission_id"),
                "transaction_id": transaction.id if transaction else None
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error completing PayPal payment for {slug}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to complete PayPal payment: {str(e)}")

    async def get_form_payment_summary(
        self,
        form_id: str,
        user_id: str,
        client_ip: str
    ) -> Dict[str, Any]:
        """Get payment summary for a form"""
        try:
            # Log summary request
            payment_audit_logger.log_admin_action(
                user_id=user_id,
                action="form_payment_summary_request",
                details={"form_id": form_id},
                request_ip=client_ip
            )
            
            # Get form
            form = await get_form_by_id(form_id)
            if not form:
                raise HTTPException(status_code=404, detail="Form not found")
            
            # Get payment statistics
            stats = await self._get_form_payment_statistics(form_id)
            
            return {
                "success": True,
                "form_id": form_id,
                "form_title": form.title,
                "payment_summary": stats
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error getting form payment summary for {form_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get payment summary: {str(e)}")

    async def get_form_payment_config(
        self,
        slug: str,
        client_ip: str
    ) -> Dict[str, Any]:
        """Get payment configuration for a form"""
        try:
            # Get form
            form = await get_form_by_slug(slug)
            if not form:
                raise HTTPException(status_code=404, detail="Form not found")
            
            # Check payment requirements
            requires_payment = await self._validate_form_requires_payment(form, {})
            
            # Get PayPal config status
            paypal_configured = self._check_paypal_config()
            
            return {
                "success": True,
                "form_slug": slug,
                "form_title": form.title,
                "requires_payment": requires_payment,
                "paypal_configured": paypal_configured,
                "payment_methods": ["paypal"] if paypal_configured else []
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error getting form payment config for {slug}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get payment config: {str(e)}")

    # =============================================================================
    # PRIVATE HELPER METHODS
    # =============================================================================

    async def _validate_form_requires_payment(self, form, payment_data: Dict[str, Any]) -> bool:
        """Validate if form requires payment"""
        # First check the explicit requires_payment flag
        form_requires_payment = getattr(form, 'requires_payment', False)
        
        # If not explicitly set, check if form has price fields in schema
        if not form_requires_payment and hasattr(form, 'data') and form.data:
            schema_data = form.data if isinstance(form.data, list) else []
            has_price_fields = any(field.get('type') == 'price' for field in schema_data if isinstance(field, dict))
            form_requires_payment = has_price_fields
        
        # Also check if the frontend is sending schema information about price fields
        form_schema = payment_data.get("form_schema", [])
        if not form_requires_payment and form_schema:
            has_price_fields_in_request = any(field.get('type') == 'price' for field in form_schema)
            form_requires_payment = has_price_fields_in_request
        
        return form_requires_payment

    async def _validate_payment_amount(self, payment_amount: float, form, user_id: str, client_ip: str) -> float:
        """Validate and return the payment amount"""
        try:
            amount = float(payment_amount)
            if amount <= 0:
                raise ValueError("Payment amount must be greater than 0")
            if amount > 10000:  # Security limit
                raise ValueError("Payment amount exceeds maximum limit")
            return amount
        except (ValueError, TypeError) as e:
            payment_audit_logger.log_form_payment_failed(
                user_id=user_id,
                form_slug=getattr(form, 'slug', 'unknown'),
                error=f"Invalid payment amount: {str(e)}",
                client_ip=client_ip,
                user_agent="",
                metadata={"validation_phase": "amount_validation", "amount": payment_amount}
            )
            raise HTTPException(status_code=400, detail=f"Invalid payment amount: {str(e)}")

    def _check_paypal_config(self) -> bool:
        """Check if PayPal is properly configured"""
        client_id = os.getenv("PAYPAL_CLIENT_ID")
        client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
        return bool(client_id and client_secret)

    async def _create_paypal_order(
        self,
        amount: float,
        form,
        payment_data: Dict[str, Any],
        user_id: str,
        client_ip: str
    ) -> Dict[str, Any]:
        """Create PayPal order"""
        try:
            # Get PayPal access token
            access_token = get_paypal_access_token()
            if not access_token:
                raise HTTPException(status_code=503, detail="Failed to get PayPal access token")
            
            # Build PayPal order request
            order_request = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {
                        "currency_code": "USD",
                        "value": f"{amount:.2f}"
                    },
                    "description": f"Form submission payment for {form.title}"
                }],
                "application_context": {
                    "return_url": payment_data.get("return_url", f"{settings.FRONTEND_URL}/forms/{form.slug}/payment/success"),
                    "cancel_url": payment_data.get("cancel_url", f"{settings.FRONTEND_URL}/forms/{form.slug}/payment/cancel"),
                    "brand_name": "Church Form Payment",
                    "locale": "en-US",
                    "landing_page": "BILLING",
                    "user_action": "PAY_NOW"
                }
            }
            
            # Make PayPal API call
            base_url = get_paypal_base_url()
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            response = requests.post(
                f"{base_url}/v2/checkout/orders",
                headers=headers,
                json=order_request
            )
            
            if response.status_code != 201:
                raise HTTPException(status_code=500, detail="Failed to create PayPal order")
            
            order_data = response.json()
            
            # Add approval URL
            for link in order_data.get("links", []):
                if link.get("rel") == "approve":
                    order_data["approval_url"] = link.get("href")
                    break
            
            return order_data
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error creating PayPal order: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create PayPal order: {str(e)}")

    async def _store_payment_session(
        self,
        payment_id: str,
        slug: str,
        payment_data: Dict[str, Any],
        amount: float,
        user_id: str
    ) -> None:
        """Store payment session data"""
        session_data = {
            "payment_id": payment_id,
            "form_slug": slug,
            "user_id": user_id,
            "amount": amount,
            "form_response": payment_data.get("form_response", {}),
            "created_at": datetime.now().isoformat(),
            "status": "pending"
        }
        
        await DB.insert_document("payment_sessions", session_data)

    async def _get_payment_session(self, payment_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve payment session data"""
        return await DB.get_document("payment_sessions", {"payment_id": payment_id})

    async def _submit_form_response(
        self,
        slug: str,
        form_response: Dict[str, Any],
        payment_session: Dict[str, Any],
        user_id: str,
        client_ip: str
    ) -> Dict[str, Any]:
        """Submit form response"""
        try:
            # Add payment information to form response
            enriched_response = {
                **form_response,
                "payment_status": "completed",
                "payment_id": payment_session["payment_id"],
                "payment_amount": payment_session["amount"],
                "submitted_at": datetime.now().isoformat(),
                "user_id": user_id,
                "client_ip": client_ip
            }
            
            # Submit to form system
            submission_id = await add_response_by_slug(slug, enriched_response)
            
            return {"submission_id": submission_id}
            
        except Exception as e:
            self.logger.error(f"Error submitting form response: {str(e)}")
            raise

    async def _create_transaction_record(
        self,
        payment_id: str,
        payment_session: Dict[str, Any],
        form,
        user_id: str
    ) -> Optional[Transaction]:
        """Create transaction record"""
        try:
            transaction = Transaction(
                transaction_id=payment_id,
                user_email=payment_session.get("user_email", ""),
                amount=payment_session["amount"],
                status="COMPLETED",
                type="one-time",
                order_id=payment_id,
                payment_method="paypal",
                time=datetime.now().isoformat(),
                name=payment_session.get("user_name", ""),
                fund_name="form_submission",
                currency="USD",
                event_type="form_payment",
                form_id=str(form.id) if hasattr(form, 'id') else None,
                form_slug=form.slug,
                payment_type="form_submission",
                user_uid=user_id
            )
            
            return await Transaction.create_transaction(transaction)
            
        except Exception as e:
            self.logger.error(f"Error creating transaction record: {str(e)}")
            return None

    async def _verify_paypal_payment(self, payment_id: str, payer_id: str) -> Dict[str, Any]:
        """Verify PayPal payment completion"""
        try:
            access_token = get_paypal_access_token()
            if not access_token:
                raise HTTPException(status_code=503, detail="Failed to get PayPal access token")
            
            base_url = get_paypal_base_url()
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            # Capture the payment
            response = requests.post(
                f"{base_url}/v2/checkout/orders/{payment_id}/capture",
                headers=headers
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=400, detail="Failed to capture PayPal payment")
            
            return response.json()
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error verifying PayPal payment: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to verify payment: {str(e)}")

    async def _finalize_form_submission(
        self,
        slug: str,
        payment_session: Dict[str, Any],
        payment_details: Dict[str, Any],
        client_ip: str
    ) -> Dict[str, Any]:
        """Finalize form submission with payment details"""
        return await self._submit_form_response(
            slug,
            payment_session.get("form_response", {}),
            payment_session,
            payment_session.get("user_id", "anonymous"),
            client_ip
        )

    async def _create_final_transaction(
        self,
        payment_id: str,
        payment_session: Dict[str, Any],
        payment_details: Dict[str, Any],
        form
    ) -> Optional[Transaction]:
        """Create final transaction record with PayPal details"""
        return await self._create_transaction_record(
            payment_id,
            payment_session,
            form,
            payment_session.get("user_id", "anonymous")
        )

    async def _cleanup_payment_session(self, payment_id: str) -> None:
        """Clean up payment session data"""
        await DB.delete_document("payment_sessions", {"payment_id": payment_id})

    async def _get_form_payment_statistics(self, form_id: str) -> Dict[str, Any]:
        """Get payment statistics for a form"""
        try:
            # Get transactions for this form
            transactions = await DB.get_documents("transactions", {"form_id": form_id})
            
            total_amount = sum(tx.get("amount", 0) for tx in transactions)
            successful_payments = len([tx for tx in transactions if tx.get("status") == "COMPLETED"])
            failed_payments = len([tx for tx in transactions if tx.get("status") != "COMPLETED"])
            
            return {
                "total_revenue": total_amount,
                "successful_payments": successful_payments,
                "failed_payments": failed_payments,
                "total_transactions": len(transactions),
                "average_payment": total_amount / len(transactions) if transactions else 0
            }
            
        except Exception as e:
            self.logger.error(f"Error getting form payment statistics: {str(e)}")
            return {
                "total_revenue": 0,
                "successful_payments": 0,
                "failed_payments": 0,
                "total_transactions": 0,
                "average_payment": 0
            }


# Create singleton instance for easy import
form_payment_helper = FormPaymentHelper()