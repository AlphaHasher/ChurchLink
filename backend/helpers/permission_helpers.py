"""
Shared permission validation helpers for controllers.
"""

from fastapi import HTTPException, Request, status


def require_bulletin_permissions(request: Request) -> tuple[dict, list[str]]:
	"""
	Validate user has bulletin_editing or admin permission.
	
	Args:
		request: FastAPI request object with state containing perms and roles
		
	Returns:
		Tuple of (user_perms dict, user_roles list)
		
	Raises:
		HTTPException: 403 FORBIDDEN if user lacks required permissions
	"""
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
