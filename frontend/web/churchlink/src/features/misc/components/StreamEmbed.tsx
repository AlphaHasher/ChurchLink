import * as React from "react";
import { AspectRatio } from "@/shared/components/ui/aspect-ratio";

type StreamEmbedProps = {
    url: string;
    title?: string;
    className?: string;
};

export const StreamEmbed: React.FC<StreamEmbedProps> = ({
    url,
    title = "Livestream",
    className,
}) => {
    return (
        <div className={["w-full", className].filter(Boolean).join(" ")}>
            <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md border bg-black">
                <iframe
                    src={url}
                    title={title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                />
            </AspectRatio>
        </div>
    );
};
