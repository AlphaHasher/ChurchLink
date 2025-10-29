import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/Dialog';
import { Upload, Image as ImageIcon, Trash2, Check } from 'lucide-react';
import MediaLibrary from '../../pages/MediaLibrary';
import type { ImageResponse } from '@/shared/types/ImageData';
import { websiteConfigApi } from '@/api/api';

interface FaviconSelectorProps {
  currentFaviconAssetId?: string | null;
  currentFaviconUrl?: string | null;
  onFaviconUpdate: (assetId: string | null, url: string | null) => void;
  disabled?: boolean;
}

const FaviconSelector: React.FC<FaviconSelectorProps> = ({
  currentFaviconAssetId,
  currentFaviconUrl,
  onFaviconUpdate,
  disabled = false,
}) => {
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Clear messages after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const allowedTypes = ['image/x-icon', 'image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please select an ICO, PNG, SVG, JPG, or WebP file.');
      return;
    }

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Maximum size is 2MB.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Upload using assets upload endpoint
      const uploadResult = await websiteConfigApi.uploadFavicon(file);

      if (uploadResult && uploadResult.length > 0) {
        const uploadedAsset = uploadResult[0];
        
        // Set this asset as the favicon
        await websiteConfigApi.setFavicon(uploadedAsset.id);
        
        const faviconUrl = `/api/v1/assets/public/id/${uploadedAsset.id}`;
        onFaviconUpdate(uploadedAsset.id, faviconUrl);
        setSuccess('Favicon uploaded successfully!');
        setUploadDialogOpen(false);
      }
    } catch (err: any) {
      console.error('Error uploading favicon:', err);
      setError(err.response?.data?.detail || 'Failed to upload favicon');
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleSelectFromMedia = (asset: ImageResponse) => {
    selectAsset(asset.id);
    setMediaLibraryOpen(false);
  };

  const selectAsset = async (assetId: string) => {
    try {
      setError(null);
      
      // Set this asset as the favicon
      await websiteConfigApi.setFavicon(assetId);
      
      const faviconUrl = `/api/v1/assets/public/id/${assetId}`;
      onFaviconUpdate(assetId, faviconUrl);
      setSuccess('Favicon selected successfully!');
    } catch (err: any) {
      console.error('Error selecting favicon:', err);
      setError(err.response?.data?.detail || 'Failed to select favicon');
    }
  };

  const removeFavicon = async () => {
    try {
      setError(null);
      
      await websiteConfigApi.removeFavicon();
      onFaviconUpdate(null, null);
      setSuccess('Favicon removed successfully!');
    } catch (err: any) {
      console.error('Error removing favicon:', err);
      setError(err.response?.data?.detail || 'Failed to remove favicon');
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Favicon Display */}
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="shrink-0">
          {currentFaviconUrl ? (
            <div className="w-16 h-16 border rounded-lg overflow-hidden bg-background flex items-center justify-center">
              <img
                src={currentFaviconUrl}
                alt="Current favicon"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-full h-full items-center justify-center text-muted-foreground" style={{ display: 'none' }}>
                <ImageIcon className="w-6 h-6" />
              </div>
            </div>
          ) : (
            <div className="w-16 h-16 border rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
        </div>
        
        <div className="grow">
          <h3 className="font-medium">Current Favicon</h3>
          <p className="text-sm text-muted-foreground">
            {currentFaviconAssetId ? (
              <>
                Using media asset: <Badge variant="secondary">{currentFaviconAssetId}</Badge>
              </>
            ) : (
              'Using default favicon'
            )}
          </p>
        </div>

        {currentFaviconAssetId && (
          <Button
            variant="outline"
            size="sm"
            onClick={removeFavicon}
            disabled={disabled}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Upload New Favicon */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={disabled}>
              <Upload className="w-4 h-4 mr-2" />
              Upload New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Favicon</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Select an image file to use as your website favicon.
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported formats: ICO, PNG, SVG, JPG, WebP (max 2MB)
                </p>
              </div>
              
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".ico,.png,.svg,.jpg,.jpeg,.webp,image/x-icon,image/png,image/svg+xml,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Select from Media Library */}
        <Dialog open={mediaLibraryOpen} onOpenChange={setMediaLibraryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={disabled}>
              <ImageIcon className="w-4 h-4 mr-2" />
              Select from Media
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>Select Favicon from Media Library</DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-4 overflow-auto">
              <MediaLibrary
                onSelect={handleSelectFromMedia}
                selectionMode={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FaviconSelector;