import { useEffect, useState } from "react"
import { Label } from "@/shared/components/ui/label"
import MediaLibrary from "@/features/admin/components/WebBuilder/sub_pages/MediaLibrary"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog"
import { Button } from "@/shared/components/ui/button"
import { listMediaContents, getAssetUrl } from "@/helpers/MediaInteraction"

interface AssetFile {
    filename: string
    url: string
    folder: string
}

interface EventImageSelectorProps {
    value?: string
    onChange: (url: string) => void
}

function ensureApiUrl(raw: string): string {
    if (/^https?:\/\//i.test(raw)) return raw
    if (raw.startsWith('/api/')) return `${import.meta.env.VITE_API_HOST}${raw}`
    if (raw.startsWith('/assets/')) return `${import.meta.env.VITE_API_HOST}/api/v1${raw}`
    if (raw.startsWith('assets/')) return `${import.meta.env.VITE_API_HOST}/api/v1/${raw}`
    return getAssetUrl(raw)
}

function withThumbnailParam(url: string): string {
    if (url.includes('thumbnail=')) return url
    return url.includes('?') ? `${url}&thumbnail=true` : `${url}?thumbnail=true`
}

async function findAssetUrlByFilename(filename: string): Promise<string | null> {
    // Breadth-first search through media folders
    const queue: (string | undefined)[] = [undefined] // undefined represents root
    const visited = new Set<string>([''])
    while (queue.length > 0) {
        const current = queue.shift()
        try {
            const { files, folders } = await listMediaContents(undefined, current)
            const match = files.find(f => f.filename === filename)
            if (match) {
                return getAssetUrl(match.filename)
            }
            for (const folder of folders) {
                const path = current ? `${current}/${folder}` : folder
                if (!visited.has(path)) {
                    visited.add(path)
                    queue.push(path)
                }
            }
        } catch {
            // ignore and continue
        }
    }
    return null
}

export function EventImageSelector({ value, onChange }: EventImageSelectorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [normalizedUrl, setNormalizedUrl] = useState<string | null>(null)
    const [isResolving, setIsResolving] = useState<boolean>(false)
    const [showFull, setShowFull] = useState<boolean>(false)
    const [hadError, setHadError] = useState<boolean>(false)

    useEffect(() => {
        let cancelled = false
        const resolve = async () => {
            setIsResolving(true)
            setHadError(false)
            setShowFull(false)
            if (!value) {
                if (!cancelled) setNormalizedUrl(null)
                setIsResolving(false)
                return
            }
            // If it's an absolute or recognizable path, normalize immediately
            if (/^https?:\/\//i.test(value) || value.startsWith('/assets/') || value.startsWith('/api/')) {
                if (!cancelled) setNormalizedUrl(ensureApiUrl(value))
                setIsResolving(false)
                return
            }
            // If it contains a slash, treat as path under assets
            if (value.includes('/')) {
                if (!cancelled) setNormalizedUrl(ensureApiUrl(value))
                setIsResolving(false)
                return
            }
            // Likely only filename stored; search for it in media
            const found = await findAssetUrlByFilename(value)
            if (!cancelled) setNormalizedUrl(found || ensureApiUrl(value))
            setIsResolving(false)
        }
        resolve()
        return () => { cancelled = true }
    }, [value])

    const handleSelectImage = (asset: AssetFile) => {
        const fullUrl = getAssetUrl(asset.filename)
        onChange(fullUrl)
        setNormalizedUrl(fullUrl)
        setIsModalOpen(false)
        setHadError(false)
        setShowFull(false)
    }

    return (
        <div className="flex flex-col gap-4">
            <Label className="text-sm font-medium">Event Image</Label>

            <Button 
                type="button" 
                onClick={() => setIsModalOpen(true)}
                className="w-full justify-start"
            >
                {normalizedUrl ? "Change Image" : "Select Image from Library"}
            </Button>

            <div className="mt-4">
                <Label className="text-sm">Selected Image Preview:</Label>
                {isResolving ? (
                    <div className="flex items-center justify-center w-48 h-32 rounded border bg-muted text-muted-foreground text-sm">
                        Loading image...
                    </div>
                ) : normalizedUrl ? (
                    <div className="relative mt-2">
                        <img
                            src={showFull ? normalizedUrl : withThumbnailParam(normalizedUrl)}
                            alt="Selected event image"
                            className="rounded border w-48 h-32 object-cover"
                            onError={() => {
                                if (!showFull) {
                                    // Retry with full image
                                    setShowFull(true)
                                } else {
                                    setHadError(true)
                                }
                            }}
                        />
                        {hadError && (
                            <div className="flex items-center justify-center w-48 h-32 rounded border bg-muted text-muted-foreground text-sm">
                                Image not found or failed to load
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-48 h-32 rounded border bg-muted text-muted-foreground text-sm">
                        No image selected
                    </div>
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] p-0">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle>Select Event Image</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 overflow-auto max-h-[70vh]">
                        <MediaLibrary onSelect={handleSelectImage} selectionMode={true} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}