import React, { useState, useEffect, useRef } from 'react';
import { listMediaContents, createFolder, uploadAssets, deleteAsset, getAssetUrl } from '@/helpers/MediaInteraction';
import { Folder, Image as ImageIconComponent, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage } from '@/shared/components/ui/breadcrumb';

interface Asset {
  filename: string;
  url: string;
  folder: string;
}

const MediaLibrary: React.FC<{ onSelect?: (asset: Asset) => void; selectionMode?: boolean }> = ({ onSelect, selectionMode = false }) => {
  const [currentFolder, setCurrentFolder] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [erroredImages, setErroredImages] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingImage, setDeletingImage] = useState<Asset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCurrentData = async () => {
    try {
      setLoading(true);
      setError(null);
      setErroredImages(new Set());
      const contents = await listMediaContents(undefined, currentFolder || undefined);
      setAssets(contents?.files || []);
      setSubfolders(contents?.folders || []);
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
  }, [currentFolder]);

  const handleNavigateToFolder = (folderName: string) => {
    setLoading(true);
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
      await createFolder(folderName.trim(), currentFolder);
      setNewFolderOpen(false);
      setFolderName('');
      fetchCurrentData();
    } catch (err) {
      setFolderError('Failed to create folder');
      setError('Failed to create folder');
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setError(null);
      await uploadAssets(Array.from(files), currentFolder);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchCurrentData();
    } catch (err) {
      setError('Failed to upload files');
    }
  };

  const handleImageClick = (asset: Asset) => {
    if (onSelect) {
      onSelect(asset);
    } else {
      setSelectedImage(asset);
    }
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  const confirmDelete = (asset: Asset) => {
    setDeletingImage(asset);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingImage) return;
    try {
      setError(null);
      const fullPath = deletingImage.folder === 'root' ? deletingImage.filename : `${deletingImage.folder}/${deletingImage.filename}`;
      await deleteAsset(fullPath);
      fetchCurrentData();
      setDeleteConfirmOpen(false);
      setDeletingImage(null);
    } catch (err) {
      setError('Failed to delete image');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      try {
        await uploadAssets(files, currentFolder);
        fetchCurrentData();
      } catch (err) {
        setError('Failed to upload dropped files');
      }
    }
  };

  const fullImageUrl = selectedImage ? getAssetUrl(selectedImage.filename) : '';
  const fullAssetUrl = (asset: Asset) => getAssetUrl(asset.filename);

  const breadcrumbItems = currentFolder ? ['Home', ...currentFolder.split('/')] : ['Home'];

  if (loading) {
    return <div className="p-4">Loading media library...</div>;
  }

  return (
    <div
      className={`p-4 ${isDragging ? 'border-2 border-dashed border-blue-500 bg-blue-50' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Breadcrumb>
            {breadcrumbItems.map((item, index) => (
              <React.Fragment key={item}>
                <BreadcrumbItem>
                  {index === breadcrumbItems.length - 1 ? (
                    <BreadcrumbPage>{item}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => {
                        setLoading(true);
                        if (item === 'Home') {
                          setCurrentFolder('');
                        } else {
                          const parts = breadcrumbItems.slice(1, index + 1);
                          setCurrentFolder(parts.join('/'));
                        }
                      }}
                    >
                      {item}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbItems.length - 1 && <span className="mx-1 text-muted-foreground">/</span>}
              </React.Fragment>
            ))}
          </Breadcrumb>
        </div>
        <div className="space-x-2">
          {!selectionMode && (
            <>
              <Button onClick={() => fileInputRef.current?.click()}>Upload</Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
              />
              <Button onClick={() => setNewFolderOpen(true)}>New Folder</Button>
            </>
          )}
        </div>
      </div>
      {error && (
        <Alert className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {subfolders.map((folder) => (
          <div
            key={folder}
            className="border rounded-lg p-4 flex flex-col items-center justify-center h-full cursor-pointer hover:bg-gray-50 transition-colors aspect-square"
            onClick={() => handleNavigateToFolder(folder)}
          >
            <Folder className="mx-auto mb-2 h-12 w-12 text-blue-500" />
            <p className="font-medium text-sm truncate text-center">{folder}</p>
          </div>
        ))}
        {assets.map((asset) => (
          <div key={asset.filename} className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow aspect-square">
            <div
              className="relative w-full h-full bg-gray-100 flex items-center justify-center group"
              onClick={() => handleImageClick(asset)}
            >
              <img
                src={`${getAssetUrl(asset.filename)}?thumbnail=true`}
                alt={asset.filename}
                className="w-full h-full object-cover"
                style={{
                  display: erroredImages.has(asset.filename) ? 'none' : 'block'
                }}
              />
              {erroredImages.has(asset.filename) && (
                <ImageIconComponent className="h-8 w-8 text-gray-400" />
              )}
              {!selectionMode ? (
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-end p-3 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-2 mr-2 bg-white bg-opacity-80 hover:bg-opacity-100"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const response = await fetch(fullAssetUrl(asset));
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = asset.filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('Download failed:', err);
                        setError('Failed to download image');
                      }
                    }}
                  >
                    <Download className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-2 bg-white bg-opacity-80 hover:bg-opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(asset);
                    }}
                  >
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </Button>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center p-3 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="default"
                    size="lg"
                    className="bg-white text-black hover:bg-gray-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect?.(asset);
                    }}
                  >
                    Select
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {assets.length === 0 && subfolders.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No images yet</h3>
          <p className="text-muted-foreground mb-4">Drag files here to upload or click the Upload button</p>
          {!selectionMode && (
            <Button onClick={() => fileInputRef.current?.click()}>
              Upload Files
            </Button>
          )}
        </div>
      )}

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
            {folderError && (
              <Alert className="text-destructive">
                <AlertDescription>{folderError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setNewFolderOpen(false);
                setFolderError(null);
                setFolderName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!selectionMode && (
        <Dialog open={!!selectedImage} onOpenChange={handleCloseModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 m-0">
            <div className="relative w-full h-full">
              {selectedImage && (
                <img
                  src={fullImageUrl}
                  alt={selectedImage.filename}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {!selectionMode && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p>Are you sure you want to delete "{deletingImage?.filename}"? This cannot be undone.</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default MediaLibrary;
