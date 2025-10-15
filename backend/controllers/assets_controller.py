import os
import shutil
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
    list_image_data,
    update_image_data,
    delete_image_data,
    bulk_repath_prefix,
    bulk_delete_by_prefix,
)

# -------------------------------------------------------------------
# Filesystem helpers
# -------------------------------------------------------------------

ASSETS_ROOT = os.getenv("ASSETS_ROOT", "data/assets")
THUMBS_ROOT = os.getenv("THUMBS_ROOT", "data/thumbs")

def _safe_join_root(folder_rel: Optional[str]) -> str:
    base = ASSETS_ROOT
    if not folder_rel:
        return base
    return os.path.join(base, folder_rel.replace("\\", "/")).replace("\\", "/")

def _safe_join_thumbs(folder_rel: Optional[str]) -> str:
    base = THUMBS_ROOT
    if not folder_rel:
        return base
    return os.path.join(base, folder_rel.replace("\\", "/")).replace("\\", "/")

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
    rel = path_rel.strip().strip("/")
    if rel == "":
        raise ValueError("Root folder is immutable")
    return rel

def _public_url_for(id_str: str) -> str:
    return f"/api/v1/assets/public/id/{id_str}"

def _thumb_url_for(id_str: str) -> str:
    return f"/api/v1/assets/public/id/{id_str}?thumbnail=true"

def _serialize_doc(doc: Dict[str, Any]) -> ImageResponse:
    _id = str(doc["_id"])
    folder = _extract_folder_rel(doc["path"])
    return ImageResponse(
        id=_id,
        name=doc.get("name") or _id,
        extension=doc.get("extension") or "",
        description=doc.get("description"),
        folder=folder,  # '' for root
        path=doc["path"],
        public_url=_public_url_for(_id),
        thumb_url=_thumb_url_for(_id),
    )

# -------------------------------------------------------------------
# Core operations used by routes
# -------------------------------------------------------------------

async def list_images_and_folders(folder: Optional[str], q: Optional[str], limit: Optional[int]) -> Dict[str, Any]:
    images = await list_image_data(limit=limit, folder=folder if folder is not None else "")
    files: List[ImageResponse] = []
    folders_set = set()

    for d in images:
        rel = _extract_folder_rel(d["path"])
        if folder:
            if rel.startswith(folder.strip("/") + "/"):
                remainder = rel[len(folder.strip("/"))+1:]
                first = remainder.split("/", 1)[0] if remainder else ""
                if first:
                    folders_set.add(first)
        else:
            if rel:
                first = rel.split("/", 1)[0]
                folders_set.add(first)

        name = d.get("name") or str(d["_id"])
        if q and q.lower() not in name.lower():
            continue

        files.append(_serialize_doc(d))

    if folder:
        files = [f for f in files if f.folder == folder.strip("/")]
    else:
        files = [f for f in files if f.folder == ""]

    return {"files": files, "folders": sorted(folders_set)}

async def upload_images(payload: UploadImageRequest, files: List[Any]) -> List[ImageResponse]:
    folder_rel = (payload.folder or "").strip("/")
    asset_dir, thumb_dir = _ensure_dirs(folder_rel if folder_rel != "" else None)

    out: List[ImageResponse] = []
    for up in files:
        oid = ObjectId()
        original = up.filename
        ext = os.path.splitext(original)[1].lstrip(".").lower() or "bin"
        filename = f"{str(oid)}.{ext}"
        asset_path = os.path.join(asset_dir, filename).replace("\\", "/")

        with open(asset_path, "wb") as f:
            f.write(up.file.read())

        rel_folder = folder_rel  # '' allowed
        db_path = f"data/assets/{rel_folder + '/' if rel_folder else ''}{filename}"
        data = ImageData(
            name=str(oid),
            description=payload.description,
            extension=ext,
            path=db_path,
        )
        await create_image_data_with_id(oid, data)
        out.append(
            ImageResponse(
                id=str(oid),
                name=str(oid),
                extension=ext,
                description=payload.description,
                folder=rel_folder,
                path=db_path,
                public_url=_public_url_for(str(oid)),
                thumb_url=_thumb_url_for(str(oid)),
            )
        )

    return out

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
        target_folder_rel = payload.move_to_folder

    base_name = new_name or str(doc["_id"])
    filename = f"{base_name}.{current_ext}"

    asset_dir, _ = _ensure_dirs(target_folder_rel if target_folder_rel != "" else None)
    new_fs_path = os.path.join(asset_dir, filename).replace("\\", "/")
    old_fs_path = os.path.join(_safe_join_root(current_folder_rel if current_folder_rel != "" else None),
                               os.path.basename(current_path)).replace("\\", "/")

    new_db_path = f"data/assets/{(target_folder_rel + '/' ) if target_folder_rel else ''}{filename}"
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

async def create_folder(payload: FolderCreateRequest) -> FolderResponse:
    rel = payload.path.strip().strip("/")
    _ensure_dirs(rel)
    return FolderResponse(path=rel, action="create", details=None)

async def rename_folder(payload: FolderRenameRequest) -> FolderResponse:
    rel = _guard_folder_target(payload.path)
    parent = os.path.dirname(rel).replace("\\", "/").strip("/")
    new_rel = os.path.join(parent, payload.new_name.strip().strip("/")).replace("\\", "/").strip("/")

    old_assets = _safe_join_root(rel)
    new_assets = _safe_join_root(new_rel)
    old_thumbs = _safe_join_thumbs(rel)
    new_thumbs = _safe_join_thumbs(new_rel)

    os.makedirs(os.path.dirname(new_assets), exist_ok=True)
    if os.path.exists(old_assets):
        shutil.move(old_assets, new_assets)
    if os.path.exists(old_thumbs):
        os.makedirs(os.path.dirname(new_thumbs), exist_ok=True)
        shutil.move(old_thumbs, new_thumbs)

    old_prefix = f"data/assets/{rel}/"
    new_prefix = f"data/assets/{new_rel}/"
    modified = await bulk_repath_prefix(old_prefix, new_prefix)

    return FolderResponse(path=new_rel, action="rename", details={"docs_repathed": modified})

async def move_folder_ctrl(payload: FolderMoveRequest) -> FolderResponse:
    rel = _guard_folder_target(payload.path)

    new_parent = (payload.new_parent or "").strip("/")
    new_rel = os.path.join(new_parent, os.path.basename(rel)).replace("\\", "/").strip("/")

    if rel == new_rel:
        return FolderResponse(path=rel, action="move", details={"moved": False, "reason": "same parent"})

    old_assets = _safe_join_root(rel)
    new_assets = _safe_join_root(new_rel if new_rel != "" else None)
    old_thumbs = _safe_join_thumbs(rel)
    new_thumbs = _safe_join_thumbs(new_rel if new_rel != "" else None)

    os.makedirs(os.path.dirname(new_assets), exist_ok=True)
    if os.path.exists(old_assets):
        shutil.move(old_assets, new_assets)
    if os.path.exists(old_thumbs):
        os.makedirs(os.path.dirname(new_thumbs), exist_ok=True)
        shutil.move(old_thumbs, new_thumbs)

    old_prefix = f"data/assets/{rel}/"
    new_prefix = f"data/assets/{new_rel}/" if new_rel else "data/assets/"
    modified = await bulk_repath_prefix(old_prefix, new_prefix)

    return FolderResponse(path=new_rel, action="move", details={"docs_repathed": modified})

async def delete_folder_ctrl(payload: FolderDeleteRequest) -> FolderResponse:
    rel = _guard_folder_target(payload.path)

    assets_dir = _safe_join_root(rel)
    thumbs_dir = _safe_join_thumbs(rel)
    parent_rel = os.path.dirname(rel).replace("\\", "/").strip("/")

    if payload.delete_within:
        if os.path.isdir(assets_dir):
            shutil.rmtree(assets_dir, ignore_errors=True)
        if os.path.isdir(thumbs_dir):
            shutil.rmtree(thumbs_dir, ignore_errors=True)
        deleted = await bulk_delete_by_prefix(f"data/assets/{rel}/")
        return FolderResponse(path=rel, action="delete", details={"deleted_docs": deleted})
    else:
        parent_dir = _safe_join_root(parent_rel if parent_rel != "" else None)
        os.makedirs(parent_dir, exist_ok=True)
        if os.path.isdir(assets_dir):
            for name in os.listdir(assets_dir):
                shutil.move(os.path.join(assets_dir, name), os.path.join(parent_dir, name))
            shutil.rmtree(assets_dir, ignore_errors=True)
        if os.path.isdir(thumbs_dir):
            parent_thumb = _safe_join_thumbs(parent_rel if parent_rel != "" else None)
            os.makedirs(parent_thumb, exist_ok=True)
            for name in os.listdir(thumbs_dir):
                shutil.move(os.path.join(thumbs_dir, name), os.path.join(parent_thumb, name))
            shutil.rmtree(thumbs_dir, ignore_errors=True)

        old_prefix = f"data/assets/{rel}/"
        new_prefix = f"data/assets/{parent_rel}/" if parent_rel else "data/assets/"
        modified = await bulk_repath_prefix(old_prefix, new_prefix)
        return FolderResponse(path=parent_rel, action="delete_move_up", details={"docs_repathed": modified})
