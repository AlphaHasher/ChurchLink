from fastapi import APIRouter, Request, HTTPException, status, Query
from typing import List

from models.form import (
    FormCreate,
    FormOut,
    FormUpdate,
    get_form_by_slug,
    search_forms,
    create_folder,
    list_folders,
    create_form,
    list_forms,
    get_form_by_id,
    update_form,
    delete_form,
    add_response_by_slug,
    get_form_responses,
)
from mongo.database import DB
from bson import ObjectId


mod_forms_router = APIRouter(prefix="/forms", tags=["Forms"])


@mod_forms_router.post("/", response_model=FormOut, status_code=status.HTTP_201_CREATED)
async def create_new_form(form: FormCreate, request: Request) -> FormOut:
    uid = request.state.uid
    # Prevent accidental duplicate form names — let client choose to override
    existing = await DB.db.forms.find_one({"user_id": uid, "title": {"$regex": f"^{form.title}$", "$options": "i"}})
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


@mod_forms_router.post('/folders', status_code=status.HTTP_201_CREATED)
async def create_new_folder(request: Request, name: str):
    uid = request.state.uid
    # Check for duplicate folder name (case-insensitive)
    existing = await DB.db.form_folders.find_one({"user_id": uid, "name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Folder already exists')

    created = await create_folder(uid, name)
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to create folder')
    return created


@mod_forms_router.get('/folders', response_model=List[dict])
async def list_user_folders(request: Request):
    uid = request.state.uid
    return await list_folders(uid)


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



@mod_forms_router.post('/slug/{slug}/responses')
async def submit_response_by_slug(slug: str, request: Request):
    # Public endpoint: append response to form responses array
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid JSON')
    ok, info = await add_response_by_slug(slug, payload)
    if not ok:
        # info may be an error message
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=info or 'Failed to store response')
    return {"message": "Response recorded", "response_id": info}


@mod_forms_router.get('/{form_id}/responses')
async def list_form_responses(form_id: str, request: Request, skip: int = 0, limit: int = Query(100, le=500)):
    """Return responses for a form belonging to the current user.

    Response shape: { count: number, items: [{ submitted_at: ISO, response: object }] }
    """
    uid = request.state.uid
    data = await get_form_responses(form_id, uid, skip=skip, limit=limit)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return data
