import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChurchBulletin } from "@/shared/types/ChurchBulletin";
import { buildBulletinImageSources } from "@/features/bulletins/utils/imageSources";

interface BulletinMediaImageProps {
    bulletin: ChurchBulletin;
    alt?: string;
    containerClassName?: string;
    imageClassName?: string;
    loading?: "eager" | "lazy";
}

export const BulletinMediaImage = ({
    bulletin,
    alt,
    containerClassName,
    imageClassName,
    loading = "lazy",
}: BulletinMediaImageProps) => {
    const sources = useMemo(
        () => buildBulletinImageSources({
            imageId: bulletin.image_id,
            imageUrl: bulletin.image_url,
            thumbnailUrl: bulletin.thumbnail_url,
        }),
        [bulletin.image_id, bulletin.image_url, bulletin.thumbnail_url],
    );

    const [activeIndex, setActiveIndex] = useState(() => (sources.length ? 0 : -1));

    useEffect(() => {
        setActiveIndex(sources.length ? 0 : -1);
    }, [sources]);

    if (!sources.length || activeIndex >= sources.length) {
        return null;
    }

    const src = sources[activeIndex];

    const handleError = () => {
        setActiveIndex((prev) => {
            const next = prev + 1;
            return next < sources.length ? next : sources.length;
        });
    };

    return (
        <div className={cn("relative bg-gray-200", containerClassName)}>
            <img
                key={src}
                src={src}
                alt={alt ?? bulletin.headline}
                className={cn("w-full h-full object-cover", imageClassName)}
                loading={loading}
                onError={handleError}
            />
        </div>
    );
};

export default BulletinMediaImage;
