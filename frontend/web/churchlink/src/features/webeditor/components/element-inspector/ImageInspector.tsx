import React from 'react';

import { Node } from '@/shared/types/pageV2';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { uploadStrapiFiles, listStrapiUploads } from '@/helpers/StrapiInteraction';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/Dialog';
import { BuilderState } from '@/features/webeditor/state/BuilderState';

type ImageInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
};

export const ImageInspector: React.FC<ImageInspectorProps> = ({ node, onUpdate }) => {
  const prevRef = React.useRef<Node | null>(null);
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const lastLoadedPageRef = React.useRef<number>(0);
  const fetchingRef = React.useRef<boolean>(false);

  const loadLibraryPage = async (nextPage: number) => {
    if (fetchingRef.current) return;
    if (nextPage <= lastLoadedPageRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      setError(null);
      const data = await listStrapiUploads(nextPage, 40);
      const list = Array.isArray(data) ? data : (data?.data || []);
      setHasMore(list.length > 0);
      if (nextPage === 1) setResults(list);
      else setResults((prev) => [...prev, ...list]);
      setPage(nextPage);
      lastLoadedPageRef.current = nextPage;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401) {
        setError('Unauthorized. Please sign in again to access the media library.');
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
    const url = asset?.url || asset?.formats?.medium?.url || asset?.formats?.thumbnail?.url;
    if (!url) return;
    onUpdate((n) => n.type === 'image' ? ({ ...n, props: { ...(n.props || {}), src: url.startsWith('http') ? url : `${import.meta.env.VITE_STRAPI_URL}${url}` } } as Node) : n);
    setLibraryOpen(false);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const uploaded = await uploadStrapiFiles(Array.from(files));
      const first = Array.isArray(uploaded) ? uploaded[0] : uploaded?.[0];
      if (first) handlePick(first);
      if (libraryOpen) await loadLibraryPage(1);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="image-alt">Alt Text</Label>
        <Input
          id="image-alt"
          value={node.props?.alt || ''}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'image'
                ? ({ ...n, props: { ...(n.props || {}), alt: e.target.value } } as Node)
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
          placeholder="Describe the image"
        />
      </div>

      <div className="space-y-2">
        <Label>Image Library</Label>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleUpload(e.target.files)} className="hidden" />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={loading}>Upload</Button>
          <Dialog open={libraryOpen} onOpenChange={(o: boolean) => {
            setLibraryOpen(o);
            if (o) {
              // reset pagination state on open
              setResults([]);
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
                <DialogTitle>Select an image</DialogTitle>
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
                {results.map((a) => {
                  const thumb = a.formats?.thumbnail?.url || a.url;
                  const full = thumb?.startsWith('http') ? thumb : `${import.meta.env.VITE_STRAPI_URL}${thumb}`;
                  return (
                    <button key={a.id || a.url} className="border rounded overflow-hidden hover:ring" onClick={() => handlePick(a)} type="button">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={full} alt={a.name || ''} className="w-full h-24 object-cover" />
                    </button>
                  );
                })}
                {loading && <div className="col-span-5 text-sm text-muted-foreground">Loading…</div>}
                {!loading && results.length === 0 && <div className="col-span-5 text-sm text-muted-foreground">No images found</div>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setLibraryOpen(false)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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


