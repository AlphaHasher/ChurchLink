import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { StreamEmbed } from "./StreamEmbed";
import {
    getEmbedURLFromStreamID,
    getStreamURLFromStreamID,
} from "@/helpers/YoutubeHelper";

type StreamViewerProps = {
    stream_ids: string[];
};

export const StreamViewer: React.FC<StreamViewerProps> = ({ stream_ids }) => {
    const [index, setIndex] = React.useState(0);

    React.useEffect(() => {
        if (stream_ids.length > 0 && index >= stream_ids.length) setIndex(0);
    }, [stream_ids, index]);

    if (stream_ids.length === 0) return null;

    const isMultiStreaming = stream_ids.length > 1;
    const heading = isMultiStreaming
        ? "We're live! Select which stream to view."
        : "We're live!";

    const activeId = stream_ids[index];
    const embedUrl = getEmbedURLFromStreamID(activeId);
    const watchUrl = getStreamURLFromStreamID(activeId);

    return (
        <section className="mx-auto w-full max-w-5xl px-4 py-10">
            <div className="mb-4 text-center">
                <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
                    {heading}
                </h2>
            </div>

            {isMultiStreaming && (
                <Tabs
                    value={String(index)}
                    onValueChange={(v) => setIndex(Number(v))}
                    className="w-full"
                >
                    <TabsList className="mx-auto mb-6 flex w-full max-w-fit gap-2 bg-transparent p-0">
                        {stream_ids.map((_, i) => (
                            <TabsTrigger
                                key={i}
                                value={String(i)}
                                className="rounded-full border px-4 py-2 text-sm md:text-base font-medium bg-background text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow"
                            >
                                {`Stream ${i + 1}`}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            )}

            <div className="mx-auto mt-2 w-full max-w-3xl">
                <StreamEmbed url={embedUrl} />

                <div className="mt-3">
                    <Button
                        asChild
                        className="w-full bg-red-600 hover:bg-red-600/90"
                    >
                        <a
                            href={watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Watch this stream on YouTube"
                        >
                            Watch on YouTube
                        </a>
                    </Button>
                </div>
            </div>
        </section>
    );
};
