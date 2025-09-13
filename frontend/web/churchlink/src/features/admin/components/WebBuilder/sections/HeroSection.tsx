import React, { useState } from "react";

export interface HeroContent {
  title?: string;
  subtitle?: string;
  backgroundImageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
}

interface HeroSectionProps {
  data: HeroContent;
  isEditing: boolean;
  onChange?: (content: HeroContent) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ data, isEditing, onChange }) => {
  const [isPreview, setIsPreview] = useState(false);

  const updateField = (field: keyof HeroContent, value: string) => {
    onChange?.({ ...data, [field]: value });
  };

  return (
    <section
      className="bg-cover bg-center py-20 text-white text-center rounded"
      style={{ backgroundImage: `url(${data.backgroundImageUrl})` }}
    >
      {isEditing && (
        <div className="text-right max-w-6xl mx-auto mb-4">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className="px-4 py-1 text-sm rounded bg-gray-900 text-white border border-transparent hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
          >
            {isPreview ? "Edit" : "Preview"}
          </button>
        </div>
      )}
      {isEditing && !isPreview ? (
        <div className="space-y-3 max-w-2xl mx-auto">
          <input
            type="text"
            placeholder="Hero Title"
            className="w-full border p-2 rounded bg-white text-black"
            value={data.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
          />
          <input
            type="text"
            placeholder="Hero Subtitle"
            className="w-full border p-2 rounded bg-white text-black"
            value={data.subtitle || ""}
            onChange={(e) => updateField("subtitle", e.target.value)}
          />
          <input
            type="text"
            placeholder="Background Image URL"
            className="w-full border p-2 rounded bg-white text-black"
            value={data.backgroundImageUrl || ""}
            onChange={(e) => updateField("backgroundImageUrl", e.target.value)}
          />
          <input
            type="text"
            placeholder="Primary Button Text"
            className="w-full border p-2 rounded bg-white text-black"
            value={data.buttonText || ""}
            onChange={(e) => updateField("buttonText", e.target.value)}
          />
          <input
            type="text"
            placeholder="Primary Button URL"
            className="w-full border p-2 rounded bg-white text-black"
            value={data.buttonUrl || ""}
            onChange={(e) => updateField("buttonUrl", e.target.value)}
          />
          <input
            type="text"
            placeholder="Secondary Button Text"
            className="w-full border p-2 rounded bg-white text-black"
            value={data.secondaryButtonText || ""}
            onChange={(e) => updateField("secondaryButtonText", e.target.value)}
          />
          <input
            type="text"
            placeholder="Secondary Button URL"
            className="w-full border p-2 rounded bg-white text-black"
            value={data.secondaryButtonUrl || ""}
            onChange={(e) => updateField("secondaryButtonUrl", e.target.value)}
          />
        </div>
      ) : (
        <div className="text-white bg-black/50 p-6 rounded">
          <h1 className="text-4xl font-bold">{data.title}</h1>
          <p className="mt-2 text-lg">{data.subtitle}</p>
          <div className="mt-4 flex justify-center gap-4">
            {data.buttonText && data.buttonUrl && (
              <a
                href={data.buttonUrl}
                className="border border-white text-white px-6 py-2 rounded-full hover:bg-white hover:text-black transition"
              >
                {data.buttonText}
              </a>
            )}
            {data.secondaryButtonText && data.secondaryButtonUrl && (
              <a
                href={data.secondaryButtonUrl}
                className="bg-white text-black px-6 py-2 rounded-full hover:bg-gray-200 transition flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6zm-7-3c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10S3 17.523 3 12z"/></svg>
                {data.secondaryButtonText}
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroSection;