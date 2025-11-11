from fastapi import APIRouter, Request, Body

from controllers.event_controllers.event_registration_controller import ChangeEventRegistration, event_registration_central_controller, process_capture_paid_registration, CapturePaidRegistration, check_discount_code, DiscountCodeCheck


event_registration_router = APIRouter(prefix="/events-registrations", tags=["Events Registrations Routes"])

@event_registration_router.put("/change-registration")
async def change_event_registration(request: Request, details:ChangeEventRegistration = Body(...)):
    return await event_registration_central_controller(request, details)

@event_registration_router.put("/capture-paid-reg")
async def capture_paid_registration(request: Request, body: CapturePaidRegistration = Body(...)):
    return await process_capture_paid_registration(request, body)

@event_registration_router.post("/validate-discount-code")
async def validate_discount_code(request: Request, body:DiscountCodeCheck = Body(...)):
    return await check_discount_code(request, body)