import api, { publicApi } from "../api/api";
import { ImageResponse } from "@/shared/types/ImageData";

// ---------- Images ----------

export const listImages = async (params: { folder?: string; q?: string; limit?: number }): Promise<ImageResponse[]> => {
  const usp = new URLSearchParams();
  if (params.limit != null) usp.set("limit", String(params.limit));
  if (params.folder !== undefined) usp.set("folder", params.folder);
  if (params.q) usp.set("q", params.q);
  const res = await api.get(`/v1/assets/?${usp.toString()}`);
  return (res.data?.files || []) as ImageResponse[];
};

export const getPublicUrl = (id: string) => {
  const base = (publicApi.defaults.baseURL || "").replace(/\/+$/, "");
  return `${base}/v1/assets/public/id/${encodeURIComponent(id)}`;
};

export const uploadImages = async (files: File[], opts: { folder?: string; description?: string }) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("file", f));
  if (opts.folder !== undefined) fd.append("folder", opts.folder);
  if (opts.description) fd.append("description", opts.description);
  const res = await api.post("/v1/assets/upload", fd);
  return res.data as ImageResponse[];
};

export const updateImage = async (
  id: string,
  payload: { new_name?: string; new_description?: string; move_to_folder?: string }
): Promise<ImageResponse> => {
  const res = await api.patch(`/v1/assets/${encodeURIComponent(id)}`, payload);
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
  const fd = new FormData();
  fd.append("path", path);
  const res = await api.post(`/v1/assets/folder`, fd);
  return res.data;
};

export const renameFolder = async (path: string, newName: string) => {
  const res = await api.patch(`/v1/assets/folder/rename`, { path, new_name: newName });
  return res.data;
};

export const moveFolder = async (path: string, newParent: string) => {
  const res = await api.patch(`/v1/assets/folder/move`, { path, new_parent: newParent });
  return res.data;
};

export const deleteFolder = async (path: string, deleteWithin: boolean) => {
  const res = await api.request({
    url: `/v1/assets/folder`,
    method: "DELETE",
    data: { path, delete_within: deleteWithin },
  });
  return res.data;
};

// CHOPPING BLOCK KEEPING SO NPM DOESNT YELL AT ME
export const getAssetUrl = (id: string, opts?: { thumbnail?: boolean }): string => {
  const query = opts?.thumbnail ? "?thumbnail=true" : "";
  return `/v1/assets/public/${encodeURIComponent(id)}${query}`;
};