import os
import shutil
import mimetypes
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from bson import ObjectId

from models.image_data import (
    ImageData,
    ImageResponse,
    UploadImageRequest,
    ImageUpdateRequest,
    FolderCreateRequest,
    FolderRenameRequest,
    FolderMoveRequest,
    FolderDeleteRequest,
    FolderResponse,
    create_image_data_with_id,
    get_image_data,
    list_image_data_advanced,
    update_image_data,
    delete_image_data,
    bulk_repath_prefix,
    bulk_delete_by_prefix,
)

# -------------------------------------------------------------------
# Filesystem helpers
# -------------------------------------------------------------------

ASSETS_ROOT = os.getenv("ASSETS_ROOT", "data/assets")
THUMBS_ROOT = os.getenv("THUMBS_ROOT", "data/thumbnails")

def _normalize_rel(path_rel: Optional[str]) -> str:
    """Return a clean 'a/b/c' style relative path ('' allowed for Home)."""
    if path_rel is None:
        return ""
    rel = path_rel.replace("\\", "/").strip().strip("/")
    # basic traversal guard
    if rel.startswith(".") or "/./" in rel or ".." in rel:
        raise ValueError("Invalid relative path")
    return rel

def _safe_join_root(folder_rel: Optional[str]) -> str:
    base = ASSETS_ROOT
    rel = _normalize_rel(folder_rel)
    return base if rel == "" else os.path.join(base, rel).replace("\\", "/")

def _safe_join_thumbs(folder_rel: Optional[str]) -> str:
    base = THUMBS_ROOT
    rel = _normalize_rel(folder_rel)
    return base if rel == "" else os.path.join(base, rel).replace("\\", "/")

def _ensure_dirs(folder_rel: Optional[str]) -> Tuple[str, str]:
    asset_dir = _safe_join_root(folder_rel)
    thumb_dir = _safe_join_thumbs(folder_rel)
    os.makedirs(asset_dir, exist_ok=True)
    os.makedirs(thumb_dir, exist_ok=True)
    return asset_dir, thumb_dir

def _extract_folder_rel(path: str) -> str:
    norm = path.replace("\\", "/")
    prefix = "data/assets/"
    if not norm.startswith(prefix):
        return ""
    folder = os.path.dirname(norm[len(prefix):]).replace("\\", "/")
    return folder.strip("/")

def _guard_folder_target(path_rel: str) -> str:
    rel = _normalize_rel(path_rel)
    if rel == "":
        raise ValueError("Home folder is immutable")
    return rel

def _public_url_for(id_str: str) -> str:
    base = os.getenv("BACKEND_URL", "").rstrip('/')
    path = f"/api/v1/assets/public/id/{id_str}"
    return f"{base}{path}" if base else path

def _thumb_url_for(id_str: str) -> str:
    base = os.getenv("BACKEND_URL", "").rstrip('/')
    path = f"/api/v1/assets/public/id/{id_str}?thumbnail=true"
    return f"{base}{path}" if base else path

def _serialize_doc(doc: Dict[str, Any]) -> ImageResponse:
    _id = str(doc["_id"])
    folder = _extract_folder_rel(doc["path"])
    return ImageResponse(
        id=_id,
        name=doc.get("name") or _id,
        extension=doc.get("extension") or "",
        description=doc.get("description"),
        folder=folder,  # '' for Home
        path=doc["path"],
        public_url=_public_url_for(_id),
        thumb_url=_thumb_url_for(_id),
    )

def _list_immediate_subfolders_fs(folder_rel: Optional[str]) -> List[str]:
    base = _safe_join_root((folder_rel or "").strip("/") or None)
    if not os.path.isdir(base):
        return []
    names: List[str] = []
    try:
        with os.scandir(base) as it:
            for entry in it:
                if entry.is_dir():
                    names.append(entry.name)
    except FileNotFoundError:
        return []
    return sorted(names)

# -------------------------------------------------------------------
# Listing / uploads
# -------------------------------------------------------------------

async def list_images_and_folders(
    folder: Optional[str],
    q: Optional[str],
    limit: Optional[int],
    *,
    page: int = 1,
    page_size: int = 60,
    scope: str = "current",  # 'current' | 'all'
) -> Dict[str, Any]:
    # Decide folder filtering
    folder_filter: Optional[str]
    if q:
        folder_filter = _normalize_rel(folder or "") if scope == "current" else None
    else:
        folder_filter = _normalize_rel(folder or "")

    if limit and not q:
        page_size = min(page_size, limit)

    docs, total = await list_image_data_advanced(
        folder_prefix=folder_filter,
        name_q=q,
        page=page,
        page_size=page_size,
    )

    files: List[ImageResponse] = [_serialize_doc(d) for d in docs]

    # Browsing: folders visible from filesystem; keep only files in current level
    if not q:
        folders = _list_immediate_subfolders_fs(folder_filter or "")
        files = [f for f in files if f.folder == (folder_filter or "")]
    else:
        folders = []

    return {
        "files": files,
        "folders": folders,
        "total": total,
        "page": page,
        "page_size": page_size,
    }

async def list_subfolders(folder: Optional[str]) -> List[str]:
    return _list_immediate_subfolders_fs(_normalize_rel(folder or ""))

async def upload_images(payload: UploadImageRequest, files: List[Any]) -> List[ImageResponse]:
    """
    Name defaults:
      - Use uploaded base name (without extension) if available.
      - Fallback to ObjectId.
    Disk filename stays <oid>.<ext>.
    """
    folder_rel = _normalize_rel(payload.folder or "")
    asset_dir, _ = _ensure_dirs(folder_rel if folder_rel != "" else None)

    out: List[ImageResponse] = []
    for up in files:
        oid = ObjectId()
        original = up.filename or ""
        base_without_ext = os.path.splitext(os.path.basename(original))[0].strip() if original else ""
        ext = os.path.splitext(original)[1].lstrip(".").lower() or "bin"
        filename_on_disk = f"{str(oid)}.{ext}"
        asset_path = os.path.join(asset_dir, filename_on_disk).replace("\\", "/")

        with open(asset_path, "wb") as f:
            f.write(up.file.read())

        rel_folder = folder_rel  # '' allowed
        db_path = f"data/assets/{rel_folder + '/' if rel_folder else ''}{filename_on_disk}"
        friendly_name = base_without_ext if base_without_ext else str(oid)

        data = ImageData(
            name=friendly_name,
            description=payload.description,
            extension=ext,
            path=db_path,
        )
        await create_image_data_with_id(oid, data)
        out.append(
            ImageResponse(
                id=str(oid),
                name=friendly_name,
                extension=ext,
                description=payload.description,
                folder=rel_folder,
                path=db_path,
                public_url=_public_url_for(str(oid)),
                thumb_url=_thumb_url_for(str(oid)),
            )
        )

    return out

# -------------------------------------------------------------------
# Image CRUD
# -------------------------------------------------------------------

async def get_image_by_id(id_str: str) -> Optional[ImageResponse]:
    doc = await get_image_data(id_str)
    if not doc:
        return None
    return _serialize_doc(doc)

async def update_image_by_id(id_str: str, payload: ImageUpdateRequest) -> Optional[ImageResponse]:
    doc = await get_image_data(id_str)
    if not doc:
        return None

    current_path = doc["path"]
    current_folder_rel = _extract_folder_rel(current_path)
    current_ext = doc.get("extension") or os.path.splitext(current_path)[1].lstrip(".").lower()

    new_name = payload.new_name if payload.new_name is not None else doc.get("name")
    new_desc = payload.new_description if payload.new_description is not None else doc.get("description")

    if payload.move_to_folder is None:
        target_folder_rel = current_folder_rel
    else:
        target_folder_rel = _normalize_rel(payload.move_to_folder)  # '' allowed

    base_name = (new_name or str(doc["_id"])).strip() or str(doc["_id"])
    filename_on_disk = f"{str(doc['_id'])}.{current_ext}"  # physical filename is immutable by id
    asset_dir, _ = _ensure_dirs(target_folder_rel if target_folder_rel != "" else None)
    new_fs_path = os.path.join(asset_dir, filename_on_disk).replace("\\", "/")
    old_fs_path = os.path.join(_safe_join_root(current_folder_rel if current_folder_rel != "" else None),
                               os.path.basename(current_path)).replace("\\", "/")

    new_db_path = f"data/assets/{(target_folder_rel + '/' ) if target_folder_rel else ''}{filename_on_disk}"
    if new_db_path != current_path:
        os.makedirs(os.path.dirname(new_fs_path), exist_ok=True)
        if os.path.exists(old_fs_path):
            shutil.move(old_fs_path, new_fs_path)

    await update_image_data(id_str, {
        "name": base_name,
        "description": new_desc,
        "path": new_db_path,
        "extension": current_ext,
        "updated_at": datetime.utcnow(),
    })

    new_doc = await get_image_data(id_str)
    if not new_doc:
        return None
    return _serialize_doc(new_doc)

async def delete_image_by_id(id_str: str) -> bool:
    doc = await get_image_data(id_str)
    if not doc:
        return False
    folder_rel = _extract_folder_rel(doc["path"])
    fs_dir = _safe_join_root(folder_rel if folder_rel != "" else None)
    fs_path = os.path.join(fs_dir, os.path.basename(doc["path"]))
    if os.path.exists(fs_path):
        os.remove(fs_path)
    return await delete_image_data(id_str)

async def remove_image_by_id(id_str: str) -> bool:
    return await delete_image_by_id(id_str)

# -------------------------------------------------------------------
# Folder ops
# -------------------------------------------------------------------

async def create_folder(payload: FolderCreateRequest) -> FolderResponse:
    """
    Create a folder (and matching thumbnails folder).
    Duplicate-safe within the same parent.
    """
    rel = _normalize_rel(payload.path)
    if rel == "":
        # prevent accidental "create Home"
        return FolderResponse(path=rel, action="create", details={"created": False, "reason": "invalid"})
    parent = os.path.dirname(rel).replace("\\", "/").strip("/")
    parent_dir = _safe_join_root(parent if parent != "" else None)
    target_dir = _safe_join_root(rel if rel != "" else None)

    os.makedirs(parent_dir, exist_ok=True)

    # Duplicate if folder already exists (either assets or thumbs mirror)
    if os.path.exists(target_dir):
        return FolderResponse(path=rel, action="create", details={"created": False, "reason": "duplicate"})

    _ensure_dirs(rel)
    return FolderResponse(path=rel, action="create", details={"created": True})

async def rename_folder(payload: FolderRenameRequest) -> FolderResponse:
    rel = _guard_folder_target(payload.path)
    parent = os.path.dirname(rel).replace("\\", "/").strip("/")
    new_rel = os.path.join(parent, _normalize_rel(payload.new_name)).replace("\\", "/").strip("/")

    old_assets = _safe_join_root(rel)
    new_assets = _safe_join_root(new_rel)
    old_thumbs = _safe_join_thumbs(rel)
    new_thumbs = _safe_join_thumbs(new_rel)

    # Duplicate safety across mirrors
    if os.path.exists(new_assets) or os.path.exists(new_thumbs):
        return FolderResponse(path=rel, action="rename", details={"renamed": False, "reason": "duplicate"})

    os.makedirs(os.path.dirname(new_assets), exist_ok=True)
    if os.path.exists(old_assets):
        shutil.move(old_assets, new_assets)
    if os.path.exists(old_thumbs):
        os.makedirs(os.path.dirname(new_thumbs), exist_ok=True)
        shutil.move(old_thumbs, new_thumbs)

    old_prefix = f"data/assets/{rel}/"
    new_prefix = f"data/assets/{new_rel}/"
    modified = await bulk_repath_prefix(old_prefix, new_prefix)

    return FolderResponse(path=new_rel, action="rename", details={"docs_repathed": modified, "renamed": True})

async def move_folder_ctrl(payload: FolderMoveRequest) -> FolderResponse:
    rel = _guard_folder_target(payload.path)
    new_parent = _normalize_rel(payload.new_parent or "")
    new_rel = os.path.join(new_parent, os.path.basename(rel)).replace("\\", "/").strip("/")

    if rel == new_rel:
        return FolderResponse(path=rel, action="move", details={"moved": False, "reason": "same parent"})

    old_assets = _safe_join_root(rel)
    new_assets = _safe_join_root(new_rel if new_rel != "" else None)
    old_thumbs = _safe_join_thumbs(rel)
    new_thumbs = _safe_join_thumbs(new_rel if new_rel != "" else None)

    # Duplicate safety
    if os.path.exists(new_assets) or os.path.exists(new_thumbs):
        return FolderResponse(path=rel, action="move", details={"moved": False, "reason": "duplicate"})

    os.makedirs(os.path.dirname(new_assets), exist_ok=True)
    if os.path.exists(old_assets):
        shutil.move(old_assets, new_assets)
    if os.path.exists(old_thumbs):
        os.makedirs(os.path.dirname(new_thumbs), exist_ok=True)
        shutil.move(old_thumbs, new_thumbs)

    old_prefix = f"data/assets/{rel}/"
    new_prefix = f"data/assets/{new_rel}/" if new_rel else "data/assets/"
    modified = await bulk_repath_prefix(old_prefix, new_prefix)

    return FolderResponse(path=new_rel, action="move", details={"docs_repathed": modified, "moved": True})

async def delete_folder_ctrl(payload: FolderDeleteRequest) -> FolderResponse:
    """
    Delete a folder. If delete_within:
      - remove everything under assets/ and thumbnails/ and delete DB docs under that prefix.
    Else:
      - move immediate children (files + subfolders) up one level (both trees),
        repath DB docs via prefix change, then remove the emptied folder.
    """
    rel = _guard_folder_target(payload.path)

    assets_dir = _safe_join_root(rel)
    thumbs_dir = _safe_join_thumbs(rel)
    parent_rel = os.path.dirname(rel).replace("\\", "/").strip("/")
    parent_dir = _safe_join_root(parent_rel if parent_rel != "" else None)
    parent_thumb = _safe_join_thumbs(parent_rel if parent_rel != "" else None)

    # Make sure parents exist if we're going to move things up.
    if not payload.delete_within:
        os.makedirs(parent_dir, exist_ok=True)
        os.makedirs(parent_thumb, exist_ok=True)

    if payload.delete_within:
        if os.path.isdir(assets_dir):
            shutil.rmtree(assets_dir, ignore_errors=True)
        if os.path.isdir(thumbs_dir):
            shutil.rmtree(thumbs_dir, ignore_errors=True)
        deleted = await bulk_delete_by_prefix(f"data/assets/{rel}/")
        return FolderResponse(path=rel, action="delete", details={"deleted_docs": deleted})
    else:
        # Move immediate children (files or subfolders) up one level in both trees.
        if os.path.isdir(assets_dir):
            for name in os.listdir(assets_dir):
                src = os.path.join(assets_dir, name)
                dst = os.path.join(parent_dir, name)
                # ensure destination parent exists (for subfolders)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.move(src, dst)
            # now remove emptied folder (ignore if already gone)
            shutil.rmtree(assets_dir, ignore_errors=True)

        if os.path.isdir(thumbs_dir):
            for name in os.listdir(thumbs_dir):
                src = os.path.join(thumbs_dir, name)
                dst = os.path.join(parent_thumb, name)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.move(src, dst)
            shutil.rmtree(thumbs_dir, ignore_errors=True)

        # DB repath keeps sub-structure (since we moved subfolders as subfolders).
        old_prefix = f"data/assets/{rel}/"
        new_prefix = f"data/assets/{parent_rel}/" if parent_rel else "data/assets/"
        modified = await bulk_repath_prefix(old_prefix, new_prefix)
        return FolderResponse(path=parent_rel, action="delete_move_up", details={"docs_repathed": modified})

# -------------------------------------------------------------------
# Public file serving
# -------------------------------------------------------------------

async def load_image_bytes_by_id(id_str: str, thumbnail: bool = False) -> Tuple[Optional[bytes], str]:
    doc = await get_image_data(id_str)
    if not doc:
        return None, "application/octet-stream"

    rel_folder = _extract_folder_rel(doc["path"])
    filename = os.path.basename(doc["path"])

    if thumbnail:
        folder_path = _safe_join_thumbs(rel_folder if rel_folder != "" else None)
        fs_path = os.path.join(folder_path, filename)
        if not os.path.exists(fs_path):
            folder_path = _safe_join_root(rel_folder if rel_folder != "" else None)
            fs_path = os.path.join(folder_path, filename)
    else:
        folder_path = _safe_join_root(rel_folder if rel_folder != "" else None)
        fs_path = os.path.join(folder_path, filename)

    if not os.path.exists(fs_path):
        return None, "application/octet-stream"

    with open(fs_path, "rb") as f:
        data = f.read()

    media_type = mimetypes.guess_type(fs_path)[0] or "application/octet-stream"
    return data, media_type
