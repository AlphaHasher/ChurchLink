import api from "../api/api"
import { publicApi } from "../api/api"

export interface MediaContents {
  files: {filename: string; url: string; folder: string}[];
  folders: string[];
}

export const listMediaContents = async (limit?: number, folder?: string): Promise<MediaContents> => {
  const params = new URLSearchParams();
  if (limit !== undefined && limit !== null) params.set('limit', limit.toString());
  if (folder) params.set('folder', folder);
  
  try {
    const res = await api.get(`/v1/assets/?${params.toString()}`);
    return res.data as MediaContents;
  } catch (err) {
    console.error("List contents error:", err);
    return { files: [], folders: [] };
  }
};

export const createFolder = async (name: string, parentFolder?: string): Promise<{message: string; folder: string}> => {
  const formData = new FormData();
  formData.append('name', name);
  if (parentFolder) formData.append('parent', parentFolder);
  
  try {
    const res = await api.post('/v1/assets/folder', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  } catch (err) {
    console.error("Folder creation error:", err);
    throw new Error("Failed to create folder");
  }
};

export const uploadAssets = async (files: File[], folder?: string): Promise<{url: string; filename: string; folder: string}[]> => {
  const formData = new FormData();
  files.forEach(f => formData.append('file', f));
  if (folder) formData.append('folder', folder);
  
  try {
    const res = await api.post('/v1/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return Array.isArray(res.data) ? res.data : [res.data];
  } catch (err) {
    console.error("Assets upload error:", err);
    throw new Error("Failed to upload assets");
  }
};

export const listAssets = async (_limit = 50, folder?: string): Promise<{filename: string; url: string; folder: string}[]> => {
  const contents = await listMediaContents(undefined, folder);
  return contents.files;
};

export const listFolders = async (folder?: string): Promise<string[]> => {
  const contents = await listMediaContents(undefined, folder);
  return contents.folders;
};

export const getAssetUrl = (pathOrFilename: string, folder?: string): string => {
  const base = (publicApi.defaults.baseURL || '').replace(/\/+$/, '');
  const cleanFolder = (folder || '').replace(/^\/+|\/+$/g, '');
  const cleanPath = (pathOrFilename || '').replace(/^\/+/, '');
  const hasFolderInPath = cleanPath.includes('/');
  const segments = hasFolderInPath
    ? cleanPath.split('/').filter(Boolean)
    : (cleanFolder ? [cleanFolder, cleanPath] : [cleanPath]);
  const encodedPath = segments.map(encodeURIComponent).join('/');
  return `${base}/v1/assets/public/${encodedPath}`;
};

export const deleteAsset = async (filename: string): Promise<{message: string}> => {
  try {
    const res = await api.delete(`/v1/assets/${encodeURIComponent(filename)}`);
    return res.data;
  } catch (err) {
    console.error("Delete asset error:", err);
    throw new Error("Failed to delete asset");
  }
};
