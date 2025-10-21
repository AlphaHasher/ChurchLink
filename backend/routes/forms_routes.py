from fastapi import APIRouter, Request, HTTPException, status, Query
from typing import List
import re
import logging

from models.form import (
    FormCreate,
    FormOut,
    FormUpdate,
    get_form_by_slug,
    search_forms,
    create_form,
    list_forms,
    get_form_by_id,
    update_form,
    delete_form,
    add_response_by_slug,
    delete_form_responses,
    get_form_responses,
)
from mongo.database import DB
from bson import ObjectId
from models.transaction import Transaction
from datetime import datetime


mod_forms_router = APIRouter(prefix="/forms", tags=["Forms"])


@mod_forms_router.post("/", response_model=FormOut, status_code=status.HTTP_201_CREATED)
async def create_new_form(form: FormCreate, request: Request) -> FormOut:
    uid = request.state.uid
    # Prevent accidental duplicate form names — let client choose to override
    existing = await DB.db.forms.find_one({"user_id": uid, "title": {"$regex": f"^{re.escape(form.title)}$", "$options": "i"}})
    if existing:
        # Return 409 with existing id so client can prompt to override
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Form already exists", "existing_id": str(existing.get("_id"))})

    # If a slug is provided, ensure it's unique across visible forms for all users
    if getattr(form, "slug", None):
        slug_existing = await DB.db.forms.find_one({"slug": form.slug})
        if slug_existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Slug already exists"})

    created = await create_form(form, uid)
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create form")
    return created


@mod_forms_router.get("/", response_model=List[FormOut])
async def list_user_forms(request: Request, skip: int = 0, limit: int = Query(100, le=500)) -> List[FormOut]:
    uid = request.state.uid
    return await list_forms(uid, skip=skip, limit=limit)


@mod_forms_router.get("/search", response_model=List[FormOut])
async def search_user_forms(request: Request, name: str | None = None, folder: str | None = None, skip: int = 0, limit: int = Query(100, le=500)) -> List[FormOut]:
    uid = request.state.uid
    return await search_forms(uid, name=name, folder=folder, skip=skip, limit=limit)


@mod_forms_router.get("/{form_id}", response_model=FormOut)
async def get_form(form_id: str, request: Request) -> FormOut:
    uid = request.state.uid
    form = await get_form_by_id(form_id, uid)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


@mod_forms_router.get('/slug/{slug}', response_model=FormOut)
async def get_form_by_slug_route(slug: str):
    form = await get_form_by_slug(slug)
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


@mod_forms_router.put("/{form_id}", response_model=FormOut)
async def update_existing_form(form_id: str, update: FormUpdate, request: Request) -> FormOut:
    uid = request.state.uid
    
    # Check for duplicate form title (case-insensitive) if title is being updated
    if "title" in getattr(update, "__fields_set__", set()) and update.title:
        existing = await DB.db.forms.find_one({
            "user_id": uid, 
            "title": {"$regex": f"^{re.escape(update.title)}$", "$options": "i"},
            "_id": {"$ne": ObjectId(form_id)}
        })
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Form name already exists", "existing_id": str(existing.get("_id"))})
    
    # If slug is provided in the update payload (including explicit null), validate uniqueness when not null
    if "slug" in getattr(update, "__fields_set__", set()):
        if update.slug is not None:
            found = await DB.db.forms.find_one({"slug": update.slug, "_id": {"$ne": ObjectId(form_id)}})
            if found:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Slug already exists"})
    updated = await update_form(form_id, uid, update)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found or update failed")
    return updated


@mod_forms_router.delete("/{form_id}")
async def remove_form(form_id: str, request: Request) -> dict:
    uid = request.state.uid
    ok = await delete_form(form_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return {"message": "Form deleted"}


@mod_forms_router.delete('/{form_id}/responses')
async def purge_form_responses(form_id: str, request: Request) -> dict:
    uid = request.state.uid
    ok = await delete_form_responses(form_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return {"message": "Responses deleted"}



@mod_forms_router.post('/slug/{slug}/responses')
async def submit_response_by_slug(slug: str, request: Request):
    # Public endpoint: append response to form responses array
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid JSON')
    # If available, capture the submitting user's id (authenticated session)
    uid = getattr(request.state, 'uid', None)
    ok, info = await add_response_by_slug(slug, payload, user_id=uid)
    if not ok:
        # info may be an error message
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=info or 'Failed to store response')
    return {"message": "Response recorded", "response_id": info}


@mod_forms_router.get('/{form_id}/responses')
async def list_form_responses(form_id: str, request: Request, skip: int = 0, limit: int | None = None):
    """Return responses for a form belonging to the current user.

    Response shape: { count: number, items: [{ submitted_at: ISO, response: object, payment_info?: object }] }
    """
    uid = request.state.uid
    data = await get_form_responses(form_id, uid, skip=skip, limit=limit)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    
    # Add payment information to responses if available
    try:
        # Get all transactions for this form
        transactions = await Transaction.get_transactions_by_form(form_id)
        
        if transactions:
            # Add payment info to each response
            for item in data.get("items", []):
                try:
                    submitted_at = item.get("submitted_at")
                    if not submitted_at:
                        continue
                    
                    # Parse submission time
                    try:
                        if isinstance(submitted_at, str):
                            submission_time = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
                        else:
                            submission_time = submitted_at
                    except:
                        continue
                    
                    # Look for transactions within 10 minutes of submission
                    matching_transaction = None
                    for transaction in transactions:
                        if hasattr(transaction, 'created_on') and transaction.created_on:
                            try:
                                # Parse transaction time
                                if isinstance(transaction.created_on, str):
                                    transaction_time = datetime.fromisoformat(transaction.created_on.replace('Z', '+00:00'))
                                else:
                                    transaction_time = transaction.created_on
                                    
                                time_diff = abs((submission_time - transaction_time).total_seconds())
                                
                                # If within 10 minutes and no closer match found
                                if time_diff <= 600:  # 10 minutes
                                    if not matching_transaction or time_diff < abs((submission_time - datetime.fromisoformat(matching_transaction.created_on.replace('Z', '+00:00'))).total_seconds()):
                                        matching_transaction = transaction
                            except Exception:
                                continue
                    
                    # Add payment information if found
                    if matching_transaction:
                        item["payment_info"] = {
                            "transaction_id": matching_transaction.transaction_id,
                            "amount": matching_transaction.amount,
                            "status": matching_transaction.status,
                            "payment_method": getattr(matching_transaction, 'payment_method', 'unknown'),
                            "payer_name": getattr(matching_transaction, 'name', None),
                            "payer_email": getattr(matching_transaction, 'user_email', None),
                            "payment_time": getattr(matching_transaction, 'created_on', None),
                            "order_id": getattr(matching_transaction, 'order_id', None)
                        }
                        
                except Exception as e:
                    logging.error(f"Error adding payment info to response: {e}")
                    continue
                    
    except Exception as e:
        logging.error(f"Error fetching payment information: {e}")

    return data
