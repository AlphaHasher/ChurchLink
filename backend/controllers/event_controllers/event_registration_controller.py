from typing import List, Dict, Any, Literal, Optional, Tuple, Set
from fastapi import Request
from models.event_instance import (
    AssembledEventInstance,
    get_event_instance_assembly_by_id,
    RegistrationDetails,
    update_registration,
    ChangeEventRegistration,
    PaymentDetails,
    get_upcoming_instances_for_user_family,
    _assemble_event_instance_for_admin,
    get_upcoming_instances_for_user,
    increment_amount_refunded_for_line
)
from models.event import _coerce_to_aware_utc, get_event_by_id, get_event_doc_by_id
from models.discount_code import get_discount_code_by_code, get_discount_code_by_id, increment_discount_usage
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
import os
from uuid import uuid4
from helpers.PayPalHelperV2 import PayPalHelperV2
from pydantic import BaseModel, Field
import math
import logging


from models.event_transaction import (
    TransactionItem,
    create_preliminary_transaction,
    mark_transaction_captured,
    get_transaction_by_order_id,
    append_refund_to_item,
    LineStatus
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class CapturePaidRegistration(BaseModel):
    order_id: str
    event_instance_id: str
    final_details: RegistrationDetails

class DiscountCodeCheck(BaseModel):
    event_id: str
    discount_code: str

class AdminForceChange(BaseModel):
    """
    Request body for admin force register/unregister.
    - event_instance_id: target instance
    - user_id: the account that owns the registration entry
    - registrant_id: "SELF" or a family_id string
    - price: optional; if None/0 => free, else => door (pay later)
    """
    event_instance_id: str
    user_id: str
    registrant_id: str = Field(description='"SELF" or a family member id')
    price: Optional[float] = None  # Only used for force-register

class AdminRefundEventTransaction(BaseModel):
    """
    Admin-triggered refund for an event transaction.

    - order_id: PayPal order id for the event transaction.
    - refund_all:
        * True  -> apply the same refund rule to every refundable line.
        * False -> use line_map to specify per-line refunds.
    - refund_amount:
        * Used only when refund_all is True.
        * None        -> refund the remaining amount for each line (full for each line).
        * Some amount -> refund that amount on each line (capped to the line's remaining).
    - line_map:
        * Used only when refund_all is False.
        * { line_id: None }        -> refund that line's full remaining amount.
        * { line_id: amount }      -> refund that line by `amount` (capped to remaining).
    - reason:
        * Optional human-readable reason stored on the refund records.
    """
    order_id: str
    refund_all: bool
    refund_amount: Optional[float] = None
    line_map: Optional[Dict[str, Optional[float]]] = None
    reason: Optional[str] = None


# A HELPER THAT ENFORCES A VALIDATION THAT AN INSTANCE IS UPCOMING
# USED FOR FORCED REGISTRATION TO GUARANTEE ONLY UPCOMING EVENTS MODIFIED
async def _load_upcoming_instance(instance_id: str) -> Optional[AssembledEventInstance]:
    instance_doc = await get_event_instance_assembly_by_id(instance_id)
    if not instance_doc:
        return None
    try:
        assembled = AssembledEventInstance(**instance_doc)
    except Exception:
        return None
    now = datetime.now(timezone.utc)
    ev_dt, _ = _coerce_to_aware_utc(assembled.date)
    if not ev_dt or now >= ev_dt:
        return None
    return assembled

# ----------------------------
# Helpers to stamp payment/registration details
# ----------------------------

def _paymentdetails_fields() -> Dict[str, Any]:
    """
    Pydantic v2 exposes model_fields; v1 exposes __fields__.
    We use this to safely include optional fields (transaction_id, line_id)
    only if PaymentDetails model defines them.
    """
    return getattr(PaymentDetails, "model_fields", None) or getattr(PaymentDetails, "__fields__", {}) or {}


# Create a new PaymentDetails to map to a registrant in RegistrationDetails
async def create_new_payment_details(
    payment_type: Literal["free", "paypal", "door"],
    price: float,
    discount_code_id: Optional[str],
    *,
    transaction_id: Optional[str] = None,
    line_id: Optional[str] = None,
    refundable_amount: Optional[float] = None,
    amount_refunded: float = 0.0,
) -> PaymentDetails:
    details: Dict[str, Any] = {}

    # Normalize price
    price = round(float(price or 0.0), 2)

    # Set the payment type, price, and discount code based on inputs simply
    details["payment_type"] = payment_type
    details["price"] = price
    details["discount_code_id"] = discount_code_id

    # Paypal only ever calls this after the payment is caught and confirmed
    # So payment is complete only if free or paypal is the type
    if payment_type in ("free", "paypal"):
        details["payment_complete"] = True
    else:
        details["payment_complete"] = False

    # Set automatic refund eligibility to False initially
    # It is only supposed to be there as an "emergency lever" if the event is changed after a user is registered
    details["automatic_refund_eligibility"] = False

    # Refundable amount defaults:
    # - If caller provided a specific refundable_amount, honor it.
    # - Else, for PayPal, default to price (no fee breakdown available yet).
    # - For non-PayPal, leave as None unless explicitly provided.
    if refundable_amount is not None:
        details["refundable_amount"] = round(float(refundable_amount or 0.0), 2)
    elif payment_type == "paypal":
        details["refundable_amount"] = price
    else:
        details["refundable_amount"] = None

    # Start with a known amount_refunded (usually 0.0)
    details["amount_refunded"] = round(float(amount_refunded or 0.0), 2)

    # Set transaction and line IDs to real IDs if using PayPal
    if payment_type == "paypal":
        # Conditionally attach transaction lineage
        fields = _paymentdetails_fields()
        if "transaction_id" in fields and transaction_id:
            details["transaction_id"] = transaction_id
        if "line_id" in fields and line_id:
            details["line_id"] = line_id
    else:
        # If not using paypal, there is no transaction or line id and we set to None.
        details["transaction_id"] = None
        details["line_id"] = None

    return PaymentDetails(**details)

# Builds PaymentDetails forcefully created by an admin force registration
def _build_forced_payment_details(kind: Literal["free", "door"], price: float) -> PaymentDetails:
    # payment_complete only for "free"; "door" means pay later
    base_price = round(float(price or 0.0), 2)
    refundable = base_price if kind == "free" else None

    return PaymentDetails(
        payment_type=kind,
        price=base_price,
        refundable_amount=refundable,
        amount_refunded=0.0,
        payment_complete=(kind == "free"),
        discount_code_id=None,
        automatic_refund_eligibility=False,
        transaction_id=None,
        line_id=None,
        is_forced=True,
    )


# Create a new RegistrationDetails to replace in the event
async def create_new_reg_details(
    registration: ChangeEventRegistration,
    old_details: Optional[RegistrationDetails],
    self_registered: bool,
    family_registered: List[str],
    unit_price: float,
    regs: List[str],
    *,
    lineage_map: Optional[Dict[str, Tuple[Optional[str], Optional[str]]]] = None,
    refundable_map: Optional[Dict[str, float]] = None,
) -> RegistrationDetails:
    details: Dict[str, Any] = {}

    # Very simply set the registration statuses to our input values
    details["self_registered"] = self_registered
    details["family_registered"] = family_registered

    # Helper to get per-person refundable amount (if any)
    def _ref_amt(person_id: str) -> Optional[float]:
        if not refundable_map:
            return None
        return refundable_map.get(person_id)

    # Set self_payment_details only if the self is registered
    if self_registered:
        # If self already registered, keep old details
        if old_details and old_details.self_registered:
            details["self_payment_details"] = old_details.self_payment_details
        # Otherwise, create new payment details
        else:
            t_id: Optional[str] = None
            l_id: Optional[str] = None
            if lineage_map and "SELF" in lineage_map:
                t_id, l_id = lineage_map["SELF"]

            details["self_payment_details"] = await create_new_payment_details(
                registration.payment_type,
                unit_price,
                registration.discount_code_id,
                transaction_id=t_id,
                line_id=l_id,
                refundable_amount=_ref_amt("SELF"),
                amount_refunded=0.0,
            )
    # Self payment details should be None if self not signed up
    else:
        details["self_payment_details"] = None

    # Create a new dict for family_payment_details
    family_payment_dict: Dict[str, PaymentDetails] = {}
    for family in family_registered:
        # If family is in regs that means they are a new registrant and we need to create new PaymentDetails
        if family in regs:
            t_id: Optional[str] = None
            l_id: Optional[str] = None
            if lineage_map and family in lineage_map:
                t_id, l_id = lineage_map[family]
            family_payment_dict[family] = await create_new_payment_details(
                registration.payment_type,
                unit_price,
                registration.discount_code_id,
                transaction_id=t_id,
                line_id=l_id,
                refundable_amount=_ref_amt(family),
                amount_refunded=0.0,
            )
        # Otherwise keep old payment details
        else:
            # Do a quick validation check
            if (
                old_details
                and getattr(old_details, "family_payment_details", None)
                and (family in old_details.family_payment_details)
            ):
                family_payment_dict[family] = old_details.family_payment_details.get(family)  # type: ignore[assignment]
            # If this failed. Panic and create new (defensive default)
            else:
                t_id = l_id = None
                if lineage_map and family in lineage_map:
                    t_id, l_id = lineage_map[family]
                family_payment_dict[family] = await create_new_payment_details(
                    registration.payment_type,
                    unit_price,
                    registration.discount_code_id,
                    transaction_id=t_id,
                    line_id=l_id,
                    refundable_amount=_ref_amt(family),
                    amount_refunded=0.0,
                )

    details["family_payment_details"] = family_payment_dict

    return RegistrationDetails(**details)



# ----------------------------
# Main flows
# ----------------------------

# Single entrypoint: decides which concrete handler to call based on intent and payment_type.
# - For PayPal with new additions -> start the paid flow (create + redirect to approve)
# - For PayPal with only removals/no-op -> run the generic change path (no payment needed)
# - For free/door -> always run the generic change path (free/door stamping happens inside)
async def event_registration_central_controller(request: Request, registration: ChangeEventRegistration) -> Dict[str, Any]:
    # Normalize incoming arrays to avoid None checks downstream
    fm_reg = list(registration.family_members_registering or [])
    fm_unreg = list(registration.family_members_unregistering or [])

    # Determine the nature of the change
    adding_self = registration.self_registered is True
    removing_self = registration.self_registered is False
    has_additions = adding_self or len(fm_reg) > 0
    has_removals = removing_self or len(fm_unreg) > 0

    # Guard against a pure no-op early (the write path also checks this, but this gives a fast fail)
    if not has_additions and not has_removals:
        return {"success": False, "msg": "Error! Cannot change event registration: no actual change requested."}

    # Branch by payment_type
    pt = (registration.payment_type or "").lower()

    if pt == "paypal":
        # Only start a PayPal order if we are adding new registrants that require payment.
        # If this is an unregister-only (or net-zero) change, fall through to generic change path.
        if has_additions:
            return await process_create_paid_registration(request, registration)
        else:
            return await process_change_event_registration(request, registration)

    elif pt in ("free", "door"):
        # Free and door are handled in the generic path; it stamps PaymentDetails accordingly.
        return await process_change_event_registration(request, registration)

    # Unknown/unsupported payment type
    return {"success": False, "msg": f"Unsupported payment_type '{registration.payment_type}' for registration change."}


# Handle a change to event registration
async def process_change_event_registration(
    request: Request,
    registration: ChangeEventRegistration,
    *,
    lineage_map: Optional[Dict[str, Tuple[Optional[str], Optional[str]]]] = None,
    refundable_map: Optional[Dict[str, float]] = None,
):
    # Get the Event Instance from the ID
    instance = await get_event_instance_assembly_by_id(registration.event_instance_id)

    # Return error if no instance found
    if not instance:
        return {"success": False, "msg": f"Error! Could not find instance with ID {registration.event_instance_id}"}

    # Assemble the instance, and return error if failure
    try:
        assembled = AssembledEventInstance(**instance)
    except Exception as e:
        return {"success": False, "msg": f"Error! Could not assemble event instance: {e}"}

    # Validate the registration update
    validation = await do_registration_validation(request, registration, assembled)

    # If validation failure, return error
    if not validation["success"]:
        return {"success": False, "msg": f"Error! Failed validation! Validation error message: {validation['msg']}"}

    seat_delta = validation["seat_delta"]
    unit_price = validation["unit_price"]
    self_registered = validation["self_registered"]
    family_registered = validation["family_registered"]
    regs = validation["regs"]
    unregs = validation["unregs"]

    old_details = assembled.registration_details.get(request.state.uid) or None

    # Try to create proper RegistrationDetails, return error if failure
    try:
        details = await create_new_reg_details(
            registration,
            old_details,
            self_registered,
            family_registered,
            unit_price,
            regs,
            lineage_map=lineage_map,
            refundable_map=refundable_map,
        )
    except Exception as e:
        return {"success": False, "msg": f"Error! Could not assemble new RegistrationDetails: {e}"}

    # Handle the final reg update
    res = await update_registration(assembled.id, request.state.uid, details, seat_delta, assembled.max_spots)
    res["details_map"] = validation["details_map"]

    if not res["success"]:
        return res

    if unregs:
        refund_res = await _process_refunds_for_removals(
            request=request,
            instance=assembled,
            old_details=old_details,
            unregs=unregs,
        )
        if not refund_res["success"]:
            # Attempt rollback if old_details exist
            rollback_succeeded = False
            if old_details is not None:
                rollback_delta = -seat_delta
                rollback = await update_registration(
                    assembled.id,
                    request.state.uid,
                    old_details,
                    rollback_delta,
                    assembled.max_spots,
                )
                if rollback and rollback.get("success"):
                    res["seats_filled"] = rollback.get("seats_filled")
                    rollback_succeeded = True

            if not rollback_succeeded:
                res["rollback_failed"] = True

            return refund_res

    # If registration successful, inc code uses
    if res["success"]:
        if registration.discount_code_id is not None:
            code_validation = validation["code_validation"]
            limit = code_validation["uses_left"]

            if limit is None or limit >= len(regs):
                inc = len(regs)
            else:
                inc = limit

            await increment_discount_usage(registration.discount_code_id, request.state.uid, inc)

    return res



async def calculate_discounted_event_price(base_price: float, is_percent:bool, discount_value: float, count:int, limit:Optional[int]=None,):
    """
    CALCULATES A NEW UNIT PRICE FOR AN EVENT
    TAKES PARAMS:
    base_price: A FLOAT THAT REPRESENTS THE BASE PRICE OF THE CALCULATIONS
    is_percent: A BOOL THAT DENOTATES IF THE DISCOUNT IS A PERCENTAGE OR RAW NUMBER
    discount_value: A FLOAT THAT DENOTATES THE DISCOUNT AS A PERCENTAGE OR AS A RAW $ OFF
    count: AN INT THAT DENOTATES HOW MANY PEOPLE ARE GOING TO BE REGISTERED
    limit: AN INT THAT DENOTATES THE LIMIT OF TIMES THIS DISCOUNT CODE CAN BE APPLIED. CAN BE NONE
    """

    # Safety: If nobody is being signed up, return 0
    if count < 1:
        return 0
    
    # Calculate how many discounted and undiscounted prices there will be

    # If not bounded by limit, all discounted
    if limit is None or limit >= count:
        discounted_count = count
        undiscounted_count = 0

    # If bounded by limit, calculate proper amounts
    else:
        discounted_count = limit
        undiscounted_count = count - limit
    
    # Do the logic for is_percent
    if is_percent:
        # Normalize the Scale Value to be discount_value / 100
        # This is because 75 means 75% off
        scaled_value = discount_value / 100
        # Scale factor is 1 - scaled value.
        # Reason is, 60% off means you pay 0.4 the price. not 0.6 the price
        scale_factor = 1 - scaled_value
        
        # Calculate the discounted price
        # Max between calc and 0 just to be safe
        discounted_price = max((base_price * scale_factor),0)

        # The total price paid from discounted registrants
        discounted_total = discounted_price * discounted_count

        # The total price paid from undiscounted registrants
        undiscounted_total = base_price * undiscounted_count

        # Final price is discounted + undiscounted divided by total registrants
        final_price = (discounted_total+undiscounted_total)/count

        # Return with another max bounding to be safe
        return max(final_price, 0)
    
    # Do the logic for raw value
    else:

        # The discounted price is very simply the max between base - discount and 0
        discounted_price = max((base_price - discount_value), 0)

        # Calc discounted total
        discounted_total = discounted_price * discounted_count

        # Total price paid from undiscounted registrants
        undiscounted_total = base_price * undiscounted_count

        # Final price is discounted + undiscounted divided by total registrants
        final_price = (discounted_total+undiscounted_total)/count

        # Return with another max bounding to be safe
        return max(final_price, 0)






async def do_registration_validation(request: Request, registration: ChangeEventRegistration, instance: AssembledEventInstance):
    # Assemble regs and unregs based on data. Ensure no duplicates get sent
    regs = list(dict.fromkeys(registration.family_members_registering or []))
    unregs = list(dict.fromkeys(registration.family_members_unregistering or []))

    # Check for previous RegistrationDetails on this event
    uid = request.state.uid
    old_reg_details = instance.registration_details.get(uid) or None

    # If a change was made to the status of the registration of the user themselves
    if registration.self_registered is not None:
        # If the user requested a registration
        if registration.self_registered:
            # If there's not a previous registration on this account, or there is a registration and the user isn't registered allow them to register
            if old_reg_details is None or (old_reg_details is not None and not old_reg_details.self_registered):
                regs.append("SELF")
            else:
                # Raise an error if user requested to register for event they are already registered for
                return {
                    "success": False,
                    "msg": "Error! The user is trying to sign up for the event, but they are already registered!",
                }
        # If user explicitly requested unregistration
        else:
            # If the user has a previous registration and they are registered
            if old_reg_details is not None and old_reg_details.self_registered:
                unregs.append("SELF")
            else:
                # Raise an error if user requested to register for event they are already registered for
                return {
                    "success": False,
                    "msg": "Error the user is trying to unregister themselves for an event, but they are not already registered!",
                }

    # DO VALIDATION TO MAKE SURE THAT NO REGISTERED USER IS TRYING TO RE-REGISTER
    # AND ALSO THAT ALL UNREGISTERED USERS ARE ACTUALLY REGISTERED ALREADY

    # If the user has no previous registration, then we already know all regs are first registrations and dont have to validate
    if old_reg_details is not None:
        # Validate all regs
        for reg in regs:
            # If reg is special "SELF" tracker, then pass
            if reg == "SELF":
                continue
            # If registrant already registered, raise validation error
            if reg in (old_reg_details.family_registered or []):
                return {"success": False, "msg": f"Error! Family member with ID {reg} is already registered!"}

    # If there is no previous registration, but the request has unregistrants, return an error
    if old_reg_details is None and len(unregs) > 0:
        return {
            "success": False,
            "msg": f"Error! You cannot request to unregister for an event you have no registrations for!",
        }

    # Make sure all unregister requests are already registered
    for unreg in unregs:
        if unreg == "SELF":
            continue
        if unreg not in (old_reg_details.family_registered or []):
            return {
                "success": False,
                "msg": f"Error! Family member with ID {unreg} is not already registered for the event, and thus cannot be unregistered!",
            }

    # If no reg changes are being made, and no people are being added or removed, return an error because no actual change is requested.
    if len(regs) < 1 and len(unregs) < 1:
        return {
            "success": False,
            "msg": "Error! Cannot change event registration: There is no actual change in the registration request!",
        }
    
    # Get the current datetime
    now = datetime.now(timezone.utc)

    # If any people are trying to add to registration, check for special deadline checks
    if len(regs) > 0:

        if not registration.payment_type:
            return {'success':False, 'msg':f'Error! A valid payment type is expected!'}

        # Check to ensure that requested payment type is valid
        if instance.payment_options and registration.payment_type != 'free' and registration.payment_type not in instance.payment_options:
            return {"success": False, "msg":f"Error! The requested payment type: {registration.payment_type} is not available for this event!"}

        # If registration is closed by admin, forbid registration
        if not instance.registration_allowed:
            return {"success": False, "msg": "Error! Cannot register to an event where registration is not allowed"}

        # If registration not yet open, forbid registration
        if instance.registration_opens:
            reg_open, err = _coerce_to_aware_utc(instance.registration_opens)
            if not reg_open:
                return {"success": False, "msg": "Error! Invalid registration open date."}
            if reg_open > now:
                return {"success": False, "msg": "Error! You cannot register for an event before the opening date!"}

        # If registration deadline passed, forbid registration
        if instance.registration_deadline:
            reg_dead, err = _coerce_to_aware_utc(instance.registration_deadline)
            if not reg_dead:
                return {"success": False, "msg": "Error! Invalid registration deadline date."}
            if now >= reg_dead:
                return {"success": False, "msg": "Error! You cannot register for an event after the registration deadline!"}

    # If the event date has already passed, forbid any update
    ev_date, err = _coerce_to_aware_utc(instance.date)
    if not ev_date:
        return {"success": False, "msg": "Error! Invalid event date."}
    if now >= ev_date:
        return {
            "success": False,
            "msg": "Error! This event has already taken place in the past, you can't change your registration for an event in the past.",
        }

    # Check to make sure non-members aren't being added to members only event
    if len(regs) > 0 and instance.members_only and not request.state.user.get("membership"):
        return {"success": False, "msg": "Error! This event is for members only, and user is not a member!"}

    # If there is a member price available and user is a member give them the member price
    if (instance.member_price is not None) and request.state.user.get("membership"):
        event_price = instance.member_price
    else:
        event_price = instance.price

    code_validation = None

    # Validate registered discount code
    if registration.discount_code_id is not None and len(regs) > 0:
        code_validation = await do_discount_check(request.state.uid, instance.event_id, code_id=registration.discount_code_id)
        if not code_validation['success']:
            return code_validation
        
        # Calculate the new discounted price
        new_price = await calculate_discounted_event_price(event_price, code_validation['is_percent'], code_validation['discount'], len(regs), code_validation['uses_left'])
        
        # Set the event price to the minimum value between the event price and the new price for an additional layer of safety
        event_price = min(event_price, new_price)

    # normalize to 2 decimals to avoid float drift end-to-end
    # always drops the 3rd decimal so the customer gets the benefit of rounding.
    event_price = math.trunc(event_price * 100) / 100.0

    # It is important that we make the free check AFTER event price is calculated because we have to resolve standard/member price or possibly discounts
    if event_price > 0 and len(regs) > 0 and registration.payment_type not in ['paypal', 'door']:
        return {'success':False, 'msg':'Error! This event is not free, so free payment type cannot apply!'}

    # Check to make sure that seats won't be overfilled
    seat_delta = len(regs) - len(unregs)
    if instance.max_spots and seat_delta > 0:
        if (instance.seats_filled + seat_delta) > instance.max_spots:
            return {"success": False, "msg": "Error! This registration update would take the event over capacity!"}

    # Create a details map for eligibility validation
    user = request.state.user
    self_details = {
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "birthday": user.get("birthday"),
        "gender": user.get("gender"),
    }
    details_map = {"SELF": self_details}

    # Create the map for family members
    for family in (user.get("people") or []):
        fid = str(family.get("_id"))
        fname = family.get("first_name")
        lname = family.get("last_name")
        dob = family.get("date_of_birth")
        gender = family.get("gender")
        family_details = {"first_name": fname, "last_name": lname, "birthday": dob, "gender": gender}
        details_map[fid] = family_details

    # Do eligibility validation for all registered users
    invalid_list: List[str] = []
    for addition in regs:
        if addition not in details_map:
            return {"success": False, "msg": f"ERROR! Details map failed for family member {addition}"}
        d = details_map[addition]
        valid = await do_eligibility_validation(d["gender"], d["birthday"], instance)
        if not valid:
            invalid_list.append(addition)

    # Return an error if there's any ineligible registrant
    if len(invalid_list) > 0:
        first = invalid_list[0]
        msg = (
            "Error! The following registrants are invalid for event participation: "
            f"{details_map[first]['first_name']} {details_map[first]['last_name']}"
        )
        for i in range(1, len(invalid_list)):
            rid = invalid_list[i]
            msg += f" & {details_map[rid]['first_name']} {details_map[rid]['last_name']}"
        return {"success": False, "msg": msg}

    # Boolean if self is registered
    if old_reg_details is not None:
        self_registered = bool(old_reg_details.self_registered)
    else:
        self_registered = False
    if "SELF" in regs:
        self_registered = True
    if "SELF" in unregs:
        self_registered = False

    # Create a full list of the final collection of family members registered
    if old_reg_details is None:
        family_registered = regs.copy()
        if "SELF" in family_registered:
            family_registered.remove("SELF")
    else:
        family_registered = list(old_reg_details.family_registered or [])
        for reg in regs:
            if reg == "SELF":
                continue
            family_registered.append(reg)
        for unreg in unregs:
            if unreg == "SELF" or unreg not in family_registered:
                continue
            family_registered.remove(unreg)

    # Ensure no duplicates somehow get through
    family_registered = list(dict.fromkeys(family_registered))

    # NOTE: For non-PayPal paths, lineage_map is None.
    return {
        "success": True,
        "msg": "Successfully validated registration update!",
        "seat_delta": seat_delta,
        "unit_price": event_price,
        "details_map": details_map,
        "regs": regs,
        "unregs": unregs,
        "self_registered": self_registered,
        "family_registered": family_registered,
        "code_validation": code_validation,
    }


# Do eligibility validation based on gender and age criteria
async def do_eligibility_validation(gender: str, dob: datetime, instance: AssembledEventInstance):
    # Check Gender
    if instance.gender == "male" and gender and str(gender).upper() != "M":
        return False
    elif instance.gender == "female" and gender and str(gender).upper() != "F":
        return False

    # Early return if no age checks necessary
    if not instance.min_age and not instance.max_age:
        return True

    # Coerce dates to being UTC aware and calculate age
    aware_dob, err = _coerce_to_aware_utc(dob)
    if not aware_dob:
        return False
    aware_date, err = _coerce_to_aware_utc(instance.date)
    if not aware_date:
        return False
    age = relativedelta(aware_date.date(), aware_dob.date()).years

    # Identify if age is out of bounds
    if instance.min_age and age < instance.min_age:
        return False
    if instance.max_age and age > instance.max_age:
        return False

    return True

async def do_discount_check(uid: str, event_id:str, *, discount_code:Optional[str] = None, code_id:Optional[str] = None):

    # First validate that code exists. We should expect a discount_code or code_id 
    
    # If no data given, return error
    if discount_code is None and code_id is None:
        return {'success':False, 'msg':'Error! No discount data given!'}
    
    # Prefer to utilize code id so do code check if id is none
    if code_id is None:
        discount = await get_discount_code_by_code(discount_code)
        if discount is None:
            return {'success':False, 'msg': f'Error! Discount Code {discount_code} is not a valid discount code for this event!'}
    
    # Else, do code check
    else:
        discount = await get_discount_code_by_id(code_id)
        if discount is None:
            return {'success':False, 'msg':f'Error! Discount ID {code_id} is not valid!'}

    # Verify that the discount code is actually active
    if not discount.active:
        return {'success':False, 'msg':f'Error! This discount code is not currently active!'}

    # Then validate that event exists
    event = await get_event_by_id(event_id)
    if event is None:
        return {'success':False, 'msg':f'Error! Could not find event with ID {event_id}'}
    
    # Verify that the discount code is actually applicable for the event
    if str(discount.id) not in event.discount_codes:
        return {'success':False, 'msg':f'Error! Discount code {discount_code} is not a valid discount code for this event!'}
    
    # Handle additional validation to calculate how much uses left of the code the user has
    # Default uses_left = None if user has unlimited uses left
    uses_left = None
    # Only need to do validation if there actually is a usage limit
    if discount.max_uses is not None:
        # If the user has not used the code before, then the uses left is the total max uses
        if uid not in discount.usage_history:
            uses_left = discount.max_uses
        else:
            # If the user HAS used the code before, then the uses left is the total max uses - the historical uses
            uses_left = discount.max_uses - discount.usage_history[uid]
            if uses_left <= 0:
                return {'success':False, 'msg':'Error! You do not have any uses left for this discount code!'}
    
    # Return a success with information on the discount code usage
    return {'success':True, 'msg':'This discount code is valid!', 'is_percent':discount.is_percent, 'discount':discount.discount, 'uses_left':uses_left, 'id':discount.id}



# THIS IS A FUNCTION THAT WILL BE CALLED WHENEVER A USER FIRST APPLIES A DISCOUNT CODE IN ORDER TO VALIDATE AND VERIFY THAT THE CODE WORKS.
async def check_discount_code(request: Request, check: DiscountCodeCheck):
    return await do_discount_check(request.state.uid, check.event_id, discount_code=check.discount_code)

    


    


# ----------------------------
# PayPal flows
# ----------------------------

async def process_create_paid_registration(request: Request, registration: ChangeEventRegistration) -> Dict[str, Any]:
    # 1) Load + assemble instance
    instance = await get_event_instance_assembly_by_id(registration.event_instance_id)
    if not instance:
        return {"success": False, "msg": f"Error! Could not find instance with ID {registration.event_instance_id}"}

    try:
        assembled = AssembledEventInstance(**instance)
    except Exception as e:
        return {"success": False, "msg": f"Error! Could not assemble event instance: {e}"}

    # 2) Validation
    validation = await do_registration_validation(request, registration, assembled)
    if not validation.get("success"):
        return {"success": False, "msg": f"Error! Failed validation! Validation error message: {validation.get('msg')}"}

    details_map: Dict[str, Dict[str, Any]] = validation.get("details_map", {})
    regs: List[str] = validation.get("regs", [])
    # SINGLE SOURCE OF TRUTH: unit_price must come from validation
    unit_price = float(validation["unit_price"])

    # 3) Build item list + a parallel set of line_ids
    currency = "USD"
    user = request.state.user
    uid = request.state.uid

    items: List[Dict[str, Any]] = []
    txn_items: List[TransactionItem] = []

    for idx, reg_id in enumerate(regs):
        line_id = f"{idx:03d}-{uuid4().hex[:8]}"

        if reg_id == "SELF":
            full_name = f"{user.get('first_name','').strip()} {user.get('last_name','').strip()}".strip() or "You"
        else:
            info = details_map.get(reg_id, {})
            full_name = f"{info.get('first_name','').strip()} {info.get('last_name','').strip()}".strip() or reg_id

        # PayPal item
        items.append({
            "name": f"{assembled.default_title} - Event Registration for {full_name}",
            "quantity": "1",
            "unit_amount": {"currency_code": currency, "value": f"{unit_price:.2f}"},
            "category": "DIGITAL_GOODS",
            "sku": f"evt:{assembled.id}:line:{line_id}:person:{reg_id}",
        })

        # Ledger item
        txn_items.append(
            TransactionItem(
                line_id=line_id,
                person_id=reg_id,
                display_name=full_name,
                unit_price=unit_price,
                payment_type="paypal",
            )
        )

    if not items:
        return {"success": False, "msg": "No attendees to register. Nothing to pay."}

    total = round(sum(float(i["unit_amount"]["value"]) * int(i["quantity"]) for i in items), 2)

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": assembled.id,
            "custom_id": uid,
            "description": f"Event registrations for {assembled.default_title} - {len(items)} people",
            "amount": {
                "currency_code": currency,
                "value": f"{total:.2f}",
                "breakdown": {"item_total": {"currency_code": currency, "value": f"{total:.2f}"}},
            },
            "items": items,
        }],
        "application_context": {
            "brand_name": "Church Event Registration",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
            "return_url": f"{FRONTEND_URL}/event_payments/{assembled.id}/payment/success",
            "cancel_url": f"{FRONTEND_URL}/event_payments/{assembled.id}/payment/cancel",
        },
    }

    # 4) Create PayPal Order + preliminary ledger row
    paypal = await PayPalHelperV2.get_instance()
    await paypal.start()
    req_id = str(uuid4())

    resp = await paypal.post("/v2/checkout/orders", order_payload, request_id=req_id)
    if resp.status_code >= 300:
        return {"success": False, "msg": f"PayPal create order failed: {resp.text}"}

    data = resp.json()
    order_id = data.get("id")
    if not order_id:
        return {"success": False, "msg": "PayPal did not return an order id."}

    discount_meta = {}
    if registration.discount_code_id and regs:
        # Re-check validity to derive remaining uses (cheap safety and gives us 'uses_left')
        check = await do_discount_check(request.state.uid, assembled.event_id, code_id=registration.discount_code_id)
        if check.get("success"):
            uses_left = check["uses_left"]
            discounted_count = len(regs) if (uses_left is None) else max(0, min(len(regs), uses_left))
            discount_meta = {
                "discount_code_id": registration.discount_code_id,
                "discounted_count": discounted_count,
            }

    await create_preliminary_transaction(
        order_id=order_id,
        payer_uid=uid,
        event_instance_id=assembled.id,
        event_id=assembled.event_id,
        currency="USD",
        items=txn_items,
        raw_order_create_payload=order_payload,
        raw_order_create_response=data,
        meta={
            "flow": "event_registration",
            "people_count": len(txn_items),
            **discount_meta,
        },
    )

    approve = next((l["href"] for l in data.get("links", []) if l.get("rel") == "approve"), None)
    if not approve:
        return {"success": False, "msg": "PayPal did not return an approval URL."}

    return {"success": True, "order_id": order_id, "approve_url": approve}


async def process_capture_paid_registration(request: Request, body: CapturePaidRegistration) -> Dict[str, Any]:
    """
    Capture the PayPal order then reconcile registration to match the client-supplied final_details:
      1) Capture PayPal order (idempotent) and mirror capture_id onto ALL ledger lines.
      2) Compute delta vs current RegistrationDetails (regs/unregs).
      3) Validate the intended change under PayPal rules for this instance.
      4) Build lineage (order_id, line_id) for NEW additions from the captured ledger.
      5) Compute per-person refundable_amount (price minus proportional fee share).
      6) Apply additions via process_change_event_registration, passing both lineage_map and refundable_map.
    """
    uid = request.state.uid
    order_id = body.order_id
    instance_id = body.event_instance_id

    # 0) Load assembled instance
    instance_doc = await get_event_instance_assembly_by_id(instance_id)
    if not instance_doc:
        return {"success": False, "msg": f"Could not find event instance with id {instance_id}"}

    try:
        assembled = AssembledEventInstance(**instance_doc)
    except Exception as e:
        return {"success": False, "msg": f"Error! Could not assemble event instance: {e}"}

    # 1) Capture from PayPal (safe if called twice)
    paypal = await PayPalHelperV2.get_instance()
    await paypal.start()

    cap_resp = await paypal.post(
        f"/v2/checkout/orders/{order_id}/capture",
        json_body={},
        request_id=f"capture:{order_id}",
    )
    if cap_resp.status_code not in (200, 201):
        return {"success": False, "msg": f"PayPal capture failed with status {cap_resp.status_code}."}

    cap_json = cap_resp.json() or {}

    # 1b) Mirror capture -> event_transactions (idempotent)
    tx = await get_transaction_by_order_id(order_id)
    if not tx:
        return {"success": False, "msg": "Event transaction not found for this order_id."}
    
    # Rabbit suggested payer safety validation
    if tx.payer_uid != uid:
        return {"success": False, "msg": "You are not allowed to capture this transaction."}

    if tx.event_instance_id != instance_id:
       return {"success": False, "msg": "Order does not belong to this event instance."}


    if tx.status != "captured":
        # Try to extract a global capture id from the order capture response
        global_cap_id: Optional[str] = None
        for pu in cap_json.get("purchase_units") or []:
            payments = pu.get("payments") or {}
            captures = payments.get("captures") or []
            if captures:
                cid = captures[0].get("id")
                if cid:
                    global_cap_id = cid
                    break

        captured_lines: List[Tuple[str, Optional[str], LineStatus]] = []
        for it in (tx.items or []):
            cap_id = global_cap_id
            status: LineStatus = "captured" if cap_id else "pending"
            captured_lines.append((it.line_id, cap_id, status))

        tx2 = await mark_transaction_captured(
            order_id=order_id,
            capture_response=cap_json,
            captured_lines=captured_lines,
        )
        if not tx2:
            return {"success": False, "msg": "Failed to update transaction ledger on capture."}
        tx = tx2  # work with the updated ledger

    # 2) Compute delta vs desired final_details
    old_details = assembled.registration_details.get(uid) or None
    desired = body.final_details

    desired_self = bool(getattr(desired, "self_registered", False))
    desired_fam = list(getattr(desired, "family_registered", []) or [])

    old_self = bool(old_details.self_registered) if old_details else False
    old_fam = list((old_details.family_registered or []) if old_details else [])

    regs: List[str] = []
    unregs: List[str] = []

    if desired_self and not old_self:
        regs.append("SELF")
    if (not desired_self) and old_self:
        unregs.append("SELF")

    old_set, new_set = set(old_fam), set(desired_fam)
    regs += [fid for fid in new_set - old_set]
    unregs += [fid for fid in old_set - new_set]

    if not regs and not unregs:
        # Nothing to change; success for idempotency (e.g., page reloaded)
        return {"success": True, "msg": "No registration changes requested.", "seats_filled": assembled.seats_filled}

    # Discount code info from transaction meta
    meta = getattr(tx, "meta", {}) or {}
    dc_id = meta.get("discount_code_id")

    # 3) Validate the intended change under PayPal context
    change = ChangeEventRegistration(
        event_instance_id=instance_id,
        self_registered=(True if "SELF" in regs else (False if "SELF" in unregs else None)),
        family_members_registering=[x for x in regs if x != "SELF"],
        family_members_unregistering=[x for x in unregs if x != "SELF"],
        payment_type="paypal",
        discount_code_id=dc_id,
    )

    validation = await do_registration_validation(request, change, assembled)
    if not validation["success"]:
        return {"success": False, "msg": f"Error! Failed validation! Validation error message: {validation['msg']}"}

    # 4) Build lineage ONLY for NEW ADDITIONS from the (now) captured ledger
    tx = await get_transaction_by_order_id(order_id)
    if not tx:
        return {"success": False, "msg": "Event transaction not found after capture."}

    captured_by_person: Dict[str, Tuple[str, str]] = {}
    for it in (tx.items or []):
        if it.capture_id:
            captured_by_person[it.person_id] = (order_id, it.line_id)

    # 5) Compute per-person refundable amounts based on total fee
    #    refundable = unit_price - proportional share of the PayPal fee.
    refundable_by_person: Dict[str, float] = {}

    # First try whatever the ledger has (if you later start populating fee_amount there)
    total_fee: float = 0.0
    try:
        fee_from_ledger = getattr(tx, "fee_amount", None)
        if fee_from_ledger is not None:
            total_fee = float(fee_from_ledger or 0.0)
    except (TypeError, ValueError, AttributeError):
        total_fee = 0.0

    # If we don't have a fee there, derive it from the capture payload
    if not total_fee:
        _gross, fee_from_capture, _net = _extract_amounts_and_fees_from_capture_order(cap_json)
        if fee_from_capture is not None:
            try:
                total_fee = float(fee_from_capture or 0.0)
            except (TypeError, ValueError):
                total_fee = 0.0

    line_items = list(tx.items or [])
    total_gross = sum((float(it.unit_price or 0.0) for it in line_items), 0.0)

    if total_gross > 0 and total_fee > 0:
        remaining_fee = round(total_fee, 2)
        for idx, it in enumerate(line_items):
            line_price = round(float(it.unit_price or 0.0), 2)
            if idx == len(line_items) - 1:
                fee_share = round(remaining_fee, 2)
            else:
                fee_share = round((line_price / total_gross) * total_fee, 2)
                remaining_fee = round(remaining_fee - fee_share, 2)

            refundable = round(line_price - fee_share, 2)
            if refundable < 0:
                refundable = 0.0
            refundable_by_person[it.person_id] = refundable
    else:
        # No fee info, or zero fee: fall back to full line price
        for it in line_items:
            refundable_by_person[it.person_id] = round(float(it.unit_price or 0.0), 2)

    lineage_map: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
    refundable_map: Dict[str, float] = {}

    for pid in regs:
        # Every newly added person must have a captured ledger line we can stamp into PaymentDetails
        if pid in captured_by_person:
            lineage_map[pid] = captured_by_person[pid]
        else:
            return {"success": False, "msg": f"Missing captured line for registrant {pid}. Aborting."}

        # If we computed a refundable amount for this person, record it
        if pid in refundable_by_person:
            refundable_map[pid] = refundable_by_person[pid]

    # 6) Apply the change with lineage and per-person refundable amounts
    return await process_change_event_registration(
        request,
        change,
        lineage_map=lineage_map,
        refundable_map=refundable_map or None,
    )

async def _process_refunds_for_removals(
    *,
    request: Request,
    instance: AssembledEventInstance,
    old_details: Optional[RegistrationDetails],
    unregs: List[str],
) -> Dict[str, Any]:
    """
    For each person being REMOVED from an existing paid registration,
    attempt a PayPal refund using the stored lineage in PaymentDetails
    (transaction_id = order_id, line_id = per-person line).

    Rules:
    - Only refunds PayPal lines with payment_complete=True.
    - Enforces automatic_refund_deadline if configured on instance.
    - Skips free/door lines silently (no money to refund).
    - Fails fast if an expected PayPal lineage is missing or the refund API errors,
      returning an error so the unregister is NOT applied.

    Returns:
        {"success": True, "refunded": [(person_id, refund_id, amount), ...]}
        or {"success": False, "msg": "..."}
    """
    results: List[Tuple[str, str, float]] = []
    if not unregs:
        return {"success": True, "refunded": results}

    # If there are no previous details, nothing to refund.
    if not old_details:
        return {"success": True, "refunded": results}

    # Deadline check (automatic refund cutoff)
    now = datetime.now(timezone.utc)
    if instance.automatic_refund_deadline:
        cutoff, _ = _coerce_to_aware_utc(instance.automatic_refund_deadline)
        if cutoff and now > cutoff:
            return {
                "success": False,
                "msg": "Refund window has expired for this event. Please request a refund with the official portal or contact an administrator.",
            }

    # Build a simple accessor that returns (PaymentDetails, person_label)
    def _pd_for(person_id: str) -> Tuple[Optional[PaymentDetails], str]:
        if person_id == "SELF":
            return old_details.self_payment_details, "SELF"
        # family
        return (old_details.family_payment_details or {}).get(person_id), person_id

    # We will resolve captures from the transaction ledger (by order_id + line_id)
    # and then POST /v2/payments/captures/{capture_id}/refund for the exact line price.
    paypal = await PayPalHelperV2.get_instance()
    await paypal.start()

    # Normalize set to avoid double-refunds if duplicate ids were sent
    to_refund: Set[str] = set(unregs)

    for person_id in to_refund:
        pd, label = _pd_for(person_id)

        # No details recorded -> nothing to refund
        if not pd:
            continue

        # Only PayPal lines with a completed payment are subject to automatic refund here
        if pd.payment_type != "paypal" or not pd.payment_complete:
            continue

        order_id = pd.transaction_id  # this is the PayPal order id you stored at capture time
        line_id = pd.line_id
        if not order_id or not line_id:
            logging.critical(f"Refund failure: missing lineage for {label} (person {person_id})")
            continue
        # Look up the captured line and get its capture_id from the ledger
        tx = await get_transaction_by_order_id(order_id)
        if not tx:
            logging.critical(f"Refund failure: transaction not found for order_id {order_id} (person {person_id})")
            continue

        item = next((it for it in (tx.items or []) if it.line_id == line_id), None)
        if not item or not item.capture_id:
            logging.critical(f"Refund failure: captured line not found for order_id {order_id}, line_id {line_id} (person {person_id})")
            continue
         # Compute how much is still refundable for this line:
        #   base_refundable = refundable_amount (if set) else price
        #   remaining_from_pd = base_refundable - amount_refunded_so_far
        base_refundable = pd.refundable_amount if pd.refundable_amount is not None else pd.price
        try:
            base_refundable_f = round(float(base_refundable or 0.0), 2)
        except (TypeError, ValueError):
            base_refundable_f = 0.0

        already_refunded_pd = 0.0
        try:
            already_refunded_pd = round(float(getattr(pd, "amount_refunded", 0.0) or 0.0), 2)
        except (TypeError, ValueError):
            already_refunded_pd = 0.0

        remaining_from_pd = round(base_refundable_f - already_refunded_pd, 2)
        if remaining_from_pd <= 0:
            # Nothing left to refund for this line from the PaymentDetails perspective
            continue

        # Also respect the ledger-level remaining (in case of prior admin refunds)
        line_price = round(float(item.unit_price or 0.0), 2)
        line_refunded_ledger = round(float(item.refunded_total or 0.0), 2)
        remaining_from_ledger = round(line_price - line_refunded_ledger, 2)
        if remaining_from_ledger <= 0:
            continue

        amount = min(remaining_from_pd, remaining_from_ledger)
        amount = round(amount, 2)
        if amount <= 0:
            continue

        req_id = f"refund:{order_id}:{line_id}:{uuid4().hex}"
        resp = await paypal.post(
            f"/v2/payments/captures/{item.capture_id}/refund",
            json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
            request_id=req_id,
        )
        if resp.status_code not in (200, 201):
            logging.critical(f"Refund failed for {label}: PayPal responded {resp.status_code}.")
            continue
        rj = resp.json()
        refund_id = rj.get("id")
        if not refund_id:
            logging.critical(f"Refund failed for {label}: missing refund id.")
            continue
        # Mirror to ledger (append refund + flip line status if appropriate)
        ok = await append_refund_to_item(
            order_id=order_id,
            line_id=line_id,
            refund_id=refund_id,
            amount=amount,
            reason="user_unregistration",
            by_uid=request.state.uid,
        )
        if not ok:
            logging.critical(f"Refund ledger write failed for {label} after PayPal refund {refund_id}.")
            continue
        
        # Best-effort: bump amount_refunded on the PaymentDetails line as well.
        try:
            await increment_amount_refunded_for_line(
                event_instance_id=instance.id,
                uid=request.state.uid,
                person_id=person_id,
                amount=amount,
            )
        except Exception:
            pass

        results.append((label, refund_id, amount))

    return {"success": True, "refunded": results}


# ----------------------------
# Admin: Force Register
# ----------------------------

async def admin_force_register(request: Request, body: AdminForceChange) -> Dict[str, Any]:
    # Loose validation: instance exists & upcoming, ids "valid"
    assembled = await _load_upcoming_instance(body.event_instance_id)
    if not assembled:
        return {"success": False, "msg": "Instance not found or not upcoming."}

    if not body.user_id or not body.registrant_id:
        return {"success": False, "msg": "Invalid user_id or registrant_id."}

    # Read existing details for that user on this instance
    existing: Optional[RegistrationDetails] = assembled.registration_details.get(body.user_id) or None

    # Detect idempotency / already registered
    if body.registrant_id == "SELF":
        if existing and existing.self_registered:
            return {"success": True, "msg": "Already registered (SELF).", "seats_filled": assembled.seats_filled}
    else:
        if existing and body.registrant_id in (existing.family_registered or []):
            return {"success": True, "msg": "Already registered (family).", "seats_filled": assembled.seats_filled}

    # Build new RegistrationDetails by merging in the registrant
    if existing:
        self_registered = existing.self_registered or (body.registrant_id == "SELF")
        family_registered = list(existing.family_registered or [])
        if body.registrant_id != "SELF":
            family_registered.append(body.registrant_id)
            family_registered = list(dict.fromkeys(family_registered))
        details = RegistrationDetails(
            self_registered=self_registered,
            family_registered=family_registered,
            self_payment_details=existing.self_payment_details,
            family_payment_details=dict(existing.family_payment_details or {}),
        )
    else:
        self_registered = (body.registrant_id == "SELF")
        family_registered = ([] if self_registered else [body.registrant_id])
        details = RegistrationDetails(
            self_registered=self_registered,
            family_registered=family_registered,
            self_payment_details=None,
            family_payment_details={},
        )

    # Decide forced payment type: free (none/0) vs door (>0)
    price = round(float(body.price or 0.0), 2)
    pay_kind: Literal["free", "door"] = ("free" if price <= 0 else "door")
    pd = _build_forced_payment_details(pay_kind, price)

    # Stamp payment details on the specific registrant being added
    if body.registrant_id == "SELF":
        details.self_payment_details = pd
    else:
        fp = dict(details.family_payment_details or {})
        fp[body.registrant_id] = pd
        details.family_payment_details = fp

    # Seats: +1 for a new registrant
    seat_delta = 1

    # BYPASS CAPACITY: pass capacity_limit=None
    res = await update_registration(assembled.id, body.user_id, details, seat_delta, capacity_limit=None)
    return res


# ----------------------------
# Admin: Force Unregister (with PayPal refunds when applicable)
# ----------------------------

async def admin_force_unregister(request: Request, body: AdminForceChange) -> Dict[str, Any]:
    assembled = await _load_upcoming_instance(body.event_instance_id)
    if not assembled:
        return {"success": False, "msg": "Instance not found or not upcoming."}
    

    if not body.user_id or not body.registrant_id:
        return {"success": False, "msg": "Invalid user_id or registrant_id."}

    existing: Optional[RegistrationDetails] = assembled.registration_details.get(body.user_id) or None
    if not existing:
        return {"success": True, "msg": "No existing registration for this user on this instance."}

    # Nothing to do?
    is_self = (body.registrant_id == "SELF")
    if is_self and not existing.self_registered:
        return {"success": True, "msg": "SELF not registered; nothing to do."}
    if (not is_self) and (body.registrant_id not in (existing.family_registered or [])):
        return {"success": True, "msg": "Family member not registered; nothing to do."}

    # Build the new details with that registrant removed
    new_self_registered = existing.self_registered
    new_family = list(existing.family_registered or [])
    new_spd = existing.self_payment_details
    new_fpd = dict(existing.family_payment_details or {})

    if is_self:
        new_self_registered = False
        new_spd = None
    else:
        if body.registrant_id in new_family:
            new_family.remove(body.registrant_id)
        if body.registrant_id in new_fpd:
            new_fpd.pop(body.registrant_id, None)

    new_details = RegistrationDetails(
        self_registered=new_self_registered,
        family_registered=new_family,
        self_payment_details=new_spd,
        family_payment_details=new_fpd,
    )

    # Seats: -1 for a single removal
    seat_delta = -1

    # If PayPal was used for that particular registrant, issue refund (admin flow ignores refund deadline)
    label = "SELF" if is_self else body.registrant_id

    pd = (existing.self_payment_details if is_self else (existing.family_payment_details or {}).get(body.registrant_id))

    try:
        if pd and pd.payment_type == "paypal" and pd.payment_complete and pd.transaction_id and pd.line_id:
            paypal = await PayPalHelperV2.get_instance()
            await paypal.start()

            tx = await get_transaction_by_order_id(pd.transaction_id)
            if not tx:
                return {"success": False, "msg": f"Refund failed for {label}: transaction not found."}
            item = next((it for it in (tx.items or []) if it.line_id == pd.line_id), None)
            if not item or not item.capture_id:
                return {"success": False, "msg": f"Refund failed for {label}: captured line not found."}

            amount = round(float(pd.price - pd.amount_refunded), 2)
            if amount > 0:
                resp = await paypal.post(
                    f"/v2/payments/captures/{item.capture_id}/refund",
                    json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
                    request_id=f"refund:admin:{pd.transaction_id}:{pd.line_id}",
                )

                if resp.status_code not in (200, 201):
                    logging.critical(f"Refund failed for {label}: PayPal {resp.status_code}")
                    

                rj = resp.json()
                refund_id = rj.get("id")
                if not refund_id:
                    logging.critical(f"Refund failed for {label}: missing refund id")

                ok = await append_refund_to_item(
                    order_id=pd.transaction_id,
                    line_id=pd.line_id,
                    refund_id=refund_id,
                    amount=amount,
                    reason="admin_forced_unregistration",
                    by_uid=getattr(request.state, "uid", None),
                )
                if not ok:
                    logging.critical(f"Refund ledger write failed for {label} after PayPal refund {refund_id}.")
    except Exception:
        pass # previously already had logs

    # BYPASS CAPACITY: pass capacity_limit=None
    res = await update_registration(assembled.id, body.user_id, new_details, seat_delta, capacity_limit=None)
    return res


# ----------------------------
# SAFETY: Ensure event unregistration/refund logic is complete for deleting family members and accounts
# ----------------------------

async def unregister_family_member_across_upcoming(request: Request, family_id: str) -> Dict[str, Any]:
    """
    For the current user (request.state.uid), scan all UPCOMING instances where
    this family_id is registered and:
      - Refund PayPal line if payment_complete and refund deadline not passed,
        or if the line's automatic_refund_eligibility is True (override).
      - Unregister the family_id from the instance.
    Returns { success, msg, stats }
    """
    uid = request.state.uid
    now = datetime.now(timezone.utc)

    try:
        instance_docs: List[dict] = await get_upcoming_instances_for_user_family(uid, family_id)
    except Exception as e:
        return {"success": False, "msg": f"Failed to list upcoming instances: {e}", "stats": {}}
    
    if not instance_docs:
        return {"success": True, "msg": "No upcoming registrations found for this person.", "stats": {"scanned": 0, "updated": 0, "refunded": 0}}

    paypal = await PayPalHelperV2.get_instance()
    await paypal.start()

    updated = 0
    refunded = 0
    scanned = 0

    for inst_doc in instance_docs:
        event_doc = await get_event_doc_by_id(inst_doc.get("event_id"))

        scanned += 1

        # Assemble
        try:
            assembled = _assemble_event_instance_for_admin(instance_doc=inst_doc, event_doc=event_doc)
            assembled = AssembledEventInstance(**assembled)
        except Exception as e:
            return {"success": False, "msg": f"Could not assemble instance: {e}", "stats": {"scanned": scanned-1, "updated": updated, "refunded": refunded}}
        
        old_details: RegistrationDetails | None = assembled.registration_details.get(uid) or None
        if not old_details:
            # nothing to do
            continue

        if family_id not in (old_details.family_registered or []):
            # not registered on this instance
            continue

        # --- Conditional refund for this family member (PayPal only) ---
        pd = (old_details.family_payment_details or {}).get(family_id)
        if pd and pd.payment_type == "paypal" and pd.payment_complete and pd.transaction_id and pd.line_id:
            # Deadline enforcement with per-line override flag
            can_refund = True
            if assembled.automatic_refund_deadline:
                cutoff, _ = _coerce_to_aware_utc(assembled.automatic_refund_deadline)
                if cutoff and now > cutoff and not getattr(pd, "automatic_refund_eligibility", False):
                    can_refund = False

            if can_refund:
                tx = await get_transaction_by_order_id(pd.transaction_id)
                if not tx:
                    logging.critical("Refund failed: transaction not found")
                    continue
                item = next((it for it in (tx.items or []) if it.line_id == pd.line_id), None)
                if not item or not item.capture_id:
                    logging.critical("Refund failed: captured line not found")
                    continue


                amount = round(float(pd.refundable_amount - pd.amount_refunded), 2)
                if amount > 0:
                    resp = await paypal.post(
                        f"/v2/payments/captures/{item.capture_id}/refund",
                        json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
                        request_id=f"refund:family-delete:{pd.transaction_id}:{pd.line_id}",
                    )
                    if resp.status_code not in (200, 201):
                        logging.critical(f"Refund failed: PayPal {resp.status_code}")
                        continue
                    rj = resp.json()
                    refund_id = rj.get("id")
                    if not refund_id:
                        logging.critical("Refund failed: missing refund id")
                        continue

                    ok = await append_refund_to_item(
                        order_id=pd.transaction_id,
                        line_id=pd.line_id,
                        refund_id=refund_id,
                        amount=amount,
                        reason="family_member_deleted",
                        by_uid=uid,
                    )
                    if not ok:
                        logging.critical("Refund failed: ledger write failed")
                        continue
                    refunded += 1

        # --- Unregister this family member from the instance ---
        new_family = list(old_details.family_registered or [])
        if family_id in new_family:
            new_family.remove(family_id)

        new_details = RegistrationDetails(
            self_registered=old_details.self_registered,
            family_registered=new_family,
            self_payment_details=old_details.self_payment_details,
            family_payment_details={k: v for k, v in (old_details.family_payment_details or {}).items() if k != family_id},
        )

        # seats -1 for one removal; capacity check uses instance limit
        res = await update_registration(assembled.id, uid, new_details, seat_delta=-1, capacity_limit=assembled.max_spots)
        if not res or not res.get("success"):
            return {"success": False, "msg": f"Failed to unregister on instance {assembled.id}", "stats": {"scanned": scanned, "updated": updated, "refunded": refunded}}

        updated += 1

    return {"success": True, "msg": "Processed upcoming registrations for family member.", "stats": {"scanned": scanned, "updated": updated, "refunded": refunded}}

async def unregister_user_across_upcoming(
    request,
    *,
    target_uid: str,
    admin_initiated: bool,
) -> Dict[str, Any]:
    """
    Sweep ALL upcoming instances for target_uid:
      - Refund PayPal lines for SELF + every family member registration.
        - If admin_initiated=True -> ignore refund deadlines.
        - Else -> enforce automatic_refund_deadline unless payment_details.automatic_refund_eligibility=True
      - Unregister them from the instance.

    Returns: {success, msg, stats: {instances_scanned, instances_updated, lines_refunded}}
    """
    now = datetime.now(timezone.utc)

    try:
        instance_docs: List[dict] = await get_upcoming_instances_for_user(target_uid)
    except Exception as e:
        return {"success": False, "msg": f"Failed to list upcoming instances: {e}", "stats": {}}

    if not instance_docs:
        return {"success": True, "msg": "No upcoming registrations found for this user.", "stats": {"instances_scanned": 0, "instances_updated": 0, "lines_refunded": 0}}

    paypal = await PayPalHelperV2.get_instance()
    await paypal.start()

    instances_scanned = 0
    instances_updated = 0
    lines_refunded = 0

    for inst_doc in instance_docs:
        instances_scanned += 1

        # Assemble full instance (admin view) using event doc
        try:
            event_doc = await get_event_doc_by_id(inst_doc.get("event_id"))
            assembled_dict = _assemble_event_instance_for_admin(instance_doc=inst_doc, event_doc=event_doc)
            assembled = AssembledEventInstance(**assembled_dict)
        except Exception as e:
            return {"success": False, "msg": f"Assembly failed: {e}", "stats": {"instances_scanned": instances_scanned - 1, "instances_updated": instances_updated, "lines_refunded": lines_refunded}}

        # Pull current details for target user on this instance
        details: Optional[RegistrationDetails] = assembled.registration_details.get(target_uid) or None
        if not details:
            continue

        # Build the set of registrants to remove: SELF + all registered family
        to_remove: List[str] = []
        if details.self_registered:
            to_remove.append("SELF")
        to_remove += list(details.family_registered or [])
        if not to_remove:
            continue

        # Refund pass: for each registrant, decide eligibility and refund PayPal line if applicable
        for pid in list(dict.fromkeys(to_remove)):
            # Resolve payment details for this person
            if pid == "SELF":
                pd = details.self_payment_details
                label = "SELF"
            else:
                pd = (details.family_payment_details or {}).get(pid)
                label = pid

            if not pd:
                continue

            # Only PayPal lines with completed payment are refundable
            if pd.payment_type != "paypal" or not pd.payment_complete or not pd.transaction_id or not pd.line_id:
                continue

            # Deadline logic
            can_refund = True
            if not admin_initiated:
                if assembled.automatic_refund_deadline:
                    cutoff, _ = _coerce_to_aware_utc(assembled.automatic_refund_deadline)
                    if cutoff and now > cutoff and not getattr(pd, "automatic_refund_eligibility", False):
                        can_refund = False

            if not can_refund:
                continue

            # Refund this line
            tx = await get_transaction_by_order_id(pd.transaction_id)
            if not tx:
                return {"success": False, "msg": f"Refund failed for {label}: transaction not found.", "stats": {"instances_scanned": instances_scanned, "instances_updated": instances_updated, "lines_refunded": lines_refunded}}

            item = next((it for it in (tx.items or []) if it.line_id == pd.line_id), None)
            if not item or not item.capture_id:
                return {"success": False, "msg": f"Refund failed for {label}: captured line not found.", "stats": {"instances_scanned": instances_scanned, "instances_updated": instances_updated, "lines_refunded": lines_refunded}}


            if pd.price == 0:
                continue
            if admin_initiated:
                amount = round(float(pd.price - pd.amount_refunded), 2)
            else:
                amount = round(float(pd.refundable_amount - pd.amount_refunded), 2)
            if amount <= 0:
                continue

            req_id = f"refund:acct_delete:{pd.transaction_id}:{pd.line_id}:{uuid4().hex}"
            resp = await paypal.post(
                f"/v2/payments/captures/{item.capture_id}/refund",
                json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
                request_id=req_id,
            )
            if resp.status_code not in (200, 201):
                logging.critical(f"Refund failed for {label}: PayPal responded {resp.status_code}.")
                continue

            rj = resp.json()
            refund_id = rj.get("id")
            if not refund_id:
                logging.critical(f"Refund failed for {label}: missing refund id.")
                continue

            ok = await append_refund_to_item(
                order_id=pd.transaction_id,
                line_id=pd.line_id,
                refund_id=refund_id,
                amount=amount,
                reason=("admin_account_deleted" if admin_initiated else "user_account_deleted"),
                by_uid=getattr(request.state, "uid", None),
            )
            if not ok:
                logging.critical(f"Refund ledger write failed for {label} after PayPal refund {refund_id}.")
                continue

            lines_refunded += 1

        # Build new RegistrationDetails removing everyone for that user
        new_details = RegistrationDetails(
            self_registered=False,
            family_registered=[],
            self_payment_details=None,
            family_payment_details={},  # drop the removed lines
        )

        seat_delta = 0
        if details.self_registered:
            seat_delta -= 1
        seat_delta -= len(details.family_registered or [])

        # Persist update (atomic seat update)
        res = await update_registration(assembled.id, target_uid, new_details, seat_delta, capacity_limit=assembled.max_spots)
        if not res or not res.get("success"):
            return {"success": False, "msg": f"Failed to unregister on instance {assembled.id}", "stats": {"instances_scanned": instances_scanned, "instances_updated": instances_updated, "lines_refunded": lines_refunded}}

        instances_updated += 1

    return {
        "success": True,
        "msg": "Processed upcoming registrations for user.",
        "stats": {"instances_scanned": instances_scanned, "instances_updated": instances_updated, "lines_refunded": lines_refunded},
    }

async def admin_refund_event_transaction(
    request: Request,
    body: AdminRefundEventTransaction,
) -> Dict[str, Any]:
    """
    Admin refund entrypoint for an entire event transaction.

    Behavior:
      - refund_all == True, refund_amount is None:
            refund every PayPal line item by its full remaining amount.
      - refund_all == True, refund_amount = X:
            refund each PayPal line item by min(X, remaining_for_that_line).
      - refund_all == False:
            use line_map:
              * id -> None   => refund that line's full remaining.
              * id -> amount => refund that line by `amount` (capped by remaining).

    Notes:
      - Only PayPal lines with a capture_id participate.
      - Does NOT unregister anyone; it only touches the monetary ledger and PaymentDetails.amount_refunded.
    """
    order_id = (body.order_id or "").strip()
    if not order_id:
        return {"success": False, "msg": "order_id is required."}

    tx = await get_transaction_by_order_id(order_id)
    if not tx:
        return {"success": False, "msg": "Transaction not found for this order_id."}

    # Helper: per-line remaining amount from the ledger
    def _remaining_for(item: TransactionItem) -> float:
        try:
            price = float(item.unit_price or 0.0)
        except (TypeError, ValueError):
            price = 0.0
        refunded = float(item.refunded_total or 0.0)
        return round(price - refunded, 2)

    actions: List[Tuple[TransactionItem, float]] = []

    # Determine refund plan: which lines, and how much per line.
    total_refunded_total = sum((it.refunded_total for it in tx.items or []), 0.0)
    _ = total_refunded_total  # kept for potential logging / debugging

    if body.refund_all:
        # Ignore line_map in this mode
        base_amount: Optional[float] = None
        if body.refund_amount is not None:
            try:
                base_amount = round(float(body.refund_amount), 2)
            except Exception:
                return {"success": False, "msg": "Invalid refund_amount."}
            if base_amount <= 0:
                return {
                    "success": False,
                    "msg": "refund_amount must be greater than zero.",
                }

        for item in tx.items:
            # Only PayPal-captured lines can be refunded
            if not item.capture_id:
                continue

            remaining = _remaining_for(item)
            if remaining <= 0:
                continue

            if base_amount is None:
                amt = remaining  # full remaining for this line
            else:
                amt = min(base_amount, remaining)

            if amt > 0:
                actions.append((item, amt))
    else:
        # Per-line mode; line_map is required
        line_map = body.line_map or {}
        if not line_map:
            return {
                "success": False,
                "msg": "line_map is required when refund_all is False.",
            }

        for item in tx.items:
            if item.line_id not in line_map:
                continue

            if not item.capture_id:
                # Non-PayPal / non-captured line: skip
                continue

            remaining = _remaining_for(item)
            if remaining <= 0:
                continue

            raw_req = line_map[item.line_id]

            if raw_req is None:
                # Full remaining for this line
                amt = remaining
            else:
                try:
                    amt = round(float(raw_req), 2)
                except Exception:
                    return {
                        "success": False,
                        "msg": f"Invalid refund amount for line {item.line_id}.",
                    }

                if amt <= 0:
                    return {
                        "success": False,
                        "msg": f"Refund amount must be > 0 for line {item.line_id}.",
                    }

                if amt > remaining + 1e-6:
                    return {
                        "success": False,
                        "msg": (
                            f"Refund amount ({amt:.2f}) exceeds remaining refundable "
                            f"amount ({remaining:.2f}) for line {item.line_id}."
                        ),
                    }

            if amt > 0:
                actions.append((item, amt))

    if not actions:
        return {
            "success": False,
            "msg": "No refundable lines selected (all already fully refunded or no valid targets).",
        }

    # Use a single PayPal client for all refunds
    paypal = await PayPalHelperV2.get_instance()
    await paypal.start()

    refunds: List[Dict[str, Any]] = []

    for item, amt in actions:
        req_id = f"admin-event-refund:{order_id}:{item.line_id}:{uuid4().hex}"
        resp = await paypal.post(
            f"/v2/payments/captures/{item.capture_id}/refund",
            json_body={
                "amount": {
                    "currency_code": tx.currency,
                    "value": f"{amt:.2f}",
                }
            },
            request_id=req_id,
        )

        if resp.status_code not in (200, 201):
            return {
                "success": False,
                "msg": (
                    f"Refund failed for line {item.line_id}: "
                    f"PayPal responded {resp.status_code}."
                ),
            }

        payload = resp.json() or {}
        refund_id = payload.get("id")
        if not refund_id:
            return {
                "success": False,
                "msg": f"Refund failed for line {item.line_id}: missing refund id.",
            }

        # Mirror to ledger: append refund + update statuses.
        ok = await append_refund_to_item(
            order_id=order_id,
            line_id=item.line_id,
            refund_id=refund_id,
            amount=amt,
            reason=body.reason or "admin_manual_refund",
            by_uid=getattr(request.state, "uid", None),
        )
        if not ok:
            return {
                "success": False,
                "msg": f"Refund ledger write failed for line {item.line_id}.",
            }

        # Bump amount_refunded on the registration's PaymentDetails, if still present
        try:
            await increment_amount_refunded_for_line(
                event_instance_id=tx.event_instance_id,
                uid=tx.payer_uid,
                person_id=item.person_id,
                amount=amt,
            )
        except Exception:
            # Best-effort; don't break admin refunds if this fails
            pass

        refunds.append(
            {
                "line_id": item.line_id,
                "refund_id": refund_id,
                "amount": amt,
            }
        )

    # At this point, append_refund_to_item will have re-derived the overall
    # transaction status (captured / partially_refunded / fully_refunded).
    updated_tx = await get_transaction_by_order_id(order_id)

    return {
        "success": True,
        "order_id": order_id,
        "currency": tx.currency,
        "transaction_status": updated_tx.status if updated_tx else tx.status,
        "refunded_lines": refunds,
    }

def _extract_amounts_and_fees_from_capture_order(
    order: Dict[str, Any],
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Best-effort extraction of (gross, fee, net) from a PayPal
    /v2/checkout/orders/{id}/capture response.

    It expects either:
      - an order object with purchase_units[*].payments.captures[*], or
      - directly a capture-like object with seller_receivable_breakdown.
    """
    gross: Optional[float] = None
    fee: Optional[float] = None
    net: Optional[float] = None

    if not order:
        return gross, fee, net

    payload = order or {}
    r: Dict[str, Any] = payload

    # If this looks like an order, drill into the first capture.
    if "seller_receivable_breakdown" not in r:
        purchase_units = payload.get("purchase_units") or []
        if purchase_units:
            payments = (purchase_units[0].get("payments") or {})
            captures = payments.get("captures") or []
            if captures:
                r = captures[0]

    srb = r.get("seller_receivable_breakdown") or {}
    if srb:
        gross_amount = srb.get("gross_amount") or {}
        fee_amount = srb.get("paypal_fee") or srb.get("fee_amount") or {}
        net_amount = srb.get("net_amount") or {}

        v = gross_amount.get("value")
        if v is not None:
            try:
                gross = float(v)
            except (TypeError, ValueError):
                pass

        v = fee_amount.get("value")
        if v is not None:
            try:
                fee = float(v)
            except (TypeError, ValueError):
                pass

        v = net_amount.get("value")
        if v is not None:
            try:
                net = float(v)
            except (TypeError, ValueError):
                pass

    # Fallback to generic amount shape if needed
    amount = r.get("amount") or {}
    v = amount.get("value", amount.get("total"))
    if v is not None and gross is None:
        try:
            gross = float(v)
        except (TypeError, ValueError):
            pass

    # Derive missing piece if only two of the three are present
    if gross is not None and net is None and fee is not None:
        net = round(gross - fee, 2)
    elif gross is not None and net is not None and fee is None:
        fee = round(gross - net, 2)

    return gross, fee, net