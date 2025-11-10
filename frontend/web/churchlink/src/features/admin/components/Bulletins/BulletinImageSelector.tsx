import { useMemo, useState } from "react";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog";
import MediaLibrary from "@/features/admin/pages/MediaLibrary";
import type { ImageResponse } from "@/shared/types/ImageData";
import { buildBulletinImageSources } from "@/features/bulletins/utils/imageSources";

interface BulletinImageSelectorProps {
    /** Image ID stored on the bulletin (24-char MongoDB ObjectId) */
    value?: string | null;
    /** Called with the selected image ID (string) or null when clearing */
    onChange: (imageId: string | null) => void;
    /** Optional label override */
    label?: string;
    /** Optional helper text override */
    helperText?: string;
    /** Whether the field is required */
    required?: boolean;
}

/**
 * Image selector component for bulletin announcements.
 * Integrates with the media library to allow admins to select images.
 * Based on EventImageSelector but tailored for bulletin usage.
 */
export function BulletinImageSelector({
    value,
    onChange,
    label = "Bulletin Image",
    helperText = "Select an image from the media library to display with this bulletin announcement.",
    required = false
}: BulletinImageSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Build preview URLs only when we have a valid image ID (24 characters)
    const previewSources = useMemo(() => {
        if (!value) return [] as string[];
        return buildBulletinImageSources({ imageId: value });
    }, [value]);

    const thumbnailSrc = useMemo(() => {
        const thumbnailCandidate = previewSources.find((src) => src.includes("thumbnail"));
        return thumbnailCandidate ?? previewSources[0] ?? "";
    }, [previewSources]);

    const fullImageSrc = useMemo(() => {
        const nonThumb = previewSources.find((src) => !src.includes("thumbnail"));
        return nonThumb ?? previewSources[previewSources.length - 1] ?? "";
    }, [previewSources]);

    const handlePick = (asset: ImageResponse) => {
        // Save the image ID on the bulletin
        onChange(asset.id ?? null);
        setIsOpen(false);
    };

    const clearSelection = () => {
        onChange(null);
    };

    return (
        <div className="space-y-2">
            <Label htmlFor="bulletin-image">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <small className="text-gray-500 dark:text-gray-400 text-xs block mb-1">
                {helperText}
            </small>

            <div className="flex items-center gap-3">
                {previewSources.length > 0 ? (
                    <a
                        href={fullImageSrc || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-[96px] h-[72px] shrink-0 overflow-hidden rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:ring-2 hover:ring-blue-500 transition-all"
                        title="Click to view full image"
                    >
                        <img
                            src={thumbnailSrc || undefined}
                            alt="Bulletin image preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Handle broken images gracefully
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = `
                                        <div class="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                            Image not found
                                        </div>
                                    `;
                                }
                            }}
                        />
                    </a>
                ) : (
                    <div className="w-[96px] h-[72px] shrink-0 rounded border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">
                        No image
                    </div>
                )}

                <div className="flex gap-2">
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsOpen(true)}
                        className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                        {value ? "Change image..." : "Select image..."}
                    </Button>
                    {value && (
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={clearSelection}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                        >
                            Remove
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] p-0 bg-white dark:bg-gray-800">
                    <DialogHeader className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <DialogTitle className="text-black dark:text-white">
                            Select Bulletin Image
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-4 overflow-auto max-h-[75vh] bg-white dark:bg-gray-800">
                        {/* selectionMode makes the library read-only and emits the chosen asset */}
                        <MediaLibrary
                            selectionMode
                            onSelect={handlePick}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default BulletinImageSelector;
