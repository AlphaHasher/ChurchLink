import { useEffect, useState } from "react";
import { getStreamIDs } from "@/helpers/YoutubeHelper";
import { NoStreams } from "../components/NoStreams";
import { StreamViewer } from "../components/StreamViewer";

const Streams = () => {
    const [streams, setStreams] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStreams = async () => {
            try {
                const stream_ids = await getStreamIDs();
                setStreams(stream_ids);
            } catch (err) {
                console.error("Error fetching streams:", err);
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
                <NoStreams />
            ) : (
                <StreamViewer stream_ids={streams} />
            )}
        </div>
    );
};

export default Streams;
