import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Save, Globe, Image } from 'lucide-react';
import { websiteConfigApi } from '@/api/api';
import FaviconSelector from '../../../components/Website/FaviconSelector';

interface WebsiteConfig {
  title: string;
  favicon_url?: string | null;
  favicon_asset_id?: string | null;
  meta_description?: string;
  updated_by?: string;
  updated_at?: string;
}

const WebsiteSettings: React.FC = () => {
  const [config, setConfig] = useState<WebsiteConfig>({
    title: 'ChurchLink',
    favicon_url: null,
    favicon_asset_id: null,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await websiteConfigApi.getAdminConfig();
      setConfig(data);
      setMessage(null);
    } catch (error) {
      console.error('Error loading website config:', error);
      setMessage({ type: 'error', text: 'Failed to load website configuration. Please check your permissions.' });
      
      // Fallback to defaults
      setConfig({
        title: 'ChurchLink',
        favicon_url: null,
        favicon_asset_id: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (value: string) => {
    setConfig(prev => ({ ...prev, title: value }));
  };

  const handleFaviconUpdate = (assetId: string | null, url: string | null) => {
    setConfig(prev => ({ 
      ...prev, 
      favicon_asset_id: assetId,
      favicon_url: url
    }));
    
    // Update favicon in document head
    if (url) {
      updateDocumentFavicon(url);
    }
  };

  const handleSaveTitle = async () => {
    try {
      setLoading(true);
      await websiteConfigApi.updateTitle(config.title);
      setMessage({ type: 'success', text: 'Website title updated successfully!' });
      
      // Update document title immediately
      document.title = config.title;
    } catch (error) {
      console.error('Error updating title:', error);
      setMessage({ type: 'error', text: 'Failed to update website title' });
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentFavicon = (faviconUrl: string) => {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll('link[rel*="icon"]');
    existingLinks.forEach(link => link.remove());

    // Add new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = faviconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/x-icon';
    link.href = faviconUrl;
    document.head.appendChild(link);
  };

  const clearMessage = () => {
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Website Settings</h2>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}>
          <AlertDescription className="flex justify-between items-center">
            {message.text}
            <Button variant="ghost" size="sm" onClick={clearMessage}>
              ×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Website Title */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Website Title
            </CardTitle>
            <CardDescription>
              The title that appears in browser tabs and search results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="website-title">Title</Label>
              <Input
                id="website-title"
                value={config.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Enter website title"
                maxLength={60}
              />
              <p className="text-sm text-gray-500 mt-1">
                Current: {config.title.length}/60 characters
              </p>
            </div>
            <Button 
              onClick={handleSaveTitle} 
              disabled={loading || !config.title.trim()}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Title
            </Button>
          </CardContent>
        </Card>

        {/* Favicon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Website Favicon
            </CardTitle>
            <CardDescription>
              The small icon that appears in browser tabs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FaviconSelector
              currentFaviconAssetId={config.favicon_asset_id}
              currentFaviconUrl={config.favicon_url}
              onFaviconUpdate={handleFaviconUpdate}
              disabled={loading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Current Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div>
              <strong>Title:</strong> {config.title}
            </div>
            <div>
              <strong>Favicon URL:</strong> {config.favicon_url || 'Default favicon'}
            </div>
            {config.favicon_asset_id && (
              <div>
                <strong>Favicon Asset ID:</strong> {config.favicon_asset_id}
              </div>
            )}
            {config.updated_by && (
              <div>
                <strong>Last Updated By:</strong> {config.updated_by}
              </div>
            )}
            {config.updated_at && (
              <div>
                <strong>Last Updated:</strong> {new Date(config.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebsiteSettings;
