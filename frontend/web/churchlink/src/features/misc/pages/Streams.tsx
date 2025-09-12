import { useEffect, useState } from "react";
import { getLivestreamUrls } from "@/helpers/YoutubeHelper";

const Streams = () => {
    const [streams, setStreams] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStreams = async () => {
            try {
                const urls = await getLivestreamUrls();
                setStreams(urls);
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
            {streams.length === 0 ? "Stream not found" : "Streams found"}
        </div>
    );
};

export default Streams;