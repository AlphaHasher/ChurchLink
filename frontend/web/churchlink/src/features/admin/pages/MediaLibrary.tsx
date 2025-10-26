import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listImages,
  listFolders as listFoldersHelper,
  createFolder as createFolderHelper,
  uploadImages,
  deleteImage,
  updateImage,
  moveFolder,
  renameFolder,
  deleteFolder,
  getPublicUrl,
} from '@/helpers/MediaInteraction';
import type { ImageResponse } from '@/shared/types/ImageData';

import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { ChevronLeft, Loader2, Upload } from 'lucide-react';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/select';

import { getMyPermissions } from '@/helpers/UserHelper';

import { DeleteImageDialog } from '../components/Media/DeleteImageDialog';
import FolderTile from '../components/Media/FolderTile';
import { ImagePreviewDialog } from '../components/Media/ImagePreviewDialog';
import ImageTile from '../components/Media/ImageTile';
import { NewFolderDialog } from '../components/Media/NewFolderDialog';
import { RenameFolderDialog } from '../components/Media/RenameFolderDialog';
import { DeleteFolderDialog } from '../components/Media/DeleteFolderDialog';

type DragItem =
  | { kind: 'image'; id: string; fromFolder: string }
  | { kind: 'folder'; name: string; fromFolder: string };

type CtxState =
  | { open: false }
  | { open: true; kind: 'folder'; folderName: string; x: number; y: number }
  | { open: true; kind: 'image'; asset: ImageResponse; x: number; y: number }
  | { open: true; kind: 'canvas'; x: number; y: number };

const MediaLibrary: React.FC<{
  onSelect?: (asset: ImageResponse) => void;
  selectionMode?: boolean;
}> = ({ onSelect, selectionMode = false }) => {
  const [currentFolder, setCurrentFolder] = useState('');
  const [assets, setAssets] = useState<ImageResponse[]>([]);
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [canManage, setCanManage] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      try {
        const result = await getMyPermissions();
        setCanManage(!!(result?.success && result?.perms?.media_management));
      } catch {
        setCanManage(false);
      }
    })();
  }, []);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string>('');
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string>('');

  const [erroredImages, setErroredImages] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<ImageResponse | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingImage, setDeletingImage] = useState<ImageResponse | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);

  const [ctx, setCtx] = useState<CtxState>({ open: false });

  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [scope, setScope] = useState<'current' | 'all'>('current');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);
  const [total, setTotal] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ctx.open) return;
    const onDown = () => setCtx({ open: false });
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setCtx({ open: false });
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [ctx]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const fetchCurrentData = async () => {
    try {
      setLoading(true);
      setError(null);
      setErroredImages(new Set());

      const resp = await listImages({
        folder: currentFolder,
        q: debouncedQ || undefined,
        page,
        page_size: pageSize,
        scope,
      });

      setAssets(resp.files || []);
      setTotal(resp.total || 0);

      const folders = debouncedQ ? [] : await listFoldersHelper(currentFolder);
      setSubfolders(folders || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch media');
      setAssets([]);
      setSubfolders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, currentFolder, scope, pageSize]);

  useEffect(() => {
    fetchCurrentData();
  }, [currentFolder, debouncedQ, scope, page, pageSize]);

  const breadcrumbItems = useMemo(
    () => (currentFolder ? ['Home', ...currentFolder.split('/')] : ['Home']),
    [currentFolder]
  );

  const pathFromCrumbIndex = (idx: number) => {
    if (idx === 0) return '';
    const parts = breadcrumbItems.slice(1, idx + 1);
    return parts.join('/');
  };

  const navToCrumb = (idx: number) => {
    setLoading(true);
    setCurrentFolder(pathFromCrumbIndex(idx));
  };

  const goBackOne = () => {
    const parent = currentFolder.split('/').slice(0, -1).join('/');
    setCurrentFolder(parent);
  };

  const handleNavigateToFolder = (folderName: string) => {
    const newPath = currentFolder ? `${currentFolder}/${folderName}` : folderName;
    setCurrentFolder(newPath);
  };

  const requireManage = (what: string): boolean => {
    if (!canManage) {
      window.alert(`You do not have permission to ${what}.`);
      return false;
    }
    return true;
  };

  const handleCreateFolder = async () => {
    if (!requireManage('create folders')) return;
    if (!folderName.trim()) {
      setFolderError('Folder name is required');
      return;
    }
    try {
      setFolderError(null);
      setError(null);
      const path = currentFolder ? `${currentFolder}/${folderName.trim()}` : folderName.trim();
      const res = await createFolderHelper(path);
      if (res?.details?.created === false && res?.details?.reason === 'duplicate') {
        setFolderError('A folder with that name already exists here.');
        return;
      }
      setNewFolderOpen(false);
      setFolderName('');
      fetchCurrentData();
    } catch {
      setFolderError('Failed to create folder');
      setError('Failed to create folder');
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!requireManage('upload images')) return;
    if (!files || files.length === 0) return;
    try {
      setError(null);
      await uploadImages(Array.from(files), { folder: currentFolder });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchCurrentData();
    } catch {
      setError('Failed to upload files');
    }
  };

  const handleDropUpload = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      if (!requireManage('upload images')) return;
      try {
        await uploadImages(files, { folder: currentFolder });
        fetchCurrentData();
      } catch {
        setError('Failed to upload dropped files');
      }
    }
  };

  // --- Moving helpers --------------------------------------------------------
  const normalizeTarget = (targetPath: string) => (targetPath?.trim() ?? '');

  const moveImageToAbsolute = async (imageId: string, targetPathRaw: string) => {
    if (!requireManage('move images')) return;
    const targetPath = normalizeTarget(targetPathRaw);
    try {
      await updateImage(imageId, { move_to_folder: targetPath });
      fetchCurrentData();
    } catch {
      setError('Failed to move image');
    }
  };

  const moveFolderToParent = async (folderLeaf: string, newParentPathRaw: string) => {
    if (!requireManage('move folders')) return;
    const newParentPath = normalizeTarget(newParentPathRaw);
    const sourcePath = currentFolder ? `${currentFolder}/${folderLeaf}` : folderLeaf;
    if (newParentPath.startsWith(`${sourcePath}/`) || sourcePath === newParentPath) return;
    try {
      await moveFolder(sourcePath, newParentPath);
      fetchCurrentData();
    } catch {
      setError('Failed to move folder');
    }
  };

  const handleDropToPath = async (targetPathRaw: string) => {
    const targetPath = normalizeTarget(targetPathRaw);
    if (!dragItem) return;
    if (dragItem.kind === 'image') {
      await moveImageToAbsolute(dragItem.id, targetPath);
    } else {
      await moveFolderToParent(dragItem.name, targetPath);
    }
    setDragItem(null);
  };
  // ---------------------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visibleCount = debouncedQ ? assets.length : assets.length + subfolders.length;

  return (
    <div className="p-6">
      <div
        className="mx-auto max-w-[1400px] rounded-2xl border shadow-sm bg-background overflow-hidden"
        onContextMenu={(e) => {
          e.preventDefault();
          setCtx({ open: true, kind: 'canvas', x: e.clientX, y: e.clientY });
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            {currentFolder && (
              <Button size="icon" variant="ghost" onClick={goBackOne} title="Back">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="text-sm font-semibold">Media Library</div>
          </div>
          <div className="flex gap-3 items-center">
            {/* Search bar + scope */}
            <div className="flex items-center gap-2">
              <div className="w-64">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for image by name"
                />
              </div>
              <Select value={scope} onValueChange={(v) => setScope(v as 'current' | 'all')}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Search scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">This folder</SelectItem>
                  <SelectItem value="all">All folders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Page size */}
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v, 10))}>
                <SelectTrigger className="h-9 w-[88px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[24, 48, 60, 96, 120].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectionMode && (
              <>
                <Button onClick={() => {
                  if (!canManage) { window.alert('You do not have permission to upload images.'); return; }
                  fileInputRef.current?.click();
                }}>Upload</Button>
                <Button onClick={() => {
                  if (!canManage) { window.alert('You do not have permission to create folders.'); return; }
                  setNewFolderOpen(true);
                }}>New Folder</Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleUpload(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="px-4 py-2 border-b bg-muted/20 text-sm">
          {breadcrumbItems.map((item, index) => {
            const targetPath = pathFromCrumbIndex(index);
            const isLast = index === breadcrumbItems.length - 1;
            return (
              <span key={`${item}-${index}`}>
                {isLast ? (
                  <span
                    className="font-medium"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropToPath(targetPath);
                    }}
                  >
                    {item}
                  </span>
                ) : (
                  <button
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => navToCrumb(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const parentPath = targetPath;
                      handleDropToPath(parentPath);
                    }}
                    title={`Drop to move into ${item === 'Home' ? 'Home' : targetPath}`}
                  >
                    {item}
                  </button>
                )}
                {index < breadcrumbItems.length - 1 && <span className="mx-1 text-muted-foreground">/</span>}
              </span>
            );
          })}
        </div>

        {/* Canvas */}
        <div
          className={`relative p-4 transition-colors min-h-[70vh] overflow-auto ${isDraggingFiles ? 'border-2 border-dashed border-primary/60 bg-primary/5' : ''
            }`}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) setIsDraggingFiles(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) setIsDraggingFiles(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget === e.target) setIsDraggingFiles(false);
          }}
          onDrop={handleDropUpload}
        >
          {/* “move up” dropzone */}
          <div
            className={[
              'mb-3 h-10 rounded-md border border-dashed flex items-center justify-center text-xs transition-colors',
              currentFolder ? 'bg-muted/40 text-muted-foreground' : 'bg-muted/20 text-muted-foreground/60',
              dragItem && currentFolder ? 'ring-2 ring-primary/50 bg-muted' : '',
            ].join(' ')}
            onDragOver={(e) => {
              if (!currentFolder) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              if (!currentFolder) return;
              e.preventDefault();
              const parentPath = currentFolder.split('/').slice(0, -1).join('/');
              handleDropToPath(parentPath);
            }}
            title={currentFolder ? 'Drop here to move up one level' : 'You are at Home'}
          >
            {currentFolder ? 'Drop here to move up a level' : 'Home (no parent)'}
          </div>

          {error && (
            <div className="mb-3">
              <Alert><AlertDescription>{error}</AlertDescription></Alert>
            </div>
          )}

          {/* Grid */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {subfolders.map((folder) => (
              <FolderTile
                key={folder}
                name={folder}
                compact
                isDraggingSomething={!!dragItem}
                onDragStartTile={() => setDragItem({ kind: 'folder', name: folder, fromFolder: currentFolder })}
                onDragEndTile={() => setDragItem(null)}
                onClick={() => handleNavigateToFolder(folder)}
                onDropImage={(imgId) =>
                  moveImageToAbsolute(imgId, currentFolder ? `${currentFolder}/${folder}` : folder)
                }
                onDropFolder={(dragFolderName) =>
                  moveFolderToParent(dragFolderName, currentFolder ? `${currentFolder}/${folder}` : folder)
                }
                onContextMenu={(pos) => setCtx({ open: true, kind: 'folder', folderName: folder, x: pos.x, y: pos.y })}
              />
            ))}

            {assets.map((asset) => (
              <ImageTile
                key={asset.id}
                asset={asset}
                compact
                dragging={dragItem?.kind === 'image' && dragItem.id === asset.id}
                selectionMode={!!selectionMode}
                errored={erroredImages.has(asset.id)}
                onErrorImage={() => setErroredImages((prev) => new Set(prev).add(asset.id))}
                onDragStartTile={(ev) => {
                  if (!canManage) { ev.preventDefault(); return; }
                  setDragItem({ kind: 'image', id: asset.id, fromFolder: asset.folder });
                  ev.dataTransfer.effectAllowed = 'move';
                }}
                onDragEndTile={() => setDragItem(null)}
                onSelect={() => (onSelect ? onSelect(asset) : setSelectedImage(asset))}
                onRequestDelete={() => {
                  if (!canManage) { window.alert('You do not have permission to delete images.'); return; }
                  setDeletingImage(asset);
                  setDeleteConfirmOpen(true);
                }}
                onContextMenu={(pos) => setCtx({ open: true, kind: 'image', asset, x: pos.x, y: pos.y })}
              />
            ))}
          </div>

          {/* Empty state */}
          {assets.length === 0 && subfolders.length === 0 && !loading && (
            <div className="mt-10 flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-base font-medium text-gray-900 mb-1">No items</h3>
              <p className="text-xs text-muted-foreground mb-4">Right-click to create a folder or drag files here to upload.</p>
              {!selectionMode && <Button onClick={() => {
                if (!canManage) { window.alert('You do not have permission to upload images.'); return; }
                fileInputRef.current?.click();
              }}>Upload Files</Button>}
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
              <div className="flex items-center gap-3 text-sm text-muted-foreground px-4 py-3 rounded-md border bg-background shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading media…</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer / pagination */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-sm">
          <div>
            {visibleCount} item{visibleCount === 1 ? '' : 's'} • Page {page} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* New Folder */}
      <NewFolderDialog
        open={newFolderOpen}
        folderName={folderName}
        error={folderError}
        canManage={canManage}
        onOpenChange={setNewFolderOpen}
        onChangeName={setFolderName}
        onCancel={() => { setNewFolderOpen(false); setFolderError(null); setFolderName(''); }}
        onCreate={handleCreateFolder}
      />

      {/* Rename Folder */}
      <RenameFolderDialog
        open={renameOpen}
        currentName={renameTarget}
        canManage={canManage}
        onOpenChange={setRenameOpen}
        onCancel={() => setRenameOpen(false)}
        onConfirm={async (newName) => {
          if (!requireManage('rename folders')) return;
          const v = newName.trim();
          if (!v) return;
          try {
            const path = currentFolder ? `${currentFolder}/${renameTarget}` : renameTarget;
            const res = await renameFolder(path, v);
            if (res?.details?.renamed === false) {
              setError('A sibling folder with that name already exists.');
              return;
            }
            setRenameOpen(false);
            fetchCurrentData();
          } catch {
            setError('Failed to rename folder');
          }
        }}
      />

      {/* Delete Folder */}
      <DeleteFolderDialog
        open={deleteFolderOpen}
        folderName={deleteTarget}
        canManage={canManage}
        onOpenChange={setDeleteFolderOpen}
        onCancel={() => setDeleteFolderOpen(false)}
        onConfirm={async ({ delete_within }) => {
          if (!requireManage('delete folders')) return;
          try {
            const path = currentFolder ? `${currentFolder}/${deleteTarget}` : deleteTarget;
            await deleteFolder(path, delete_within);
            setDeleteFolderOpen(false);
            fetchCurrentData();
          } catch {
            setError('Failed to delete folder');
          }
        }}
      />

      {/* Preview + edit image */}
      {!selectionMode && (
        <ImagePreviewDialog
          open={!!selectedImage}
          image={selectedImage}
          canManage={canManage}
          onOpenChange={() => setSelectedImage(null)}
          onSave={async (id, data) => {
            if (!requireManage('save image updates')) return;
            try {
              await updateImage(id, {
                new_name: data.new_name,
                new_description: data.new_description ?? undefined,
              });
              setSelectedImage(null);
              fetchCurrentData();
            } catch {
              setError('Failed to update image');
            }
          }}
          onRequestDelete={() => {
            if (!canManage) { window.alert('You do not have permission to delete images.'); return; }
            if (!selectedImage) return;
            setDeletingImage(selectedImage);
            setDeleteConfirmOpen(true);
            setSelectedImage(null);
          }}
        />
      )}

      {/* Delete image */}
      {!selectionMode && (
        <DeleteImageDialog
          open={deleteConfirmOpen}
          assetName={deletingImage?.name || deletingImage?.id || ''}
          canManage={canManage}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            if (!requireManage('delete images')) return;
            if (!deletingImage) return;
            try {
              setError(null);
              await deleteImage(deletingImage.id);
              setDeleteConfirmOpen(false);
              setDeletingImage(null);
              setSelectedImage(null);
              fetchCurrentData();
            } catch {
              setError('Failed to delete image');
            }
          }}
        />
      )}

      {/* CONTEXT MENUS (now portaled to <body>) */}
      {ctx.open && ctx.kind === 'folder' &&
        createPortal(
          (
            <div
              className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ left: ctx.x, top: ctx.y }}
              onPointerDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent"
                onClick={() => {
                  setCtx({ open: false });
                  if (!canManage) { window.alert('You do not have permission to rename folders.'); return; }
                  setRenameTarget(ctx.folderName);
                  setRenameOpen(true);
                }}
              >
                Rename
              </button>
              <button
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-red-600"
                onClick={() => {
                  setCtx({ open: false });
                  if (!canManage) { window.alert('You do not have permission to delete folders.'); return; }
                  setDeleteTarget(ctx.folderName);
                  setDeleteFolderOpen(true);
                }}
              >
                Delete…
              </button>
            </div>
          ),
          document.body
        )
      }

      {ctx.open && ctx.kind === 'image' &&
        createPortal(
          (
            <div
              className="fixed z-50 min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ left: ctx.x, top: ctx.y }}
              onPointerDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              <a
                href={`${getPublicUrl(ctx.asset.id)}?download=0`}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-left px-2 py-1.5 rounded hover:bg-accent"
              >
                Open Image in new tab
              </a>
              <button
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent"
                onClick={() => {
                  setCtx({ open: false });
                  setSelectedImage(ctx.asset);
                }}
              >
                Open Image Information
              </button>
              <a
                href={`${getPublicUrl(ctx.asset.id)}?download=1`}
                download={`${(ctx.asset.name || ctx.asset.id)}.${ctx.asset.extension || 'bin'}`}
                className="block w-full text-left px-2 py-1.5 rounded hover:bg-accent"
              >
                Download Image
              </a>
              <button
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-red-600"
                onClick={() => {
                  setCtx({ open: false });
                  if (!canManage) { window.alert('You do not have permission to delete images.'); return; }
                  setDeletingImage(ctx.asset);
                  setDeleteConfirmOpen(true);
                }}
              >
                Delete Image
              </button>
            </div>
          ),
          document.body
        )
      }

      {ctx.open && ctx.kind === 'canvas' &&
        createPortal(
          (
            <div
              className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ left: ctx.x, top: ctx.y }}
              onPointerDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent"
                onClick={() => {
                  setCtx({ open: false });
                  if (!canManage) { window.alert('You do not have permission to create folders.'); return; }
                  setFolderName('');
                  setNewFolderOpen(true);
                }}
              >
                Create folder…
              </button>
            </div>
          ),
          document.body
        )
      }
    </div>
  );
};

export default MediaLibrary;
