import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Save, Globe, Image, Church, MapPin } from 'lucide-react';
import { websiteConfigApi } from '@/api/api';
import FaviconSelector from '@/features/admin/components/Website/FaviconSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,} from "@/shared/components/ui/Dialog";
import LegalPageEditor from './AdminLegalPageEditor';


interface WebsiteConfig {
  title: string;
  favicon_url?: string | null;
  favicon_asset_id?: string | null;
  meta_description?: string;
  updated_by?: string;
  updated_at?: string;
}

interface ChurchSettings {
  CHURCH_NAME?: string;
  CHURCH_ADDRESS?: string;
  CHURCH_CITY?: string;
  CHURCH_STATE?: string;
  CHURCH_POSTAL_CODE?: string;
}

const WebsiteSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<WebsiteConfig>({
    title: 'Your Church Website',
    favicon_url: null,
    favicon_asset_id: null,
  });
  const [churchSettings, setChurchSettings] = useState<ChurchSettings>({
    CHURCH_NAME: '',
    CHURCH_ADDRESS: '',
    CHURCH_CITY: '',
    CHURCH_STATE: '',
    CHURCH_POSTAL_CODE: '',
  });
  const [loading, setLoading] = useState(false);
  const [churchLoading, setChurchLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  type LegalSlug = "terms" | "privacy" | "refunds";
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [selectedLegalSlug, setSelectedLegalSlug] = useState<LegalSlug>("terms");

  useEffect(() => {
    loadConfig();
    loadChurchSettings();
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
        title: 'Your Church Website',
        favicon_url: null,
        favicon_asset_id: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadChurchSettings = async () => {
    try {
      setChurchLoading(true);
      const data = await websiteConfigApi.getChurchSettings();
      
      if (data.success) {
        const settings = data.settings;
        setChurchSettings({
          CHURCH_NAME: settings.CHURCH_NAME || '',
          CHURCH_ADDRESS: settings.CHURCH_ADDRESS || '',
          CHURCH_CITY: settings.CHURCH_CITY || '',
          CHURCH_STATE: settings.CHURCH_STATE || '',
          CHURCH_POSTAL_CODE: settings.CHURCH_POSTAL_CODE || ''
        });
      }
    } catch (error) {
      console.error('Error loading church settings:', error);
      setMessage({ type: 'error', text: 'Failed to load church settings. Please check your permissions.' });
    } finally {
      setChurchLoading(false);
    }
  };

  const saveChurchSettings = async () => {
    try {
      setChurchLoading(true);
      const data = await websiteConfigApi.updateChurchSettings(churchSettings);
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Church settings saved successfully!' });
      } else {
        throw new Error(data.message || 'Failed to save church settings');
      }
    } catch (error: any) {
      console.error('Error saving church settings:', error);
      
      let errorMessage = 'Failed to save church settings. Please try again.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Unauthorized: Please check your permissions for web builder management';
      } else if (error.response?.status === 403) {
        errorMessage = 'Forbidden: You need web_builder_management permission to modify church settings';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setChurchLoading(false);
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
    <div className="p-4 space-y-6">
      <div className="flex items-center mt-2">
        <Globe className="h-6 w-6 mr-2" />
        <h2 className="text-2xl font-bold">Website Settings</h2>
      </div>

      <Dialog open={legalDialogOpen} onOpenChange={setLegalDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Legal Pages</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4">
            <Label htmlFor="legal-select">Document</Label>
            <select
              id="legal-select"
              className="border rounded-md p-2"
              value={selectedLegalSlug}
              onChange={(e) => setSelectedLegalSlug(e.target.value as LegalSlug)}
            >
              <option value="terms">Terms &amp; Conditions</option>
              <option value="privacy">Privacy Policy</option>
              <option value="refunds">Refund Policy</option>
            </select>
          </div>

          <LegalPageEditor slug={selectedLegalSlug} />

          <DialogFooter>
            <Button variant="secondary" onClick={() => setLegalDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-400' : 'border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-400'}>
          <AlertDescription className="flex justify-between items-center text-foreground">
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

      {/* Church Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Church className="h-5 w-5" />
            Church Information
          </CardTitle>
          <CardDescription>
            Basic church information displayed throughout your website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="church-name">Church Name</Label>
            <Input
              id="church-name"
              value={churchSettings.CHURCH_NAME}
              onChange={(e) => setChurchSettings(prev => ({ ...prev, CHURCH_NAME: e.target.value }))}
              placeholder="Enter church name"
              disabled={churchLoading}
            />
          </div>
          
          <div>
            <Label htmlFor="church-address">Street Address</Label>
            <Input
              id="church-address"
              value={churchSettings.CHURCH_ADDRESS}
              onChange={(e) => setChurchSettings(prev => ({ ...prev, CHURCH_ADDRESS: e.target.value }))}
              placeholder="Enter street address"
              disabled={churchLoading}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="church-city">City</Label>
              <Input
                id="church-city"
                value={churchSettings.CHURCH_CITY}
                onChange={(e) => setChurchSettings(prev => ({ ...prev, CHURCH_CITY: e.target.value }))}
                placeholder="City"
                disabled={churchLoading}
              />
            </div>
            <div>
              <Label htmlFor="church-state">State</Label>
              <Input
                id="church-state"
                value={churchSettings.CHURCH_STATE}
                onChange={(e) => setChurchSettings(prev => ({ ...prev, CHURCH_STATE: e.target.value }))}
                placeholder="State"
                disabled={churchLoading}
              />
            </div>
            <div>
              <Label htmlFor="church-postal-code">Postal Code</Label>
              <Input
                id="church-postal-code"
                value={churchSettings.CHURCH_POSTAL_CODE}
                onChange={(e) => setChurchSettings(prev => ({ ...prev, CHURCH_POSTAL_CODE: e.target.value }))}
                placeholder="Postal Code"
                disabled={churchLoading}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={saveChurchSettings} 
              disabled={churchLoading}
              className="flex items-center gap-2"
            >
              <MapPin className="h-4 w-4" />
              {churchLoading ? 'Saving...' : 'Save Church Information'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold">Website Settings</h4>
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
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedLegalSlug("terms"); // default when opening
                    setLegalDialogOpen(true);
                  }}
                >
                  Edit Terms & Conditions
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Church Information</h4>
              <div>
                <strong>Church Name:</strong> {churchSettings.CHURCH_NAME || 'Not set'}
              </div>
              <div>
                <strong>Address:</strong> {churchSettings.CHURCH_ADDRESS || 'Not set'}
              </div>
              <div>
                <strong>City:</strong> {churchSettings.CHURCH_CITY || 'Not set'}
              </div>
              <div>
                <strong>State:</strong> {churchSettings.CHURCH_STATE || 'Not set'}
              </div>
              <div>
                <strong>Postal Code:</strong> {churchSettings.CHURCH_POSTAL_CODE || 'Not set'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebsiteSettingsPage;
