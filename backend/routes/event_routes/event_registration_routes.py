from fastapi import APIRouter, Request, Body

from controllers.event_controllers.event_registration_controller import ChangeEventRegistration, event_registration_central_controller, process_capture_paid_registration, CapturePaidRegistration, check_discount_code, DiscountCodeCheck, AdminForceChange, admin_force_register, admin_force_unregister, AdminRefundEventTransaction, admin_refund_event_transaction


event_registration_router = APIRouter(prefix="/events-registrations", tags=["Events Registrations Routes"])

admin_event_registration_router = APIRouter(prefix="/admin-events-registrations", tags=["Admin Events Registrations Routes"])

@event_registration_router.put("/change-registration")
async def change_event_registration(request: Request, details:ChangeEventRegistration = Body(...)):
    return await event_registration_central_controller(request, details)

@event_registration_router.put("/capture-paid-reg")
async def capture_paid_registration(request: Request, body: CapturePaidRegistration = Body(...)):
    return await process_capture_paid_registration(request, body)

@event_registration_router.post("/validate-discount-code")
async def validate_discount_code(request: Request, body:DiscountCodeCheck = Body(...)):
    return await check_discount_code(request, body)

@admin_event_registration_router.put("/force-register")
async def force_register(request: Request, body: AdminForceChange = Body(...)):
    return await admin_force_register(request, body)

@admin_event_registration_router.put("/force-unregister")
async def force_unregister(request: Request, body: AdminForceChange = Body(...)):
    return await admin_force_unregister(request, body)

@admin_event_registration_router.post("/refund")
async def admin_refund_event_transaction_route(
    request: Request,
    body: AdminRefundEventTransaction = Body(...),
):
    """
    Admin-only endpoint to refund an event transaction.

    Behavior:
      - refund_all = true, refund_amount = null
            -> refund each PayPal line's remaining amount (full per line).
      - refund_all = true, refund_amount = X
            -> refund min(X, remaining) for each PayPal line.
      - refund_all = false
            -> use line_map:
                {
                  "line-id-1": null,   // full remaining on that line
                  "line-id-2": 5.00    // refund $5 on that line
                }

    Does NOT unregister any people; it only refunds money.
    """
    return await admin_refund_event_transaction(request, body)