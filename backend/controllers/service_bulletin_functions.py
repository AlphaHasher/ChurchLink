from __future__ import annotations

from typing import List

from fastapi import HTTPException, Request, status

from models.service_bulletin import (
	ServiceBulletinCreate,
	ServiceBulletinUpdate,
	create_service,
	delete_service,
	get_service_by_id,
	get_service_by_title_and_week,
	reorder_services,
	update_service,
)


def _require_bulletin_permissions(request: Request) -> tuple[dict, list[str]]:
	"""Validate user has bulletin_editing or admin permission"""
	user_perms = getattr(request.state, "perms", {})
	user_roles = getattr(request.state, "roles", [])

	if not (
		user_perms.get("admin")
		or user_perms.get("bulletin_editing")
	):
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="Insufficient permissions for bulletin management",
		)

	return user_perms, user_roles


async def process_create_service(service: ServiceBulletinCreate, request: Request):
	"""Create new service with permission and uniqueness validation"""
	_require_bulletin_permissions(request)

	# Check for duplicate title in the same week
	existing = await get_service_by_title_and_week(service.title, service.display_week)
	if existing is not None:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="Service with this title already exists for this week",
		)

	created_service = await create_service(service)
	if created_service is None:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error creating service bulletin",
		)
	return created_service


async def process_edit_service(
	service_id: str,
	service_update: ServiceBulletinUpdate,
	request: Request,
):
	"""Update service with uniqueness checks"""
	if not service_update.model_dump(exclude_unset=True):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="No updates provided",
		)

	_require_bulletin_permissions(request)

	existing_service = await get_service_by_id(service_id)
	if existing_service is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Service not found",
		)

	# Check for title conflicts if title or display_week is being updated
	if service_update.title or service_update.display_week:
		new_title = service_update.title or existing_service.title
		new_week = service_update.display_week or existing_service.display_week
		
		conflict = await get_service_by_title_and_week(new_title, new_week)
		if conflict and conflict.id != service_id:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail="Service with this title already exists for this week",
			)

	success = await update_service(service_id, service_update)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error updating service bulletin",
		)

	updated_service = await get_service_by_id(service_id)
	return updated_service


async def process_delete_service(service_id: str, request: Request):
	"""Delete service with permission check"""
	_require_bulletin_permissions(request)

	existing_service = await get_service_by_id(service_id)
	if existing_service is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Service not found",
		)

	success = await delete_service(service_id)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error deleting service bulletin",
		)

	return {"message": "Service deleted successfully"}


async def process_publish_toggle(
	service_id: str,
	published: bool,
	request: Request,
):
	"""Toggle service published status"""
	_require_bulletin_permissions(request)

	existing_service = await get_service_by_id(service_id)
	if existing_service is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Service not found",
		)

	service_update = ServiceBulletinUpdate(published=published)
	success = await update_service(service_id, service_update)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error toggling service publish status",
		)

	updated_service = await get_service_by_id(service_id)
	status_text = "published" if published else "unpublished"
	return {
		"message": f"Service {status_text} successfully",
		"service": updated_service
	}


async def process_reorder_services(service_ids: List[str], request: Request):
	"""Reorder services by updating order field"""
	_require_bulletin_permissions(request)

	if not service_ids:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="No service IDs provided",
		)

	success = await reorder_services(service_ids)
	if not success:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error reordering services",
		)

	return {"message": "Services reordered successfully"}
