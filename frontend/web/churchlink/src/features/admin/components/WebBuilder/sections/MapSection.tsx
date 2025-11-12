import React, { useState } from "react";

interface MapSectionProps {
  isEditing?: boolean;
  data?: {
    embedUrl?: string;
  };
  onChange?: (data: any) => void;
  hideTitle?: boolean;
  title?: string;
  disableInteractions?: boolean;
}

const MapSection: React.FC<MapSectionProps> = ({ isEditing = false, data, onChange, hideTitle = false, title = "Our Location", disableInteractions = false }) => {
  const [localUrl, setLocalUrl] = useState(data?.embedUrl || "");

  const handleUrlChange = (value: string) => {
    setLocalUrl(value);
 
    let embedUrl = value;
 

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
    <div style={{ height: "auto", width: "100%", marginLeft: "auto", marginRight: "auto" }}>
      {!hideTitle && <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>{title}</h2>}
      {isEditing && (
        <input
          type="text"
          value={localUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Paste your Google Maps embed URL"
          style={{ marginBottom: 16, width: "100%", border: "1px solid #d1d5db", padding: 8, borderRadius: 6, background: "#ffffff" }}
        />
      )}
      {localUrl && (
        <div
          style={{
            width: "100%",
            overflow: "hidden",
            borderRadius: 12,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "14 / 6",
              background: "#fff",
            }}
          >
            {(() => {
              const baseStyle: React.CSSProperties = { width: "100%", height: "100%", border: 0, display: "block" };
              const iframeStyle: React.CSSProperties = disableInteractions ? { ...baseStyle, pointerEvents: "none" } : baseStyle;
              return (
            <iframe
              src={localUrl}
              style={iframeStyle}
              allowFullScreen={!disableInteractions}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              tabIndex={disableInteractions ? -1 : undefined}
              aria-hidden={disableInteractions ? true : undefined}
            ></iframe>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section style={{ width: "100%" }}>
      {content}
    </section>
  );
};

export default MapSection;
