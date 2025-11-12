import re
from typing import Optional


def validate_slug(v: Optional[str], allow_none: bool = True, allow_root: bool = False) -> Optional[str]:
    """
    Validate slug format - only lowercase letters, numbers, and hyphens allowed.
    
    Args:
        v: The slug value to validate
        allow_none: Whether to allow None/empty values (default: True)
        allow_root: Whether to allow "/" as a valid slug for root/home pages (default: False)
    
    Returns:
        Validated slug string or None
    
    Raises:
        ValueError: If slug format is invalid
    
    Examples:
        >>> validate_slug("my-page")
        'my-page'
        >>> validate_slug("/", allow_root=True)
        '/'
        >>> validate_slug("My Page!")
        ValueError: Invalid slug format: only lowercase letters, numbers and hyphens allowed
    """
    if v is None:
        if allow_none:
            return None
        raise ValueError("Slug cannot be None")
    
    s = str(v).strip()
    
    if s == "":
        if allow_none:
            return None
        raise ValueError("Slug cannot be empty")
    
    # Special case: allow "/" for home/root page if enabled
    if allow_root and s == "/":
        return s
    
    # Only allow lowercase letters, numbers and dashes (no consecutive dashes)
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", s):
        raise ValueError(
            "Invalid slug format: only lowercase letters, numbers and hyphens allowed"
        )
    
    if len(s) > 200:
        raise ValueError("Slug too long (max 200 characters)")
    
    return s
