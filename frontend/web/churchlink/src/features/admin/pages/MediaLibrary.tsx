import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  | { open: true; kind: 'canvas'; x: number; y: number };

const MediaLibrary: React.FC<{
  onSelect?: (asset: ImageResponse) => void;
  selectionMode?: boolean;
}> = ({ onSelect, selectionMode = false }) => {
  const [currentFolder, setCurrentFolder] = useState('');
  const [assets, setAssets] = useState<ImageResponse[]>([]);
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string>(''); // leaf name
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string>(''); // leaf name

  const [erroredImages, setErroredImages] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<ImageResponse | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingImage, setDeletingImage] = useState<ImageResponse | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);

  // context menu state
  const [ctx, setCtx] = useState<CtxState>({ open: false });

  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close context menus when clicking anywhere else or pressing ESC.
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

  const fetchCurrentData = async () => {
    try {
      setLoading(true);
      setError(null);
      setErroredImages(new Set());
      const [images, folders] = await Promise.all([
        listImages({ folder: currentFolder, q: query || undefined }),
        listFoldersHelper(currentFolder),
      ]);
      setAssets(images || []);
      setSubfolders(folders || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch media');
      setAssets([]);
      setSubfolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentData();
  }, [currentFolder, query]);

  const breadcrumbItems = useMemo(
    () => (currentFolder ? ['Home', ...currentFolder.split('/')] : ['Home']),
    [currentFolder]
  );

  const pathFromCrumbIndex = (idx: number) => {
    if (idx === 0) return ''; // root
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

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      setFolderError('Folder name is required');
      return;
    }
    try {
      setFolderError(null);
      setError(null);
      const path = currentFolder ? `${currentFolder}/${folderName.trim()}` : folderName.trim();
      await createFolderHelper(path);
      setNewFolderOpen(false);
      setFolderName('');
      fetchCurrentData();
    } catch {
      setFolderError('Failed to create folder');
      setError('Failed to create folder');
    }
  };

  const handleUpload = async (files: FileList | null) => {
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
    const targetPath = normalizeTarget(targetPathRaw);
    try {
      await updateImage(imageId, { move_to_folder: targetPath }); // '' = root
      fetchCurrentData();
    } catch {
      setError('Failed to move image');
    }
  };

  const moveFolderToParent = async (folderLeaf: string, newParentPathRaw: string) => {
    const newParentPath = normalizeTarget(newParentPathRaw); // '' allowed
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
            <div className="w-64">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…" />
            </div>
            {!selectionMode && (
              <>
                <Button onClick={() => fileInputRef.current?.click()}>Upload</Button>
                <Button onClick={() => setNewFolderOpen(true)}>New Folder</Button>
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

        {/* Breadcrumb (drag targets; Home correctly maps to root) */}
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
                      handleDropToPath(targetPath);
                    }}
                    title={`Drop to move into ${item === 'Home' ? 'root' : targetPath}`}
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
          {/*“move up” dropzone*/}
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
              const parentPath = currentFolder.split('/').slice(0, -1).join('');
              handleDropToPath(parentPath);
            }}
            title={currentFolder ? 'Drop here to move up one level' : 'You are at the root'}
          >
            {currentFolder ? 'Drop here to move up a level' : 'Root (no parent)'}
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
                  setDragItem({ kind: 'image', id: asset.id, fromFolder: asset.folder });
                  ev.dataTransfer.effectAllowed = 'move'; // no custom ghost -> no jitter
                }}
                onDragEndTile={() => setDragItem(null)}
                onSelect={() => (onSelect ? onSelect(asset) : setSelectedImage(asset))}
                onRequestDelete={() => {
                  setDeletingImage(asset);
                  setDeleteConfirmOpen(true);
                }}
              />
            ))}
          </div>

          {/* Empty state */}
          {assets.length === 0 && subfolders.length === 0 && !loading && (
            <div className="mt-10 flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-base font-medium text-gray-900 mb-1">No items</h3>
              <p className="text-xs text-muted-foreground mb-4">Right-click to create a folder or drag files here to upload.</p>
              {!selectionMode && <Button onClick={() => fileInputRef.current?.click()}>Upload Files</Button>}
            </div>
          )}

          {/* Loading overlay (chrome remains visible) */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
              <div className="flex items-center gap-3 text-sm text-muted-foreground px-4 py-3 rounded-md border bg-background shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading media…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Folder */}
      <NewFolderDialog
        open={newFolderOpen}
        folderName={folderName}
        error={folderError}
        onOpenChange={setNewFolderOpen}
        onChangeName={setFolderName}
        onCancel={() => { setNewFolderOpen(false); setFolderError(null); setFolderName(''); }}
        onCreate={handleCreateFolder}
      />

      {/* Rename Folder */}
      <RenameFolderDialog
        open={renameOpen}
        currentName={renameTarget}
        onOpenChange={setRenameOpen}
        onCancel={() => setRenameOpen(false)}
        onConfirm={async (newName) => {
          const v = newName.trim();
          if (!v) return;
          try {
            const path = currentFolder ? `${currentFolder}/${renameTarget}` : renameTarget;
            await renameFolder(path, v);
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
        onOpenChange={setDeleteFolderOpen}
        onCancel={() => setDeleteFolderOpen(false)}
        onConfirm={async ({ delete_within }) => {
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
          onOpenChange={() => setSelectedImage(null)}
          onSave={async (id, data) => {
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
        />
      )}

      {/* Delete image */}
      {!selectionMode && (
        <DeleteImageDialog
          open={deleteConfirmOpen}
          assetName={deletingImage?.name || deletingImage?.id || ''}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            if (!deletingImage) return;
            try {
              setError(null);
              await deleteImage(deletingImage.id);
              setDeleteConfirmOpen(false);
              setDeletingImage(null);
              fetchCurrentData();
            } catch {
              setError('Failed to delete image');
            }
          }}
        />
      )}

      {/* CONTEXT MENUS */}
      {ctx.open && ctx.kind === 'folder' && (
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
              setDeleteTarget(ctx.folderName);
              setDeleteFolderOpen(true);
            }}
          >
            Delete…
          </button>
        </div>
      )}

      {ctx.open && ctx.kind === 'canvas' && (
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
              setFolderName('');
              setNewFolderOpen(true);
            }}
          >
            Create folder…
          </button>
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
