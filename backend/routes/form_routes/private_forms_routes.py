from fastapi import APIRouter, HTTPException, Query, Request
from typing import List

from models.form import (
	FormOut,
	get_visible_form_by_id,
	list_visible_folders,
	list_visible_forms,
	search_visible_forms,
)


private_forms_router = APIRouter(prefix="/forms", tags=["Forms"])


@private_forms_router.get("/", response_model=List[FormOut])
async def list_user_forms(request: Request, skip: int = 0, limit: int = Query(100, le=500)) -> List[FormOut]:
	return await list_visible_forms(skip=skip, limit=limit)


@private_forms_router.get("/search", response_model=List[FormOut])
async def search_user_forms(
	request: Request,
	name: str | None = None,
	folder: str | None = None,
	skip: int = 0,
	limit: int = Query(100, le=500),
) -> List[FormOut]:
	return await search_visible_forms(name=name, folder=folder, skip=skip, limit=limit)


@private_forms_router.get("/folders", response_model=List[dict])
async def list_user_folders(request: Request):
	return await list_visible_folders()


@private_forms_router.get("/{form_id}", response_model=FormOut)
async def get_form(form_id: str, request: Request) -> FormOut:
	form = await get_visible_form_by_id(form_id)
	if not form:
		raise HTTPException(status_code=404, detail="Form not found")
	return form


__all__ = ["private_forms_router"]
