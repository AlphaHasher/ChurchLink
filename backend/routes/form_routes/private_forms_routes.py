from fastapi import APIRouter, HTTPException, Query, Request, status
from typing import List

from models.form import (
	FormOut,
	get_form_by_id_unrestricted,
	list_all_forms,
	search_all_forms,
      add_response_by_slug
)


private_forms_router = APIRouter(prefix="/forms", tags=["Forms"])


@private_forms_router.get("/", response_model=List[FormOut])
async def list_user_forms(request: Request, skip: int = 0, limit: int = Query(100, le=500)) -> List[FormOut]:
	return await list_all_forms(skip=skip, limit=limit)


@private_forms_router.get("/search", response_model=List[FormOut])
async def search_user_forms(
	request: Request,
	name: str | None = None,
	ministry: str | None = None,
	skip: int = 0,
	limit: int = Query(100, le=500),
) -> List[FormOut]:
	return await search_all_forms(name=name, ministry=ministry, skip=skip, limit=limit)


@private_forms_router.get("/{form_id}", response_model=FormOut)
async def get_form(form_id: str, request: Request) -> FormOut:
	form = await get_form_by_id_unrestricted(form_id)
	if not form:
		raise HTTPException(status_code=404, detail="Form not found")
	return form

@private_forms_router.post("/slug/{slug}/responses")
async def submit_response_by_slug(slug: str, request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")
    
    print("READ PAYLOAD")
    print(payload)

    ok, info = await add_response_by_slug(slug, payload, user_id=request.state.uid, passed_payment=payload.get("payment"))
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=info or "Failed to store response")
    return {"message": "Response recorded", "response_id": info}


__all__ = ["private_forms_router"]
