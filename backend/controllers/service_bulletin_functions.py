from __future__ import annotations

from typing import List

from fastapi import HTTPException, Request, status

from models.service_bulletin import (
	ServiceBulletinCreate,
	ServiceBulletinUpdate,
	create_service,
	delete_service,
	get_service_by_id,
	get_service_by_title,
	reorder_services,
	update_service,
)
from helpers.permission_helpers import require_bulletin_permissions


async def process_create_service(service: ServiceBulletinCreate, request: Request):
	"""Create new service with permission validation"""
	require_bulletin_permissions(request)

	created_service = await create_service(service)
	if created_service is None:
		# Model returns None for duplicate key errors or other failures
		# Check if it's a duplicate by attempting to find the service
		existing = await get_service_by_title(service.title)
		if existing is not None:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail=f"A service with the title '{service.title}' already exists. Please use a unique title.",
			)
		# Otherwise it's an internal server error
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

	require_bulletin_permissions(request)

	existing_service = await get_service_by_id(service_id)
	if existing_service is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Service not found",
		)

	success = await update_service(service_id, service_update)
	if not success:
		# Check if it's a duplicate key error
		if service_update.title and service_update.title != existing_service.title:
			conflict = await get_service_by_title(service_update.title, exclude_id=service_id)
			if conflict:
				raise HTTPException(
					status_code=status.HTTP_409_CONFLICT,
					detail=f"A service with the title '{service_update.title}' already exists. Please use a unique title.",
				)
		# Otherwise it's an internal server error
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="Error updating service bulletin",
		)

	updated_service = await get_service_by_id(service_id)
	return updated_service


async def process_delete_service(service_id: str, request: Request):
	"""Delete service with permission check"""
	require_bulletin_permissions(request)

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
	require_bulletin_permissions(request)

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
	require_bulletin_permissions(request)

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
