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
    get_upcoming_instances_for_user
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
) -> PaymentDetails:
    details: Dict[str, Any] = {}

    # Set the payment type, price, and discount code based on inputs simply
    details["payment_type"] = payment_type
    details["price"] = price
    details['discount_code_id'] = discount_code_id

    # Paypal only ever calls this after the payment is caught and confirmed
    # So payment is complete only if free or paypal is the type
    if payment_type in ("free", "paypal"):
        details["payment_complete"] = True
    else:
        details["payment_complete"] = False

    # Set automatic refund eligibility to False
    # It is only supposed to be there as an "emergency lever" if the event is changed after a user is registered
    # Therefore, upon first register, set to False
    details["automatic_refund_eligibility"] = False


    # Set transaction and line IDs to real IDs if using paypal
    if payment_type == 'paypal':
        # Conditionally attach transaction lineage
        fields = _paymentdetails_fields()
        if "transaction_id" in fields and transaction_id:
            details["transaction_id"] = transaction_id
        if "line_id" in fields and line_id:
            details["line_id"] = line_id

    # If not using paypal, there is no transaction or line id and we set to None.
    else:
        details['transaction_id'] = None
        details['line_id'] = None

    return PaymentDetails(**details)

# Builds PaymentDetails forcefully created by an admin force registration
def _build_forced_payment_details(kind: Literal["free", "door"], price: float) -> PaymentDetails:
    # payment_complete only for "free"; "door" means pay later
    return PaymentDetails(
        payment_type=kind,
        price=round(float(price or 0), 2),
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
) -> RegistrationDetails:
    details: Dict[str, Any] = {}

    # Very simply set the registration statuses to our input values
    details["self_registered"] = self_registered
    details["family_registered"] = family_registered

    # Set self_payment_details only if the self is registered
    if self_registered:
        # If self already registered, keep old details
        if old_details and old_details.self_registered:
            details["self_payment_details"] = old_details.self_payment_details
        # Otherwise, create new payment details
        else:
            t_id = l_id = None
            if lineage_map and "SELF" in lineage_map:
                t_id, l_id = lineage_map["SELF"]
            details["self_payment_details"] = await create_new_payment_details(
                registration.payment_type, unit_price, discount_code_id=registration.discount_code_id,transaction_id=t_id, line_id=l_id
            )
    # Self payment details should be None if self not signed up
    else:
        details["self_payment_details"] = None

    # Create a new dict for family_payment_details
    family_payment_dict: Dict[str, PaymentDetails] = {}
    for family in family_registered:
        # If family is in regs that means they are a new registrant and we need to create new PaymentDetails
        if family in regs:
            t_id = l_id = None
            if lineage_map and family in lineage_map:
                t_id, l_id = lineage_map[family]
            family_payment_dict[family] = await create_new_payment_details(
                registration.payment_type, unit_price, discount_code_id=registration.discount_code_id, transaction_id=t_id, line_id=l_id
            )
        # Otherwise keep old payment details
        else:
            # Do a quick validation check
            if old_details and getattr(old_details, "family_payment_details", None) and (
                family in old_details.family_payment_details
            ):
                family_payment_dict[family] = old_details.family_payment_details.get(family)  # type: ignore[assignment]
            # If this failed. Panic and create new (defensive default)
            else:
                t_id = l_id = None
                if lineage_map and family in lineage_map:
                    t_id, l_id = lineage_map[family]
                family_payment_dict[family] = await create_new_payment_details(
                    registration.payment_type, unit_price, discount_code_id=registration.discount_code_id,transaction_id=t_id, line_id=l_id
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

    # Give a var from data from validation
    seat_delta = validation["seat_delta"]
    unit_price = validation["unit_price"]
    self_registered = validation["self_registered"]
    family_registered = validation["family_registered"]
    regs = validation["regs"]
    unregs = validation['unregs']

    old_details = assembled.registration_details.get(request.state.uid) or None

    # Try to create proper EventDetails, return error if failure
    try:
        details = await create_new_reg_details(
            registration,
            old_details,
            self_registered,
            family_registered,
            unit_price,
            regs,
            lineage_map=lineage_map,
        )
    except Exception as e:
        return {"success": False, "msg": f"Error! Could not assemble new RegistrationDetails: {e}"}

    # Handle the final reg update
    res = await update_registration(assembled.id, request.state.uid, details, seat_delta, assembled.max_spots)
    res['details_map'] = validation['details_map']

    if not res['success']:
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
                if rollback and rollback.get('success'):
                    res['seats_filled'] = rollback.get('seats_filled', res.get('seats_filled'))
                    rollback_succeeded = True
                else:
                    # Log critical: rollback failed, database inconsistent
                    logging.error(f"CRITICAL: Rollback failed for user {request.state.uid}, instance {assembled.id}")
            
            # Update res to reflect failure, preserving existing fields
            res['success'] = False
            if rollback_succeeded:
                res['msg'] = f"Refunds failed, registration rolled back: {refund_res['msg']}"
            elif old_details is None:
                res['msg'] = f"Refunds failed (no prior registration to rollback): {refund_res['msg']}"
            else:
                res['msg'] = f"Refunds failed AND rollback failed (critical): {refund_res['msg']}"
            
            return res

    # If registration successful, inc code uses
    if res['success']:
        if registration.discount_code_id is not None:
            code_validation = validation['code_validation']
            limit = code_validation['uses_left']

            if limit is None or limit >= len(regs):
                inc = len(regs)

            else:
                inc = limit

            await increment_discount_usage(registration.discount_code_id, request.state.uid, inc)

    return res



async def calculate_discounted_event_price(base_price: float, is_percent:bool, discount_value: float, count:int, limit:int=None,):
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
            if reg_open > now:
                return {"success": False, "msg": "Error! You cannot register for an event before the opening date!"}

        # If registration deadline passed, forbid registration
        if instance.registration_deadline:
            reg_dead, err = _coerce_to_aware_utc(instance.registration_deadline)
            if now >= reg_dead:
                return {"success": False, "msg": "Error! You cannot register for an event after the registration deadline!"}

    # If the event date has already passed, forbid any update
    ev_date, err = _coerce_to_aware_utc(instance.date)
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
    aware_date, err = _coerce_to_aware_utc(instance.date)
    age = relativedelta(aware_date.date(), aware_dob.date()).years

    # Identify if age is out of bounds
    if instance.min_age and age < instance.min_age:
        return False
    if instance.max_age and age > instance.max_age:
        return False

    return True

async def do_discount_check(uid: str, event_id:str, *, discount_code:str=None, code_id:str=None):

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
      4) Refund removals first (per-line) using stored lineage in PaymentDetails.
      5) Apply additions with lineage (order_id, line_id) stamped into new PaymentDetails.
      6) Persist via update_registration (atomic seat update inside).
    """
    uid = request.state.uid
    order_id = body.order_id
    instance_id = body.event_instance_id

    # 0) Load assembled instance
    instance_doc = await get_event_instance_assembly_by_id(instance_id)
    if not instance_doc:
        return {"success": False, "msg": f"Error! Could not find instance with ID {instance_id}"}
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
    cap_json = cap_resp.json()

    # 1b) Mirror capture to ledger lines
    tx = await get_transaction_by_order_id(order_id)
    if not tx:
        return {"success": False, "msg": "Transaction not found for order."}

    # If already captured (every line has a capture_id), treat as idempotent and reuse.
    already_captured = all(bool(it.capture_id) for it in (tx.items or []))
    if not already_captured:
        # PayPal often returns a SINGLE capture for the entire order.
        try:
            pu = (cap_json.get("purchase_units") or [])[0]
            captures = (pu.get("payments") or {}).get("captures") or []
        except Exception:
            captures = []

        global_cap_id = captures[0]["id"] if captures and "id" in captures[0] else None

        captured_lines: List[Tuple[str, Optional[str], LineStatus]] = []
        for it in (tx.items or []):
            cap_id = global_cap_id  # stamp the same capture on each line (common for PayPal v2)
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

    # Get discount code details
    meta = getattr(tx, "meta", {}) or {}
    dc_id = meta.get("discount_code_id")
    disc_count = int(meta.get("discounted_count") or 0)

    # 2) Compute delta vs desired final_details
    old_details = assembled.registration_details.get(uid) or None
    desired = body.final_details

    desired_self = bool(desired.self_registered)
    desired_fam = list(desired.family_registered or [])

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

    # 3) Validate the intended change under PayPal context
    unit_price = assembled.member_price if (assembled.member_price is not None and request.state.user.get("membership")) else assembled.price
    unit_price = round(float(unit_price), 2)

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
    captured_by_person: Dict[str, Tuple[str, str]] = {}
    for it in (tx.items or []):
        if it.capture_id:
            captured_by_person[it.person_id] = (order_id, it.line_id)

    lineage_map: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
    for pid in regs:
        # Every newly added person must have a captured ledger line we can stamp into PaymentDetails
        if pid in captured_by_person:
            lineage_map[pid] = captured_by_person[pid]
        else:
            return {"success": False, "msg": f"Missing captured line for registrant {pid}. Aborting."}

    # 5) Apply the change with lineage for additions
    return await process_change_event_registration(request, change, lineage_map=lineage_map)


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
                "msg": "Refund window has expired for this event. Please contact an administrator.",
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
            return {
                "success": False,
                "msg": f"Unable to refund {label}: missing transaction lineage (order_id/line_id).",
            }

        # Look up the captured line and get its capture_id from the ledger
        tx = await get_transaction_by_order_id(order_id)
        if not tx:
            return {"success": False, "msg": f"Unable to refund {label}: transaction not found."}

        item = next((it for it in (tx.items or []) if it.line_id == line_id), None)
        if not item or not item.capture_id:
            return {"success": False, "msg": f"Unable to refund {label}: captured line not found."}

        # Execute the refund for the line unit price (use original price from PaymentDetails)
        amount = round(float(pd.price or 0.0), 2)
        if amount <= 0:
            # Nothing charged for this line; skip
            continue

        req_id = f"refund:{order_id}:{line_id}"
        resp = await paypal.post(
            f"/v2/payments/captures/{item.capture_id}/refund",
            json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
            request_id=req_id,
        )
        if resp.status_code not in (200, 201):
            return {
                "success": False,
                "msg": f"Refund failed for {label}: PayPal responded {resp.status_code}.",
            }
        rj = resp.json()
        refund_id = rj.get("id")
        if not refund_id:
            return {"success": False, "msg": f"Refund failed for {label}: missing refund id."}

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
            return {"success": False, "msg": f"Refund ledger write failed for {label}."}

        results.append((label, refund_id, amount))

    return {"success": True, "refunded": results}


# ----------------------------
# Admin Helpers (loose validation)
# ----------------------------

async def _load_upcoming_instance(instance_id: str) -> Optional[AssembledEventInstance]:
    instance_doc = await get_event_instance_assembly_by_id(instance_id)
    if not instance_doc:
        return None
    try:
        assembled = AssembledEventInstance(**instance_doc)
    except Exception:
        return None

    # upcoming-only requirement
    now = datetime.now(timezone.utc)
    ev_dt, _ = _coerce_to_aware_utc(assembled.date)
    if not ev_dt or now >= ev_dt:
        return None
    return assembled


def _build_forced_payment_details(kind: Literal["free", "door"], price: float) -> PaymentDetails:
    # payment_complete only for "free"; "door" means pay later
    return PaymentDetails(
        payment_type=kind,
        price=round(float(price or 0), 2),
        payment_complete=(kind == "free"),
        discount_code_id=None,
        automatic_refund_eligibility=False,
        transaction_id=None,
        line_id=None,
        is_forced=True, 
    )


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
    if pd and pd.payment_type == "paypal" and pd.payment_complete and pd.transaction_id and pd.line_id:
        paypal = await PayPalHelperV2.get_instance()
        await paypal.start()

        tx = await get_transaction_by_order_id(pd.transaction_id)
        if not tx:
            return {"success": False, "msg": f"Refund failed for {label}: transaction not found."}
        item = next((it for it in (tx.items or []) if it.line_id == pd.line_id), None)
        if not item or not item.capture_id:
            return {"success": False, "msg": f"Refund failed for {label}: captured line not found."}

        amount = round(float(pd.price or 0.0), 2)
        if amount > 0:
            resp = await paypal.post(
                f"/v2/payments/captures/{item.capture_id}/refund",
                json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
                request_id=f"refund:admin:{pd.transaction_id}:{pd.line_id}",
            )
            if resp.status_code not in (200, 201):
                return {"success": False, "msg": f"Refund failed for {label}: PayPal responded {resp.status_code}."}

            rj = resp.json()
            refund_id = rj.get("id")
            if not refund_id:
                return {"success": False, "msg": f"Refund failed for {label}: missing refund id."}

            ok = await append_refund_to_item(
                order_id=pd.transaction_id,
                line_id=pd.line_id,
                refund_id=refund_id,
                amount=amount,
                reason="admin_forced_unregistration",
                by_uid=getattr(request.state, "uid", None),
            )
            if not ok:
                return {"success": False, "msg": f"Refund ledger write failed for {label}."}

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
                    return {"success": False, "msg": "Refund failed: transaction not found", "stats": {"scanned": scanned, "updated": updated, "refunded": refunded}}
                item = next((it for it in (tx.items or []) if it.line_id == pd.line_id), None)
                if not item or not item.capture_id:
                    return {"success": False, "msg": "Refund failed: captured line not found", "stats": {"scanned": scanned, "updated": updated, "refunded": refunded}}

                amount = round(float(pd.price or 0.0), 2)
                if amount > 0:
                    resp = await paypal.post(
                        f"/v2/payments/captures/{item.capture_id}/refund",
                        json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
                        request_id=f"refund:family-delete:{pd.transaction_id}:{pd.line_id}",
                    )
                    if resp.status_code not in (200, 201):
                        return {"success": False, "msg": f"Refund failed: PayPal {resp.status_code}", "stats": {"scanned": scanned, "updated": updated, "refunded": refunded}}
                    rj = resp.json()
                    refund_id = rj.get("id")
                    if not refund_id:
                        return {"success": False, "msg": "Refund failed: missing refund id", "stats": {"scanned": scanned, "updated": updated, "refunded": refunded}}

                    ok = await append_refund_to_item(
                        order_id=pd.transaction_id,
                        line_id=pd.line_id,
                        refund_id=refund_id,
                        amount=amount,
                        reason="family_member_deleted",
                        by_uid=uid,
                    )
                    if not ok:
                        return {"success": False, "msg": "Refund failed: ledger write failed", "stats": {"scanned": scanned, "updated": updated, "refunded": refunded}}
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

            amount = round(float(pd.price or 0.0), 2)
            if amount <= 0:
                continue

            req_id = f"refund:acct_delete:{pd.transaction_id}:{pd.line_id}"
            resp = await paypal.post(
                f"/v2/payments/captures/{item.capture_id}/refund",
                json_body={"amount": {"currency_code": "USD", "value": f"{amount:.2f}"}},
                request_id=req_id,
            )
            if resp.status_code not in (200, 201):
                return {"success": False, "msg": f"Refund failed for {label}: PayPal responded {resp.status_code}.", "stats": {"instances_scanned": instances_scanned, "instances_updated": instances_updated, "lines_refunded": lines_refunded}}

            rj = resp.json()
            refund_id = rj.get("id")
            if not refund_id:
                return {"success": False, "msg": f"Refund failed for {label}: missing refund id.", "stats": {"instances_scanned": instances_scanned, "instances_updated": instances_updated, "lines_refunded": lines_refunded}}

            ok = await append_refund_to_item(
                order_id=pd.transaction_id,
                line_id=pd.line_id,
                refund_id=refund_id,
                amount=amount,
                reason=("admin_account_deleted" if admin_initiated else "user_account_deleted"),
                by_uid=getattr(request.state, "uid", None),
            )
            if not ok:
                return {"success": False, "msg": f"Refund ledger write failed for {label}.", "stats": {"instances_scanned": instances_scanned, "instances_updated": instances_updated, "lines_refunded": lines_refunded}}

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