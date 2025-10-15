import React from 'react';
import { Node } from '@/shared/types/pageV2';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { uploadAssets, listAssets, createFolder, listFolders } from '@/helpers/MediaInteraction';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/shared/components/ui/Dialog';
import { BuilderState } from '@/features/webeditor/state/BuilderState';
import MediaLibrary from '@/features/admin/pages/MediaLibrary'

const API_BASE = import.meta.env.VITE_API_HOST

function ensureApiUrl(raw: string): string {
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) return `${API_BASE}${raw}`
  return `${API_BASE}/${raw}`
}

function withThumbnailParam(url: string): string {
  if (!url) return ''
  return url.includes('thumbnail=') ? url : (url.includes('?') ? `${url}&thumbnail=true` : `${url}?thumbnail=true`)
}

type ImageInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
  activeLocale?: string;
  defaultLocale?: string;
};

function resolveLocalized(node: Node, key: string, activeLocale?: string, defaultLocale?: string): any {
  const i18n = (node as any).i18n as Record<string, Record<string, any>> | undefined;
  const locale = activeLocale || defaultLocale;
  if (locale && i18n && i18n[locale] && i18n[locale].hasOwnProperty(key)) return i18n[locale][key];
  return (node as any).props?.[key];
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({ node, onUpdate, activeLocale, defaultLocale }) => {
  const prevRef = React.useRef<Node | null>(null);
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [mediaModalOpen, setMediaModalOpen] = React.useState(false);
  const [previewErrored, setPreviewErrored] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const lastLoadedPageRef = React.useRef<number>(0);
  const fetchingRef = React.useRef<boolean>(false);
  const [currentFolder, setCurrentFolder] = React.useState('root');
  const [folders, setFolders] = React.useState<string[]>(['root']);  // Load folders on init
  const [newFolderName, setNewFolderName] = React.useState('');
  const [creatingFolder, setCreatingFolder] = React.useState(false);

  // Load folders on mount (for now, hardcode or fetch from list; extend backend for /folders later)
  React.useEffect(() => {
    const loadFolders = async () => {
      try {
        const loadedFolders = await listFolders();
        setFolders(loadedFolders);
      } catch (err) {
        console.error('Failed to load folders:', err);
        setFolders(['root']);
      }
    };
    loadFolders();
  }, []);

  // Update loadLibraryPage to better handle pagination (fetch all up to limit * page, but since backend is last N, fetch larger and slice reverse for recency)
  const loadLibraryPage = async (nextPage: number) => {
    if (fetchingRef.current) return;
    if (nextPage <= lastLoadedPageRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      setError(null);
      const assets = await listAssets(undefined as any, currentFolder === 'root' ? undefined : currentFolder);
      const allAssets = assets.slice(0, 40 * nextPage);  // Take first N for pagination (assume sorted recent)
      const list = allAssets.slice((nextPage - 1) * 40);
      setHasMore(list.length === 40);  // If full page, more available
      if (nextPage === 1) setResults(list);
      else setResults((prev) => [...prev, ...list]);
      setPage(nextPage);
      lastLoadedPageRef.current = nextPage;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        setError('Unauthorized. Please sign in as admin to access media library.');
        setHasMore(false);
      } else {
        setError('Failed to load images.');
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const handlePick = (asset: any) => {
    const url = ensureApiUrl(asset.url);  // Normalize to full API path
    if (!url) return;
    onUpdate((n) => n.type === 'image' ? ({ ...n, props: { ...(n.props || {}), src: url } } as Node) : n);
    setLibraryOpen(false);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const uploaded = await uploadAssets(Array.from(files), currentFolder === 'root' ? undefined : currentFolder);
      const first = uploaded[0];
      if (first) {
        onUpdate((n) => n.type === 'image' ? ({ ...n, props: { ...(n.props || {}), src: first.url } } as Node) : n);
      }
      if (libraryOpen) await loadLibraryPage(1);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await createFolder(newFolderName);
      setFolders(prev => [...prev, newFolderName]);
      setNewFolderName('');
      setCurrentFolder(newFolderName);
      await loadLibraryPage(1);  // Refresh list
    } catch (err) {
      setError('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="image-src">Image URL</Label>
        <Input
          id="image-src"
          value={node.props?.src || ''}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'image'
                ? ({ ...n, props: { ...(n.props || {}), src: e.target.value } } as Node)
                : n
            )
          }
          onFocus={() => { prevRef.current = { ...node }; }}
          onBlur={() => {
            const sectionId = BuilderState.selection?.sectionId;
            const nodeId = BuilderState.selection?.nodeId;
            if (sectionId && nodeId && prevRef.current) {
              BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
              prevRef.current = null;
            }
          }}
          placeholder="https://..."
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" type="button" onClick={() => setMediaModalOpen(true)}>Select from Library</Button>
          {node.props?.src && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewErrored ? ensureApiUrl(node.props.src) : withThumbnailParam(ensureApiUrl(node.props.src))}
                alt="Preview"
                className="h-16 w-24 object-cover rounded border"
                onError={() => setPreviewErrored(true)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image-alt">Alt Text</Label>
        <Input
          id="image-alt"
          value={resolveLocalized(node, 'alt', activeLocale, defaultLocale) || ''}
          onChange={(e) =>
            onUpdate((n) => {
              if (n.type !== 'image') return n;
              const useLocale = activeLocale && defaultLocale && activeLocale !== defaultLocale ? activeLocale : null;
              if (useLocale) {
                const prevI18n = ((n as any).i18n || {}) as Record<string, Record<string, any>>;
                const prevFor = prevI18n[useLocale] || {};
                return { ...(n as any), i18n: { ...prevI18n, [useLocale]: { ...prevFor, alt: e.target.value } } } as Node;
              }
              return ({ ...n, props: { ...(n.props || {}), alt: e.target.value } } as Node);
            })
          }
          onFocus={() => { prevRef.current = { ...node }; }}
          onBlur={() => {
            const sectionId = BuilderState.selection?.sectionId;
            const nodeId = BuilderState.selection?.nodeId;
            if (sectionId && nodeId && prevRef.current) {
              BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
              prevRef.current = null;
            }
          }}
          placeholder="Describe the image"
        />
      </div>

      <div className="space-y-2">
        <Label>Current Folder</Label>
        <Select value={currentFolder} onValueChange={setCurrentFolder}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            placeholder="New folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
            {creatingFolder ? 'Creating...' : 'Create Folder'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Image Library ({currentFolder})</Label>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleUpload(e.target.files)} className="hidden" />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={loading}>Upload to Folder</Button>
          <Dialog open={libraryOpen} onOpenChange={(o) => {
            setLibraryOpen(o);
            if (o) {
              setResults([]);
              setPage(1);
              setHasMore(true);
              lastLoadedPageRef.current = 0;
              loadLibraryPage(1);
            } else {
              setError(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button>Open Library</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Select an image from {currentFolder}</DialogTitle>
              </DialogHeader>
              {error && (
                <div className="text-sm text-destructive mb-2">{error}</div>
              )}
              <div className="grid grid-cols-5 gap-3 max-h-[60vh] overflow-auto pr-2" onScroll={async (e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
                if (!atBottom) return;
                if (loading || !hasMore) return;
                if (fetchingRef.current) return;
                await loadLibraryPage(page + 1);
              }}>
                {results.map((asset) => (
                  <button key={asset.filename} className="border rounded overflow-hidden hover:ring" onClick={() => handlePick(asset)} type="button">
                    <img src={withThumbnailParam(ensureApiUrl(asset.url))} alt={asset.filename} className="w-full h-24 object-cover" />
                  </button>
                ))}
                {loading && <div className="col-span-5 text-sm text-muted-foreground">Loading…</div>}
                {!loading && results.length === 0 && <div className="col-span-5 text-sm text-muted-foreground">No images found in {currentFolder}</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLibraryOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MediaLibrary modal (same as events) */}
      <Dialog open={mediaModalOpen} onOpenChange={setMediaModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Select Image</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-auto max-h-[70vh]">
            <MediaLibrary
              selectionMode
              onSelect={(asset) => {
                const fullUrl = ensureApiUrl(asset.url)
                onUpdate((n) => n.type === 'image' ? ({ ...n, props: { ...(n.props || {}), src: fullUrl } } as Node) : n)
                setMediaModalOpen(false)
                setPreviewErrored(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <Label>Object Fit</Label>
        <Select
          value={node.props?.objectFit || 'cover'}
          onValueChange={(value) =>
            onUpdate((n) =>
              n.type === 'image'
                ? ({ ...n, props: { ...(n.props || {}), objectFit: value } } as Node)
                : n
            )
          }
          onOpenChange={(open) => {
            if (open) {
              prevRef.current = { ...node };
            } else {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }
          }}
        >
          <SelectTrigger id="image-objectfit"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">cover</SelectItem>
            <SelectItem value="contain">contain</SelectItem>
            <SelectItem value="fill">fill</SelectItem>
            <SelectItem value="none">none</SelectItem>
            <SelectItem value="scale-down">scale-down</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default ImageInspector;


