from __future__ import annotations

import os
import json
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import uuid4

from fastapi import HTTPException, Request, status
from pydantic import BaseModel, Field

from models.form import (
    get_form_by_slug,
    add_response_by_slug,
    get_form_by_id_unrestricted,
    _canonicalize_response,
    _evaluate_visibility,
    mark_form_response_paid
)
from models.form_transaction import (
    create_form_transaction,
    mark_form_transaction_captured,
    mark_form_transaction_failed,
    get_form_transaction_by_order_id,
    record_form_refund,
)

from models.refund_models import TransactionRefund
from helpers.PayPalHelperV2 import PayPalHelperV2
from mongo.database import DB

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class AdminRefundFormPayment(BaseModel):
    """
    Admin-triggered refund for a PayPal form payment.

    - paypal_capture_id: the PayPal capture id we stored on the form transaction.
    - amount: optional partial refund amount. If None => full refund.
    - reason: optional free-text reason (for internal logs / future use).
    """
    # We target the PayPal capture id stored on the form transaction
    paypal_capture_id: str
    # Optional partial refund. If None ⇒ refund the remaining refundable amount.
    amount: Optional[float] = Field(default=None, gt=0)
    reason: Optional[str] = None

class AdminMarkFormPaid(BaseModel):
    """
    Admin-triggered mark-as-paid action for a single form response.

    - form_id:      The form's Mongo id as a string.
    - response_id:  The response's id (preferred, stable identifier).
    - submitted_at: Optional legacy fallback; the response's submitted_at ISO string.
    """
    form_id: str
    response_id: Optional[str] = None
    submitted_at: Optional[str] = None


async def _assert_form_payable(slug: str):
    form = await get_form_by_slug(slug)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    if not getattr(form, "visible", True):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Form is not visible")
    return form


async def _pp() -> PayPalHelperV2:
    inst = await PayPalHelperV2.get_instance()
    await inst.start()
    return inst


# ---------------------------------------------------------------------------
# Authoritative price computation for a form submission
# ---------------------------------------------------------------------------

async def compute_expected_payment(
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
            running_total += _calculate_field_total(field, canonical_response)
        except ValueError as exc:
            context = field.get("label") or field.get("name") or field.get("id") or "field"
            raise ValueError(f"{context}: {exc}") from exc

    if running_total < Decimal("0"):
        raise ValueError("Computed total cannot be negative")

    return float(running_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _calculate_field_total(field: Dict[str, Any], responses: Dict[str, Any]) -> Decimal:
    field_type = (field.get("type") or "").lower()
    context = field.get("label") or field.get("name") or field.get("id") or "field"
    name = field.get("name")

    if field_type == "price":
        return _to_decimal(field.get("amount"), context)

    if field_type == "pricelabel":
        # Pricelabel rows are reflected in the auto-managed price summary field.
        return Decimal("0")

    if field_type in {"checkbox", "switch"}:
        if not name:
            return Decimal("0")
        if not _is_checked(responses.get(name)):
            return Decimal("0")
        return _to_decimal(field.get("price"), context)

    if field_type == "radio":
        if not name:
            return Decimal("0")
        return _calculate_option_total(field, responses.get(name), allow_multiple=False, context=context)

    if field_type == "select":
        if not name:
            return Decimal("0")
        allow_multiple = bool(field.get("multiple"))
        return _calculate_option_total(field, responses.get(name), allow_multiple=allow_multiple, context=context)

    if field_type == "date":
        if not name:
            return Decimal("0")
        return _calculate_date_total(field, responses.get(name), context=context)

    return Decimal("0")


def _calculate_option_total(
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
        normalized_value = _normalize_option_value(option.get("value"))
        if normalized_value is None:
            continue
        option_map[normalized_value] = option

    if raw_value in (None, "", "__clear__"):
        return Decimal("0")

    values = _collect_select_values(raw_value, allow_multiple, context)
    total = Decimal("0")

    for value in values:
        normalized_value = _normalize_option_value(value)
        if normalized_value not in option_map:
            raise ValueError(f"invalid selection '{value}'")
        price = option_map[normalized_value].get("price")
        if price in (None, "", 0, "0"):
            continue
        option_label = option_map[normalized_value].get("label") or option_map[normalized_value].get("value")
        option_context = f"{context} option '{option_label}'"
        total += _to_decimal(price, option_context)

    return total


def _collect_select_values(raw_value: Any, allow_multiple: bool, context: str) -> List[Any]:
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


def _normalize_option_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip()


def _calculate_date_total(field: Dict[str, Any], raw_value: Any, context: str) -> Decimal:
    pricing = field.get("pricing") or {}
    if not isinstance(pricing, dict) or not pricing.get("enabled"):
        return Decimal("0")

    selected_dates = _extract_dates(field, raw_value, context)
    if not selected_dates:
        return Decimal("0")

    price_lookup = _build_date_price_lookup(pricing, context)
    total = Decimal("0")
    for selected_date in selected_dates:
        total += price_lookup(selected_date)
    return total


def _extract_dates(field: Dict[str, Any], raw_value: Any, context: str) -> List[date]:
    mode = (field.get("mode") or "single").lower()
    if mode == "range":
        if not isinstance(raw_value, dict):
            raise ValueError("expected an object with 'from' and 'to' keys for date range selection")
        start = _parse_date_value(raw_value.get("from"), context)
        end = _parse_date_value(raw_value.get("to"), context)
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

    parsed = _parse_date_value(raw_value, context)
    return [parsed] if parsed else []


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


def _build_date_price_lookup(pricing: Dict[str, Any], context: str):
    base_per_day = pricing.get("basePerDay")
    base_price = _to_decimal(base_per_day, f"{context} base rate") if base_per_day not in (None, "") else Decimal("0")

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
            normalized_day = _normalize_weekday(day_index)
            weekday_overrides[normalized_day] = _to_decimal(raw_price, f"{context} weekday override {day_index}")

    specific_overrides: Dict[str, Decimal] = {}
    specifics = pricing.get("specificDates") or []
    if isinstance(specifics, list):
        for entry in specifics:
            if not isinstance(entry, dict):
                continue
            day_str = entry.get("date")
            if not day_str:
                continue
            specific_overrides[day_str] = _to_decimal(entry.get("price"), f"{context} date override {day_str}")

    def lookup(selected_date: date) -> Decimal:
        iso = selected_date.isoformat()
        if iso in specific_overrides:
            return specific_overrides[iso]
        override_key = _normalize_weekday(((selected_date.weekday() + 1) % 7))
        if override_key in weekday_overrides:
            return weekday_overrides[override_key]
        return base_price

    return lookup


def _normalize_weekday(day_index: int) -> str:
    try:
        normalized = int(day_index) % 7
    except (ValueError, TypeError):
        normalized = 0
    return str(normalized)


def _to_decimal(value: Any, context: str) -> Decimal:
    if value in (None, ""):
        return Decimal("0")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"invalid monetary value '{value}'") from exc


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


# ---------------------------------------------------------------------------
# PayPal order creation for forms
# ---------------------------------------------------------------------------

async def create_paypal_order_for_form(
    *,
    request: Request,
    slug: str,
    answers: Dict[str, Any],
) -> dict:
    form = await _assert_form_payable(slug)

    try:
        amount = await compute_expected_payment(
            form_id=str(form.id),
            user_response=answers or {},
            respect_visibility=True,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This submission does not require payment.",
        )

    currency = "USD"
    helper = await _pp()

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {"currency_code": currency, "value": f"{amount:.2f}"},
                "custom_id": str(form.id),
                "description": f"Form submission ({slug})",
            }
        ],
        "application_context": {
            "brand_name": "Form Submission",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
            "return_url": f"{FRONTEND_URL}/forms/{slug}/payment/success",
            "cancel_url": f"{FRONTEND_URL}/forms/{slug}",
        },
    }

    try:
        resp = await helper.post(
            "/v2/checkout/orders",
            json_body=order_payload,
            request_id=f"form-create:{slug}:{uuid4()}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error creating PayPal order: {exc}",
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"PayPal order creation failed with status {resp.status_code}",
        )

    order = resp.json() or {}
    order_id = order.get("id")
    if not order_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid PayPal response (missing id)",
        )

    await create_form_transaction(
        form_id=str(form.id),
        user_id=request.state.uid,
        amount=amount,
        currency=currency,
        paypal_order_id=order_id,
        metadata={
            "slug": slug,
            "flow": "form_submission",
            "expected_amount": amount,
        },
    )

    return {
        "order_id": order_id,
        "paypal": order,
        "amount": amount,
        "currency": currency,
    }


# ---------------------------------------------------------------------------
# Capture + submit (idempotent)
# ---------------------------------------------------------------------------

async def capture_and_submit_form(
    *,
    request: Request,
    slug: str,
    order_id: str,
    answers: Dict[str, Any],
) -> dict:
    """Capture the PayPal order and persist the form response in one shot.

    Behaviour:
      - Recomputes the expected price from the form schema and supplied answers.
      - Ensures a non-zero price is required for PayPal-backed submissions.
      - Idempotently captures the PayPal order (or reuses an existing capture).
      - Attaches authoritative payment metadata to the stored response.
    """
    form = await _assert_form_payable(slug)

    try:
        configured_amount = await compute_expected_payment(
            form_id=str(form.id),
            user_response=answers or {},
            respect_visibility=True,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if configured_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This submission does not require payment; no capture is necessary.",
        )

    configured_currency = "USD"

    # Provisional transaction created at "create" time
    txn = await get_form_transaction_by_order_id(order_id)
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    helper = await _pp()

    # ---------- (A) Capture idempotency guard
    capture_id: Optional[str] = None
    captured_amount: Optional[float] = None
    captured_currency: str = configured_currency
    capture: Optional[dict] = None

    status_str = (txn or {}).get("status")
    if status_str in {"captured", "partially_refunded", "fully_refunded"}:
        # Already captured at the ledger level; reuse stored values.
        capture_id = (txn or {}).get("paypal_capture_id")
        captured_amount = float(txn.get("amount") or configured_amount)
        captured_currency = txn.get("currency") or configured_currency
    else:
        # Need to perform the capture with PayPal
        try:
            resp = await helper.post(
                f"/v2/checkout/orders/{order_id}/capture",
                json_body={},
                request_id=f"form-capture:{order_id}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"PayPal capture failed: {exc}",
            )

        if resp.status_code not in (200, 201):
            await mark_form_transaction_failed(
                paypal_order_id=order_id,
                reason=f"paypal_capture_http_{resp.status_code}",
                payload={"body": resp.text},
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"PayPal capture failed with status {resp.status_code}",
            )

        try:
            capture = resp.json() or {}
        except Exception:
            capture = {}

        status_str = (capture or {}).get("status")
        if status_str not in {"COMPLETED", "APPROVED"}:
            await mark_form_transaction_failed(
                paypal_order_id=order_id,
                reason=f"paypal_capture_status_{status_str}",
                payload=capture or {},
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unexpected PayPal status: {status_str}",
            )

        # Parse primary capture
        try:
            for pu in (capture.get("purchase_units") or []):
                payments = pu.get("payments") or {}
                caps = payments.get("captures") or []
                if caps:
                    cap0 = caps[0]
                    capture_id = cap0.get("id")
                    amt = (cap0.get("amount") or {})
                    val = amt.get("value")
                    ccy = amt.get("currency_code") or configured_currency
                    captured_currency = ccy
                    if val is not None:
                        captured_amount = float(val)
                    break
        except Exception:
            # If parsing fails, fall through and error below if we have no capture_id
            pass

        if not capture_id:
            await mark_form_transaction_failed(
                paypal_order_id=order_id,
                reason="paypal_capture_parse_error",
                payload=capture or {},
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not parse PayPal capture response.",
            )

        # Validate amount / currency against our authoritative computation
        if round(captured_amount or 0.0, 2) != round(configured_amount, 2) or captured_currency != configured_currency:
            await mark_form_transaction_failed(
                paypal_order_id=order_id,
                reason="amount_currency_mismatch",
                payload={
                    "captured_amount": captured_amount,
                    "captured_currency": captured_currency,
                    "configured_amount": configured_amount,
                    "configured_currency": configured_currency,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Captured amount/currency mismatch with configured price.",
            )

        # Persist capture on the transaction
        await mark_form_transaction_captured(
            paypal_order_id=order_id,
            capture_id=capture_id or "unknown",
            capture_payload=capture or {},
        )

    # ---------- (B) Idempotent submit (by transaction_id)
    payment_block: Dict[str, Any] = {
        "payment_type": "paypal",
        "payment_complete": True,
        "transaction_id": capture_id,
        "price": float(captured_amount or configured_amount),
        "currency": captured_currency,
    }

    saved = await add_response_by_slug(
        slug=slug,
        user_id=request.state.uid,
        response=answers or {},
        passed_payment=payment_block,
    )

    return {
        "status": "captured_and_submitted",
        "order_id": order_id,
        "transaction_id": capture_id,
        "response": saved,
    }


# ---------------------------------------------------------------------------
# Admin refund endpoint (unchanged logic)
# ---------------------------------------------------------------------------

async def admin_refund_form_payment(
    *,
    request: Request,
    body: AdminRefundFormPayment,
) -> Dict[str, Any]:
    """
    Admin-triggered refund for a PayPal-backed form payment.

    Behaviour mirrors admin_refund_one_time_donation:
    - If amount is None => refund the remaining refundable amount.
    - If amount is set => partial refund of that amount.
    """
    paypal_capture_id = (body.paypal_capture_id or "").strip()
    if not paypal_capture_id:
        raise HTTPException(status_code=400, detail="paypal_capture_id is required")

    # Locate the form transaction for this capture id
    txn_doc = await DB.db.form_transactions.find_one({"paypal_capture_id": paypal_capture_id})
    if not txn_doc:
        raise HTTPException(
            status_code=404,
            detail="Form transaction not found for that capture id",
        )

    original_amount = float(txn_doc.get("amount", 0.0) or 0.0)
    currency = str(txn_doc.get("currency") or "USD")

    # Compute how much has already been refunded for this transaction
    refunds_raw = txn_doc.get("refunds") or []
    refunded_total = 0.0
    if isinstance(refunds_raw, list):
        for r in refunds_raw:
            if not isinstance(r, dict):
                continue
            try:
                refunded_total += float(r.get("amount", 0.0) or 0.0)
            except (TypeError, ValueError):
                continue
    refunded_total = round(refunded_total, 2)

    remaining = round(original_amount - refunded_total, 2)
    if remaining <= 0.01:
        raise HTTPException(
            status_code=400,
            detail="Nothing left to refund for this form payment",
        )

    # Determine the refund amount we will request from PayPal
    if body.amount is not None:
        value = round(float(body.amount), 2)
        if value <= 0:
            raise HTTPException(status_code=400, detail="Refund amount must be > 0")

        # Do not allow more than the remaining refundable amount
        if value - remaining > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Refund amount cannot exceed remaining refundable amount ({remaining:.2f})",
            )
    else:
        # No explicit amount => refund whatever remains
        value = remaining

    json_body: Dict[str, Any] = {
        "amount": {
            "value": f"{value:.2f}",
            "currency_code": currency,
        }
    }

    helper = await PayPalHelperV2.get_instance()
    try:
        resp = await helper.post(
            f"/v2/payments/captures/{paypal_capture_id}/refund",
            json_body=json_body,
            request_id=f"admin-refund-form:{paypal_capture_id}:{uuid4().hex}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "PayPal refund request failed", "error": str(e)},
        )

    if resp.status_code not in (200, 201):
        try:
            payload = resp.json()
        except Exception:
            # Fallback to raw body for debugging; don't let this crash the handler
            payload = {"raw": resp.text}
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "PayPal refund failed",
                "status_code": resp.status_code,
                "paypal_response": payload,
            },
        )

    data = resp.json() or {}

    # Build refund log entry
    amount_info = (data.get("amount") or {}) or {}
    raw_value = amount_info.get("value")
    refund_value = float(raw_value) if raw_value is not None else float(value)
    refund_currency = str(amount_info.get("currency_code") or currency)
    refund_id = data.get("id") or f"paypal:{paypal_capture_id}:{uuid4().hex}"
    reason = (
        (body.reason or "").strip()
        or data.get("reason")
        or "admin_manual_refund"
    )
    admin_uid = getattr(request.state, "uid", None)

    refund_entry = TransactionRefund(
        refund_id=str(refund_id),
        amount=refund_value,
        currency=refund_currency,
        reason=reason,
        by_uid=str(admin_uid) if admin_uid is not None else None,
        source="admin_api",
        paypal_refund_payload=data,
    )

    try:
        await record_form_refund(
            paypal_capture_id=paypal_capture_id,
            refund=refund_entry,
        )
    except Exception:
        # If Mongo update fails, the refund at PayPal is still valid.
        # Do not mask a successful refund with a local DB error.
        pass

    return {
        "success": True,
        "paypal_capture_id": paypal_capture_id,
        "paypal_refund": data,
    }


async def admin_mark_form_response_paid(*, body: AdminMarkFormPaid) -> Dict[str, Any]:
    """
    Admin-only helper to flip payment_complete=True on a single stored response.
    """
    ok, msg = await mark_form_response_paid(
        form_id=body.form_id,
        response_id=body.response_id,
        submitted_at=body.submitted_at,
    )

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg or "Unable to mark form response paid",
        )

    return {"success": True, "msg": msg or "Marked response as paid"}
