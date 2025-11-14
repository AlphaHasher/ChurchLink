import logging
import os
import json
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from fastapi import HTTPException

from mongo.database import DB
from models.form import (
    get_form_by_slug,
    get_form_by_id,
    add_response_by_slug,
    get_form_by_id_unrestricted,
    _canonicalize_response,
    _evaluate_visibility,
)
from models.transaction import Transaction, PaymentStatus

from helpers.audit_logger import payment_audit_logger
from helpers.paypalHelper import get_paypal_access_token, get_paypal_base_url


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

class FormPaymentHelper:
    """Helper class for form payment operations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def calculate_total_amount(self, form_schema: Dict[str, Any], form_response: Dict[str, Any]) -> float:
        """
        Calculate the total payment amount from form schema and user responses.
        Looks at all price fields in the form and sums them up.
        
        Args:
            form_schema: The form schema containing field definitions
            form_response: User's form responses
            
        Returns:
            float: Total amount to be charged
            
        Raises:
            ValueError: If price calculation fails or results in invalid amount
        """
        try:
            total_amount = 0.0
            
            # Get form data fields
            schema_data = form_schema.get('data', [])
            if not isinstance(schema_data, list):
                self.logger.warning("Form schema data is not a list")
                return 0.0
            
            # Find all price fields and sum their amounts
            for field in schema_data:
                if not isinstance(field, dict):
                    continue
                    
                if field.get('type') == 'price':
                    field_id = field.get('id')
                    if not field_id:
                        continue
                    
                    # Get the price from the field definition (not from user input for security)
                    price = field.get('amount', field.get('price', 0))
                    
                    # Check if user selected this field (for optional price fields)
                    # If the field is in the response, it means the user selected it
                    if field_id in form_response:
                        try:
                            amount = float(price)
                            if amount > 0:
                                total_amount += amount
                                self.logger.debug(f"Added price field {field_id}: ${amount:.2f}")
                        except (ValueError, TypeError):
                            self.logger.warning(f"Invalid price value for field {field_id}: {price}")
                            continue
            
            # Validate final amount
            if total_amount < 0:
                raise ValueError("Total amount cannot be negative")
            if total_amount > 10000:  # Security limit
                raise ValueError("Total amount exceeds maximum limit of $10,000")
                
            self.logger.info(f"Calculated total amount: ${total_amount:.2f}")
            return total_amount
            
        except Exception as e:
            self.logger.error(f"Error calculating total amount: {str(e)}")
            raise ValueError(f"Failed to calculate payment amount: {str(e)}")

    async def compute_expected_payment(
        self,
        form_id: str,
        user_response: Dict[str, Any],
        *,
        respect_visibility: bool = True,
    ) -> float:
        """Return the authoritative payment total for a form submission.

        Args:
            form_id: Identifier of the form to evaluate.
            user_response: Raw response payload supplied by the submitter.
            respect_visibility: When True, ignore fields hidden by visibility rules.

        Returns:
            The total amount owed for the supplied response.

        Raises:
            ValueError: When the form cannot be located, the schema is invalid,
                or the response references options that do not exist.
        """

        form = await get_form_by_id_unrestricted(form_id)
        if not form:
            raise ValueError("Form not found")

        schema_fields = getattr(form, "data", None)
        if not isinstance(schema_fields, list):
            raise ValueError("Stored form schema is invalid; expected a list of fields")

        canonical_response = _canonicalize_response(user_response or {})
        running_total = Decimal("0")

        for field in schema_fields:
            if not isinstance(field, dict):
                continue

            if respect_visibility:
                visible_if = field.get("visibleIf")
                if not _evaluate_visibility(visible_if, canonical_response):
                    continue

            try:
                running_total += self._calculate_field_total(field, canonical_response)
            except ValueError as exc:
                context = field.get("label") or field.get("name") or field.get("id") or "field"
                raise ValueError(f"{context}: {exc}") from exc

        if running_total < Decimal("0"):
            raise ValueError("Computed total cannot be negative")

        return float(running_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    @classmethod
    def _calculate_field_total(cls, field: Dict[str, Any], responses: Dict[str, Any]) -> Decimal:
        field_type = (field.get("type") or "").lower()
        context = field.get("label") or field.get("name") or field.get("id") or "field"
        name = field.get("name")

        if field_type == "price":
            return cls._to_decimal(field.get("amount"), context)

        if field_type == "pricelabel":
            # Pricelabel rows are reflected in the auto-managed price summary field.
            return Decimal("0")

        if field_type in {"checkbox", "switch"}:
            if not name:
                return Decimal("0")
            if not cls._is_checked(responses.get(name)):
                return Decimal("0")
            return cls._to_decimal(field.get("price"), context)

        if field_type == "radio":
            if not name:
                return Decimal("0")
            return cls._calculate_option_total(field, responses.get(name), allow_multiple=False, context=context)

        if field_type == "select":
            if not name:
                return Decimal("0")
            allow_multiple = bool(field.get("multiple"))
            return cls._calculate_option_total(field, responses.get(name), allow_multiple=allow_multiple, context=context)

        if field_type == "date":
            if not name:
                return Decimal("0")
            return cls._calculate_date_total(field, responses.get(name), context=context)

        return Decimal("0")

    @classmethod
    def _calculate_option_total(
        cls,
        field: Dict[str, Any],
        raw_value: Any,
        *,
        allow_multiple: bool,
        context: str,
    ) -> Decimal:
        options = field.get("options") or []
        if not isinstance(options, list):
            raise ValueError("options configuration is invalid")

        option_map: Dict[str, Dict[str, Any]] = {}
        for option in options:
            if not isinstance(option, dict):
                continue
            normalized_value = cls._normalize_option_value(option.get("value"))
            if normalized_value is None:
                continue
            option_map[normalized_value] = option

        if raw_value in (None, "", "__clear__"):
            return Decimal("0")

        values = cls._collect_select_values(raw_value, allow_multiple, context)
        total = Decimal("0")

        for value in values:
            normalized_value = cls._normalize_option_value(value)
            if normalized_value not in option_map:
                raise ValueError(f"invalid selection '{value}'")
            price = option_map[normalized_value].get("price")
            if price in (None, "", 0, "0"):
                continue
            option_label = option_map[normalized_value].get("label") or option_map[normalized_value].get("value")
            option_context = f"{context} option '{option_label}'"
            total += cls._to_decimal(price, option_context)

        return total

    @classmethod
    def _collect_select_values(cls, raw_value: Any, allow_multiple: bool, context: str) -> List[Any]:
        if allow_multiple:
            if isinstance(raw_value, (list, tuple, set)):
                iterable = list(raw_value)
            elif isinstance(raw_value, str):
                stripped = raw_value.strip()
                if not stripped:
                    return []
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        iterable = parsed
                    else:
                        iterable = [raw_value]
                except json.JSONDecodeError:
                    iterable = [part.strip() for part in stripped.split(",") if part.strip()]
            else:
                raise ValueError("expected an array of selections")
        else:
            if isinstance(raw_value, (list, tuple, set)):
                if len(raw_value) > 1:
                    raise ValueError("multiple selections supplied to single-select field")
                iterable = list(raw_value)
            else:
                iterable = [raw_value]

        cleaned: List[Any] = []
        for value in iterable:
            if value in (None, "", "__clear__"):
                continue
            cleaned.append(value)
        return cleaned

    @staticmethod
    def _normalize_option_value(value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, bool):
            return "true" if value else "false"
        return str(value).strip()

    @classmethod
    def _calculate_date_total(cls, field: Dict[str, Any], raw_value: Any, context: str) -> Decimal:
        pricing = field.get("pricing") or {}
        if not isinstance(pricing, dict) or not pricing.get("enabled"):
            return Decimal("0")

        selected_dates = cls._extract_dates(field, raw_value, context)
        if not selected_dates:
            return Decimal("0")

        price_lookup = cls._build_date_price_lookup(pricing, context)
        total = Decimal("0")
        for selected_date in selected_dates:
            total += price_lookup(selected_date)
        return total

    @classmethod
    def _extract_dates(cls, field: Dict[str, Any], raw_value: Any, context: str) -> List[date]:
        mode = (field.get("mode") or "single").lower()
        if mode == "range":
            if not isinstance(raw_value, dict):
                raise ValueError("expected an object with 'from' and 'to' keys for date range selection")
            start = cls._parse_date_value(raw_value.get("from"), context)
            end = cls._parse_date_value(raw_value.get("to"), context)
            if start is None and end is None:
                return []
            if start is None or end is None:
                return [start or end]
            if end < start:
                raise ValueError("end date must be on or after start date")
            dates: List[date] = []
            cursor = start
            while cursor <= end:
                dates.append(cursor)
                cursor += timedelta(days=1)
            return dates

        parsed = cls._parse_date_value(raw_value, context)
        return [parsed] if parsed else []

    @staticmethod
    def _parse_date_value(value: Any, context: str) -> Optional[date]:
        if value in (None, "", {}):
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            trimmed = value.strip()
            if not trimmed:
                return None
            try:
                return datetime.fromisoformat(trimmed).date()
            except ValueError:
                try:
                    return datetime.strptime(trimmed[:10], "%Y-%m-%d").date()
                except ValueError as exc:
                    raise ValueError(f"invalid date value '{value}'") from exc
        raise ValueError(f"invalid date value '{value}'")

    @classmethod
    def _build_date_price_lookup(cls, pricing: Dict[str, Any], context: str):
        base_price = cls._to_decimal(pricing.get("basePerDay"), f"{context} base rate") if pricing.get("basePerDay") not in (None, "") else Decimal("0")

        weekday_overrides: Dict[str, Decimal] = {}
        overrides = pricing.get("weekdayOverrides") or {}
        if isinstance(overrides, dict):
            for key, raw_price in overrides.items():
                if raw_price in (None, "", 0, "0"):
                    continue
                try:
                    day_index = int(key)
                except (ValueError, TypeError):
                    continue
                normalized_day = cls._normalize_weekday(day_index)
                weekday_overrides[normalized_day] = cls._to_decimal(raw_price, f"{context} weekday override {day_index}")

        specific_overrides: Dict[str, Decimal] = {}
        specifics = pricing.get("specificDates") or []
        if isinstance(specifics, list):
            for entry in specifics:
                if not isinstance(entry, dict):
                    continue
                day_str = entry.get("date")
                if not day_str:
                    continue
                specific_overrides[day_str] = cls._to_decimal(entry.get("price"), f"{context} date override {day_str}")

        def lookup(selected_date: date) -> Decimal:
            iso = selected_date.isoformat()
            if iso in specific_overrides:
                return specific_overrides[iso]
            override_key = cls._normalize_weekday(((selected_date.weekday() + 1) % 7))
            if override_key in weekday_overrides:
                return weekday_overrides[override_key]
            return base_price

        return lookup

    @staticmethod
    def _normalize_weekday(day_index: int) -> str:
        try:
            normalized = int(day_index) % 7
        except (ValueError, TypeError):
            normalized = 0
        return str(normalized)

    @staticmethod
    def _to_decimal(value: Any, context: str) -> Decimal:
        if value in (None, ""):
            return Decimal("0")
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise ValueError(f"invalid monetary value '{value}'") from exc

    @staticmethod
    def _is_checked(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on", "checked"}:
                return True
            if normalized in {"false", "0", "no", "off", ""}:
                return False
        return False

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
            
            # Get form response for amount calculation
            form_response = payment_data.get("form_response", {})
            
            # Log payment initiation
            payment_audit_logger.log_form_payment_started(
                user_id=user_id,
                form_slug=slug,
                amount=payment_amount,  # This is the frontend amount for audit comparison
                client_ip=client_ip,
                user_agent=user_agent,
                metadata={
                    "form_response_fields": list(form_response.keys()),
                    "initiation_phase": "form_validation",
                    "frontend_amount": payment_amount
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
            
            # Calculate payment amount from form schema and user responses (ignore frontend-provided amount)
            calculated_amount = self.calculate_total_amount(form.form_schema, form_response)
            
            # Log amount calculation for security audit
            self.logger.info(f"Amount calculation - Frontend: ${payment_amount:.2f}, Calculated: ${calculated_amount:.2f}")
            if abs(payment_amount - calculated_amount) > 0.01:  # Allow for small float differences
                self.logger.warning("Payment amount mismatch detected - using calculated amount for security")
            
            # Validate the calculated amount
            validated_amount = await self._validate_payment_amount(calculated_amount, form, user_id, client_ip)
            
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
                "transaction_id": transaction.id if transaction else None,
                "total_amount": payment_session.get("amount", 0)
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
                    "return_url": payment_data.get("return_url", f"{FRONTEND_URL}/forms/{form.slug}/payment/success"),
                    "cancel_url": payment_data.get("cancel_url", f"{FRONTEND_URL}/forms/{form.slug}/payment/cancel"),
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
        return await DB.db["payment_sessions"].find_one({"payment_id": payment_id})

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
                "payment_status": PaymentStatus.COMPLETED,
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
                status=PaymentStatus.COMPLETED,
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
            transactions = await DB.db["transactions"].find({"form_id": form_id}).to_list(length=None)
            
            total_amount = sum(tx.get("amount", 0) for tx in transactions)
            successful_payments = len([tx for tx in transactions if tx.get("status") == PaymentStatus.COMPLETED])
            failed_payments = len([tx for tx in transactions if tx.get("status") != PaymentStatus.COMPLETED])
            
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