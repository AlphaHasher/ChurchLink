import React, { useState } from "react";

interface MapSectionProps {
  isEditing?: boolean;
  data?: {
    embedUrl?: string;
  };
  onChange?: (data: any) => void;
  // V2 builder integration: hide title text and remove outer section framing
  hideTitle?: boolean;
  unstyled?: boolean;
  title?: string;
  // When true, prevent any pointer/keyboard interaction with the iframe
  disableInteractions?: boolean;
}

const MapSection: React.FC<MapSectionProps> = ({ isEditing = false, data, onChange, hideTitle = false, unstyled = false, title = "Our Location", disableInteractions = false }) => {
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

  const content = (
    <div className={unstyled ? undefined : "max-w-6xl mx-auto text-left"}>
      {!hideTitle && (
        <h2 className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
      )}
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
        <div className="w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 bg-white">
          <div className="aspect-video">
            <iframe
              src={localUrl}
              className="w-full h-full border-0"
              allowFullScreen={!disableInteractions}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={disableInteractions ? { pointerEvents: "none" } : undefined}
              tabIndex={disableInteractions ? -1 : undefined}
              aria-hidden={disableInteractions ? true : undefined}
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );

  if (unstyled) return content;

  return (
    <section className="w-full py-10 px-4 bg-gradient-to-b from-slate-50 via-white to-slate-100">
      {content}
    </section>
  );
};

export default MapSection;
