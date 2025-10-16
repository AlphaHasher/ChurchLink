import api, { publicApi } from "../api/api";
import { ImageResponse, ListImagesResponse } from "@/shared/types/ImageData";

// ---------- Images ----------

export const listImages = async (params: {
  folder?: string;
  q?: string;
  page?: number;
  page_size?: number;
  scope?: "current" | "all";
}): Promise<ListImagesResponse> => {
  const usp = new URLSearchParams();
  if (params.folder !== undefined) usp.set("folder", params.folder);
  if (params.q) usp.set("q", params.q);
  if (params.page != null) usp.set("page", String(params.page));
  if (params.page_size != null) usp.set("page_size", String(params.page_size));
  if (params.scope) usp.set("scope", params.scope);
  const res = await api.get(`/v1/assets/?${usp.toString()}`);
  const data = res.data as ListImagesResponse;
  return {
    files: data.files || (res.data?.files || []),
    folders: data.folders || (res.data?.folders || []),
    total: data.total ?? (res.data?.total ?? (res.data?.files || []).length),
    page: data.page ?? params.page ?? 1,
    page_size: data.page_size ?? params.page_size ?? 60,
  };
};

export const getPublicUrl = (id: string) => {
  const base = (publicApi.defaults.baseURL || "").replace(/\/+$/, "");
  return `${base}/v1/assets/public/id/${encodeURIComponent(id)}`;
};

export const getThumbnailUrl = (id: string) => {
  const base = (publicApi.defaults.baseURL || "").replace(/\/+$/, "");
  return `${base}/v1/assets/public/id/${encodeURIComponent(id)}/?thumbnail=true`;
};

export const uploadImages = async (
  files: File[],
  opts: { folder?: string; description?: string }
) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  if (opts.folder !== undefined) fd.append("folder", opts.folder);
  if (opts.description) fd.append("description", opts.description);

  const res = await api.post("/v1/assets/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    transformRequest: [(data) => data],
  });

  return res.data as ImageResponse[];
};

export const updateImage = async (
  id: string,
  payload: { new_name?: string; new_description?: string; move_to_folder?: string }
): Promise<ImageResponse> => {
  const body: Record<string, unknown> = {};
  if (payload.new_name !== undefined) body.new_name = payload.new_name;
  if (payload.new_description !== undefined) body.new_description = payload.new_description;
  if (payload.move_to_folder !== undefined) body.move_to_folder = payload.move_to_folder;

  const res = await api.patch(`/v1/assets/${encodeURIComponent(id)}`, body, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data as ImageResponse;
};

export const deleteImage = async (id: string): Promise<{ message: string }> => {
  const res = await api.delete(`/v1/assets/${encodeURIComponent(id)}`);
  return res.data;
};

// ---------- Folders ----------

export const listFolders = async (folder?: string): Promise<string[]> => {
  const usp = new URLSearchParams();
  if (folder !== undefined) usp.set("folder", folder);
  const res = await api.get(`/v1/assets/folders?${usp.toString()}`);
  return (res.data?.folders || []) as string[];
};

export const createFolder = async (path: string) => {
  const res = await api.post(`/v1/assets/folders/create`, { path }, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
};

export const renameFolder = async (path: string, newName: string) => {
  const res = await api.patch(`/v1/assets/folders/rename`, { path, new_name: newName });
  return res.data;
};

export const moveFolder = async (path: string, newParent: string) => {
  const res = await api.patch(`/v1/assets/folders/move`, { path, new_parent: newParent });
  return res.data;
};

export const deleteFolder = async (path: string, deleteWithin: boolean) => {
  const res = await api.patch(`/v1/assets/folders/delete`, { path, delete_within: deleteWithin });
  return res.data;
};
