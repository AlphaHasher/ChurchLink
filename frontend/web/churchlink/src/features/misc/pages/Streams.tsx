import { useEffect, useState } from "react";
import { getStreamIDs, getYTChannelLink } from "@/helpers/YoutubeHelper";
import { NoStreams } from "../components/NoStreams";
import { StreamViewer } from "../components/StreamViewer";

const Streams = () => {
    const [streams, setStreams] = useState<string[]>([]);
    const [channel_link, setChannelLink] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStreams = async () => {
            try {
                const stream_ids = await getStreamIDs();
                setStreams(stream_ids);
                const link = await getYTChannelLink();
                setChannelLink(link);
            } catch (err) {
                console.error("Error fetching Youtube Information:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStreams();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            {streams.length === 0 ? (
                <NoStreams channel_link={channel_link} />
            ) : (
                <StreamViewer stream_ids={streams} />
            )}
        </div>
    );
};

export default Streams;
