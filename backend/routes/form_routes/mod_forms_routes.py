from fastapi import APIRouter, HTTPException, Request, status
import re

from bson import ObjectId

from models.form import (
	FormCreate,
	FormOut,
	FormUpdate,
	create_form,
	delete_form,
	delete_form_responses,
	get_form_responses,
	update_form,
)
from mongo.database import DB


mod_forms_router = APIRouter(prefix="/forms", tags=["Forms"])


@mod_forms_router.post("/", response_model=FormOut, status_code=status.HTTP_201_CREATED)
async def create_new_form(form: FormCreate, request: Request) -> FormOut:
	uid = request.state.uid
	# Prevent accidental duplicate form names — let client choose to override
	existing = await DB.db.forms.find_one(
		{"user_id": uid, "title": {"$regex": f"^{re.escape(form.title)}$", "$options": "i"}}
	)
	if existing:
		# Return 409 with existing id so client can prompt to override
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail={"message": "Form already exists", "existing_id": str(existing.get("_id"))},
		)

	# If a slug is provided, ensure it's unique across visible forms for all users
	if getattr(form, "slug", None):
		slug_existing = await DB.db.forms.find_one({"slug": form.slug})
		if slug_existing:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail={"message": "Slug already exists"},
			)

	created = await create_form(form, uid)
	if not created:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create form")
	return created


@mod_forms_router.put("/{form_id}", response_model=FormOut)
async def update_existing_form(form_id: str, update: FormUpdate, request: Request) -> FormOut:
	uid = request.state.uid

	# Check for duplicate form title (case-insensitive) if title is being updated
	if "title" in getattr(update, "__fields_set__", set()) and update.title:
		existing = await DB.db.forms.find_one(
			{
				"user_id": uid,
				"title": {"$regex": f"^{re.escape(update.title)}$", "$options": "i"},
				"_id": {"$ne": ObjectId(form_id)},
			}
		)
		if existing:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail={"message": "Form name already exists", "existing_id": str(existing.get("_id"))},
			)

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


@mod_forms_router.delete("/{form_id}/responses")
async def purge_form_responses(form_id: str, request: Request) -> dict:
	uid = request.state.uid
	ok = await delete_form_responses(form_id, uid)
	if not ok:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
	return {"message": "Responses deleted"}


@mod_forms_router.get("/{form_id}/responses")
async def list_form_responses(form_id: str, request: Request, skip: int = 0, limit: int | None = None):
	"""Return responses for the specified form for moderator review."""

	uid = request.state.uid
	data = await get_form_responses(form_id, uid, skip=skip, limit=limit)
	if data is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
	return data