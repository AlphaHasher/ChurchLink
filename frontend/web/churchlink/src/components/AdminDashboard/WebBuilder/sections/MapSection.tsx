import React, { useState } from "react";

interface MapSectionProps {
  isEditing?: boolean;
  data: {
    embedUrl?: string;
  };
  onChange?: (data: any) => void;
}

const MapSection: React.FC<MapSectionProps> = ({ isEditing = false, data, onChange }) => {
  const [localUrl, setLocalUrl] = useState(data?.embedUrl || "");

  const handleUrlChange = (value: string) => {
    setLocalUrl(value);
 
    let embedUrl = value;
 
    // Convert regular Google Maps URL to embed URL
    // Users can paste standard Google Maps URLs and the component will attempt to convert them into embeddable URLs.
    // Reminder: Replace "YOUR_GOOGLE_MAPS_EMBED_API_KEY" with your actual API key.
    const match = value.match(/https:\/\/www\.google\.com\/maps\/place\/([^\/]+)\/?(@[^\/]+)?/);
    if (match) {
      const encodedPlace = encodeURIComponent(match[1]);
      embedUrl = `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_API}&q=${encodedPlace}`;
    } else {
      embedUrl = value; // fallback to raw URL
    }
 
    onChange?.({ embedUrl });
  };

  return (
    <section className="w-full py-8 px-4 bg-gray-100">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">Our Location</h2>
        {isEditing && (
          <input
            type="text"
            value={localUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Paste your Google Maps embed URL"
            className="mb-4 w-full border border-gray-300 p-2 rounded bg-white"
          />
        )}
        {localUrl && (
          <div className="w-full aspect-video">
            <iframe
              src={localUrl}
              className="w-full h-full border-0 rounded"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        )}
      </div>
    </section>
  );
};

export default MapSection;
