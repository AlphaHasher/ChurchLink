import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import ServiceTimesSection from "@/components/AdminDashboard/WebBuilder/sections/ServiceTimesSection";
import HeroSection, { HeroContent } from "@/components/AdminDashboard/WebBuilder/sections/HeroSection";
import MenuSection, { MenuSectionContent } from "@/components/AdminDashboard/WebBuilder/sections/MenuSection";
import ContactInfoSection, { ContactInfoContent } from "@/components/AdminDashboard/WebBuilder/sections/ContactInfoSection";
import MapSection from "@/components/AdminDashboard/WebBuilder/sections/MapSection";
import EventSection from "@/components/AdminDashboard/WebBuilder/sections/EventSection"; 
import MultiTagInput from "@/helpers/MultiTagInput";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ServiceTimesContent {
  title: string;
  times: { label: string; time: string }[];
}

interface Section {
  id: string;
  type: "text" | "image" | "video" | "hero" | "service-times" | "menu" | "contact-info" | "map" | "event"; // Updated type
  content: string | HeroContent | ServiceTimesContent | MenuSectionContent | ContactInfoContent | { embedUrl?: string };
  settings?: { showFilters?: boolean; eventName?: string | string[]; lockedFilters?: { ministry?: string; ageRange?: string } }; // Updated optional property
}

interface PageData {
  _id: string;
  title: string;
  slug: string;
  visible: boolean;
  sections: Section[];
}

const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners} className="cursor-grab text-gray-400 text-sm mb-2 select-none">
        &#x2630; Drag (Re-Order Section)
      </div>
      {children}
    </div>
  );
};

const EditPage = () => {
  const { slug } = useParams();
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [eventSuggestions, setEventSuggestions] = useState<string[]>([]);
  const [newSectionType, setNewSectionType] = useState<Section["type"]>("text");
  const [, setSaving] = useState(false);
  
  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over?.id);
      setSections(arrayMove(sections, oldIndex, newIndex));
    }
  };

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const res = await axios.get(`/api/pages/${slug}`);
        setPageData(res.data);
        setSections(res.data.sections || []);
      } catch (err) {
        console.error("Failed to fetch page", err);
      }
    };

    if (slug) fetchPage();
  }, [slug]);

  useEffect(() => {
    const fetchEventNames = async () => {
      try {
        const res = await axios.get('/api/v1/events/names');
        setEventSuggestions(res.data);
      } catch (err) {
        console.error("Failed to fetch event names", err);
      }
    };
    fetchEventNames();
  }, []);

  const handleContentChange = (index: number, newContent: string | HeroContent | ServiceTimesContent | MenuSectionContent | ContactInfoContent) => {
    const updatedSections = [...sections];
    updatedSections[index].content = newContent;
    setSections(updatedSections);
  };

  const handleSave = async () => {
    if (!pageData?._id) {
      console.error("Missing page ID");
      return;
    }

    const { _id, ...restPageData } = pageData;
    console.log("Saving page with data:", JSON.stringify({ sections }));
    try {
      setSaving(true);
      await axios.put(`/api/pages/${_id}`, {
        ...restPageData,
        sections,
      });
      alert("Page updated successfully");
    } catch (err) {
      console.error("Failed to save page:", err);
      alert("Failed to save page. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = (type: Section["type"]) => {
    let defaultContent: string | HeroContent | ServiceTimesContent | MenuSectionContent | ContactInfoContent | { embedUrl?: string } = "";
    let settings;

    if (type === "hero") {
      defaultContent = {
        title: "",
        subtitle: "",
        backgroundImageUrl: "",
        buttonText: "",
        buttonUrl: "",
        secondaryButtonText: "",
        secondaryButtonUrl: ""
      };
    } else if (type === "service-times") {
      const existing = sections.find((s) => s.type === "service-times");
      defaultContent = existing?.content || {
        title: "Service Times",
        times: []
      };
    } else if (type === "menu") {
      defaultContent = {
        items: [],
      };
    } else if (type === "contact-info") {
      defaultContent = {
        items: [
          { label: "Phone", value: "(123) 456-7890", iconUrl: "" },
          { label: "Email", value: "info@example.com", iconUrl: "" },
        ],
      };
    } else if (type === "map") {
      defaultContent = { embedUrl: "https://www.google.com/maps/embed?pb=..." };
    } else if (type === "event") { // Added case for event
      defaultContent = "";
      settings = { showFilters: true, lockedFilters: {} }; // Default setting for event
    }
 
    setSections([...sections, { id: Date.now().toString(), type, content: defaultContent, settings }]);
  };

  const handleRemoveSection = (index: number) => {
    const updatedSections = sections.filter((_, i) => i !== index);
    setSections(updatedSections);
  };

  if (!slug) return <div className="text-red-500">Invalid page slug.</div>;
  if (!pageData) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Editing: {pageData.title}</h1>
      <div className="flex items-center gap-2 mb-4">
        <select
          value={newSectionType}
          onChange={(e) => setNewSectionType(e.target.value as Section["type"])}
          className="border p-2 rounded"
        >
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="hero">Hero</option>
          <option value="service-times">Service Times</option>
          <option value="menu">Menu</option>
          <option value="contact-info">Contact Info</option>
          <option value="map">Map</option>
          <option value="event">Event</option> {/* Added event option */}
        </select>
        <button
          onClick={() => handleAddSection(newSectionType)}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Section
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
            {sections.map((section, index) => (
              <SortableItem key={section.id} id={section.id}>
                <div className="border p-4 rounded shadow bg-white">
                  {section.type === "text" && (
                    <textarea
                      className="w-full border p-2 rounded"
                      rows={4}
                      value={typeof section.content === "string" ? section.content : ""}
                      onChange={(e) => handleContentChange(index, e.target.value)}
                    />
                  )}
                  {section.type === "image" && (
                    <div className="flex flex-col gap-2">
                      {typeof section.content === "string" && section.content && (
                        <img src={section.content} alt="Preview" className="max-w-full h-auto rounded border mt-2" />
                      )}
                      <input
                        type="text"
                        className="w-full border p-2 rounded"
                        placeholder="Image URL"
                        value={typeof section.content === "string" ? section.content : ""}
                        onChange={(e) => {
                          const updatedSections = [...sections];
                          updatedSections[index].content = e.target.value;
                          setSections(updatedSections);
                        }}
                      />
                      
                    </div>
                  )}
                  {section.type === "video" && (
                    <div>
                      <input
                        type="text"
                        className="w-full border p-2 rounded"
                        placeholder="YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
                        value={typeof section.content === "string" ? section.content : ""}
                        onChange={(e) => {
                          const input = e.target.value;
                          let embedUrl = input;

                          // Auto-convert watch URLs to embed
                          const youtubeMatch = input.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
                          if (youtubeMatch) {
                            const videoId = youtubeMatch[1];
                            embedUrl = `https://www.youtube.com/embed/${videoId}`;
                          }

                          handleContentChange(index, embedUrl);
                        }}
                      />
                      {section.content && (
                        <div className="mt-2">
                          <iframe
                            src={typeof section.content === "string" ? section.content : ""}
                            className="w-full aspect-video"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {section.type === "hero" && (
                    <HeroSection
                      data={section.content as HeroContent}
                      isEditing
                      onChange={(newContent) => handleContentChange(index, newContent)}
                    />
                  )}
                  {section.type === "service-times" && (
                    <ServiceTimesSection
                      data={section.content as ServiceTimesContent}
                      isEditing
                      onChange={(newContent) => handleContentChange(index, newContent)}
                    />
                  )}
                  {section.type === "menu" && (
                    <MenuSection
                      data={section.content as MenuSectionContent}
                      isEditing
                      onChange={(newContent) => handleContentChange(index, newContent)}
                    />
                  )}
                  {section.type === "contact-info" && (
                    <ContactInfoSection
                      data={section.content as ContactInfoContent}
                      isEditing
                      onChange={(newContent) => handleContentChange(index, newContent)}
                    />
                  )}
                  {section.type === "map" && (
                    <MapSection
                      data={section.content as { embedUrl?: string }}
                      isEditing
                      onChange={(newContent) => handleContentChange(index, newContent)}
                    />
                  )}
                  {section.type === "event" && (
                    <div className="pointer-events-none opacity-60">
                      <EventSection showFilters={section.settings?.showFilters !== false} eventName={section.settings?.eventName} lockedFilters={section.settings?.lockedFilters} />
                      <p className="text-center text-sm text-gray-500 mt-2">This section is preview-only and not editable.</p>
                    </div>
                  )}
                  {section.type === "event" && (
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="text-sm flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={
                            !!section.settings?.showFilters &&
                            !(
                              (Array.isArray(section.settings?.eventName) && section.settings.eventName.length > 0) ||
                              section.settings?.lockedFilters?.ministry ||
                              section.settings?.lockedFilters?.ageRange
                            )
                          }
                          disabled={
                            (Array.isArray(section.settings?.eventName) && section.settings.eventName.length > 0) ||
                            section.settings?.lockedFilters?.ministry ||
                            section.settings?.lockedFilters?.ageRange
                          }
                          onChange={(e) => {
                            const updatedSections = [...sections];
                            const updatedSettings = {
                              ...(section.settings || {}),
                              showFilters: e.target.checked,
                            };
                            updatedSections[index] = { ...section, settings: updatedSettings };
                            setSections(updatedSections);
                          }}
                          className="mr-1"
                        />
                        Show Filters
                        {(section.settings?.eventName?.length || section.settings?.lockedFilters?.ministry || section.settings?.lockedFilters?.ageRange) && (
                          <span className="text-xs text-gray-500 ml-2">(Disabled when using specific event or locked filter)</span>
                        )}
                      </label>
                      <MultiTagInput
                        label="Specific Event Names"
                        value={Array.isArray(section.settings?.eventName) ? section.settings.eventName : section.settings?.eventName ? [section.settings.eventName] : []}
                        onChange={(newTags) => {
                          const updatedSections = [...sections];
                          const updatedSettings = { ...(section.settings || {}), eventName: newTags };
                          updatedSections[index] = { ...section, settings: updatedSettings };
                          setSections(updatedSections);
                        }}
                        placeholder="Add event name"
                        suggestions={eventSuggestions}
                        datalistId={`eventSuggestions-${index}`}
                      />
                      <label className="text-sm">
                        Lock Ministry Filter:
                        <select
                          className="ml-2 border px-2 py-1 rounded"
                          value={section.settings?.lockedFilters?.ministry || ""}
                          onChange={(e) => {
                            const updatedSections = [...sections];
                            const updatedSettings = {
                              ...(section.settings || {}),
                              lockedFilters: {
                                ...(section.settings?.lockedFilters || {}),
                                ministry: e.target.value || undefined
                              }
                            };
                            updatedSections[index] = { ...section, settings: updatedSettings };
                            setSections(updatedSections);
                          }}
                        >
                          <option value="">-- None --</option>
                          <option value="Youth">Youth</option>
                          <option value="Young Adults">Young Adults</option>
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        Lock Age Range Filter:
                        <select
                          className="ml-2 border px-2 py-1 rounded"
                          value={section.settings?.lockedFilters?.ageRange || ""}
                          onChange={(e) => {
                            const updatedSections = [...sections];
                            const updatedSettings = {
                              ...(section.settings || {}),
                              lockedFilters: {
                                ...(section.settings?.lockedFilters || {}),
                                ageRange: e.target.value || undefined
                              }
                            };
                            updatedSections[index] = { ...section, settings: updatedSettings };
                            setSections(updatedSections);
                          }}
                        >
                          <option value="">-- None --</option>
                          <option value="0-12">0–12</option>
                          <option value="13-17">13–17</option>
                          <option value="18-35">18–35</option>
                          <option value="36-60">36–60</option>
                          <option value="60+">60+</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to remove this section?")) {
                        handleRemoveSection(index);
                      }
                    }}
                    className="mt-2 text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        onClick={handleSave}
        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        Save Changes
      </button>
    </div>
  );
};

export default EditPage;