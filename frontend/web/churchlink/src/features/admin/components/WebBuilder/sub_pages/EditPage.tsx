import PaypalSection from "../sections/PaypalSection";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { pageApi } from "@/api/api";
import ServiceTimesSection from "@/features/admin/components/WebBuilder/sections/ServiceTimesSection";
import HeroSection, { HeroContent } from "@/features/admin/components/WebBuilder/sections/HeroSection";
import MenuSection, { MenuSectionContent } from "@/features/admin/components/WebBuilder/sections/MenuSection";
import ContactInfoSection, { ContactInfoContent } from "@/features/admin/components/WebBuilder/sections/ContactInfoSection";
import MapSection from "@/features/admin/components/WebBuilder/sections/MapSection";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import TextSection, { TextContent } from "@/features/admin/components/WebBuilder/sections/TextSection";
import MultiTagInput from "@/helpers/MultiTagInput";
import WebBuilderLayout from "../layout/WebBuilderLayout";
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
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

interface ServiceTimesContent {
  title: string;
  times: { label: string; time: string }[];
}

interface PaypalSectionContent {
  title?: string;
  subtitle?: string;
  backgroundImageUrl?: string;
  buttonText?: string;
  amount?: number;
  purpose?: string;
  note?: string;
}

interface Section {
  id: string;
  type: "text" | "image" | "video" | "hero" | "paypal" | "service-times" | "menu" | "contact-info" | "map" | "event";
  content: string | TextContent | HeroContent | ServiceTimesContent | MenuSectionContent | ContactInfoContent | (PaypalSectionContent & { purpose?: string; amount?: number }) | { embedUrl?: string };
  settings?: { showFilters?: boolean; eventName?: string | string[]; lockedFilters?: { ministry?: string; ageRange?: string }; title?: string; showTitle?: boolean };
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

interface EditPageProps {
  onPageDataChange?: (data: { sections: Section[] }) => void;
}

const EditPage = ({ onPageDataChange }: EditPageProps = {}) => {
  const { slug: encodedSlug } = useParams();
  const slug = encodedSlug ? decodeURIComponent(encodedSlug) : undefined;
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [eventSuggestions, setEventSuggestions] = useState<string[]>([]);
  const [newSectionType, setNewSectionType] = useState<Section["type"]>("text");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dialog state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<number | null>(null);
  const [isPublishSuccessOpen, setIsPublishSuccessOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

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
        // Prefer staging (draft) if exists; fallback to preview (live, bypass visibility)
        const encoded = encodeURIComponent(slug as string);
        try {
          const staging = await pageApi.getStaging(slug as string);
          setPageData(staging.data);
          setSections(staging.data.sections || []);
          setLoadError(null);
          return;
        } catch (err: any) {
          if (err?.response?.status !== 404) {
            throw err;
          }
        }

        const res = await api.get(`/v1/pages/preview/${encoded}`);
        setPageData(res.data);
        setSections(res.data.sections || []);
        setLoadError(null);
      } catch (err) {
        console.error("Failed to fetch page", err);
        setLoadError("Failed to load page.");
      }
    };

    if (slug) fetchPage();
  }, [slug]);

  useEffect(() => {
    const fetchEventNames = async () => {
      try {
        // Backend doesn't expose /events/names; pull unique names from /events
        const res = await api.get('/v1/events?limit=200');
        const list = Array.isArray(res.data) ? res.data : [];
        const uniqueNames = Array.from(new Set(list.map((e: any) => e?.name).filter(Boolean)));
        setEventSuggestions(uniqueNames);
      } catch (err) {
        console.error("Failed to fetch event names", err);
      }
    };
    fetchEventNames();
  }, []);

  // Call onPageDataChange whenever sections change
  useEffect(() => {
    if (sections && onPageDataChange) {
      onPageDataChange({ sections });
    }
  }, [sections, onPageDataChange]);

  const handleContentChange = (index: number, newContent: string | TextContent | HeroContent | ServiceTimesContent | MenuSectionContent | ContactInfoContent) => {
    const updatedSections = [...sections];
    updatedSections[index].content = newContent;
    setSections(updatedSections);
  };

  // Autosave to staging whenever sections change
  useEffect(() => {
    const save = async () => {
      if (!slug) return;
      try {
        await pageApi.saveStaging(slug, { title: pageData?.title, slug, sections, visible: pageData?.visible });
      } catch (e) {
        console.error("Autosave (staging) failed", e);
      }
    };
    // Debounce autosave
    const t = setTimeout(save, 2000);
    return () => clearTimeout(t);
  }, [sections, slug, pageData?.title, pageData?.visible]);

  const handleAddSection = (type: Section["type"]) => {
    type PaypalSectionContent = {
      title: string;
      subtitle: string;
      backgroundImageUrl: string;
      buttonText: string;
      buttonUrl: string;
      amount: number;
      note: string;
    };
    let defaultContent: string | TextContent | HeroContent | ServiceTimesContent | MenuSectionContent | ContactInfoContent | PaypalSectionContent | { embedUrl?: string } = "";
    let settings;

    if (type === "text") {
      defaultContent = {
        editorjs: {
          time: Date.now(),
          version: "2.31.0",
          blocks: [
            {
              type: "paragraph",
              data: { text: "" },
            },
          ],
        },
      } as unknown as TextContent;
    }

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
    } else if (type === "paypal") {
      defaultContent = {
        title: "",
        subtitle: "",
        backgroundImageUrl: "",
        buttonText: "Give with PayPal",
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
    setSectionToDelete(index);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSection = () => {
    if (sectionToDelete !== null) {
      const updatedSections = sections.filter((_, i) => i !== sectionToDelete);
      setSections(updatedSections);
    }
    setIsDeleteModalOpen(false);
    setSectionToDelete(null);
  };

  if (!slug) return <div className="text-red-500">Invalid page slug.</div>;
  if (loadError) return <div className="text-red-500">{loadError}</div>;
  if (!pageData) return (
    <div className="p-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-48 w-full mt-2" />
    </div>
  );

  return (
    <WebBuilderLayout
      type="page"
      pageData={{ slug: slug || "", sections }}
      onPageDataChange={onPageDataChange}
    >
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Editing: {pageData.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Select
              value={newSectionType}
              onValueChange={(value) => setNewSectionType(value as Section["type"])}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="hero">Hero</SelectItem>
                <SelectItem value="paypal">Paypal</SelectItem>
                <SelectItem value="service-times">Service Times</SelectItem>
                <SelectItem value="menu">Menu</SelectItem>
                <SelectItem value="contact-info">Contact Info</SelectItem>
                <SelectItem value="map">Map</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => handleAddSection(newSectionType)}
              className="bg-green-600 hover:bg-green-700"
            >
              Add Section
            </Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-4">
                {sections.map((section, index) => (
                  <SortableItem key={section.id} id={section.id}>

                    <Card>
                      <CardHeader>
                        <CardTitle className="capitalize">{section.type.replace("-", " ")} Section</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {section.type === "text" && (
                          <TextSection
                            data={section.content as TextContent}
                            isEditing
                            onChange={(newContent) => handleContentChange(index, newContent)}
                          />
                        )}
                        {section.type === "image" && (
                          <div className="flex flex-col gap-2">
                            {typeof section.content === "string" && section.content && (
                              <img src={section.content} alt="Preview" className="max-w-full h-auto rounded border mt-2" />
                            )}
                            <Input
                              type="text"
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
                            <Input
                              type="text"
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
                        {section.type === "paypal" && (
                          <PaypalSection
                            data={section.content as PaypalSectionContent}
                            isEditing
                            onChange={(newContent) => handleContentChange(index, newContent)}
                            editableFields={["backgroundImageUrl", "title", "subtitle", "buttonText"]}
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
                            <EventSection
                              showFilters={section.settings?.showFilters !== false}
                              lockedFilters={section.settings?.lockedFilters}
                              title={section.settings?.title}
                              showTitle={section.settings?.showTitle !== false}
                            />
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
                                    !!section.settings?.lockedFilters?.ministry ||
                                    !!section.settings?.lockedFilters?.ageRange
                                  )
                                }
                                disabled={
                                  (Array.isArray(section.settings?.eventName) && section.settings.eventName.length > 0) ||
                                  !!section.settings?.lockedFilters?.ministry ||
                                  !!section.settings?.lockedFilters?.ageRange
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
                            <label className="text-sm">
                              Section Title:
                              <input
                                type="text"
                                className="ml-2 border px-2 py-1 rounded w-full"
                                placeholder="Upcoming Events"
                                value={section.settings?.title || ""}
                                onChange={(e) => {
                                  const updatedSections = [...sections];
                                  const updatedSettings = { ...(section.settings || {}), title: e.target.value };
                                  updatedSections[index] = { ...section, settings: updatedSettings };
                                  setSections(updatedSections);
                                }}
                              />
                            </label>
                            <label className="text-sm flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={section.settings?.showTitle !== false}
                                onChange={(e) => {
                                  const updatedSections = [...sections];
                                  const updatedSettings = {
                                    ...(section.settings || {}),
                                    showTitle: e.target.checked,
                                  };
                                  updatedSections[index] = { ...section, settings: updatedSettings };
                                  setSections(updatedSections);
                                }}
                              />
                              Show Title
                            </label>
                          </div>
                        )}
                        <Button
                          onClick={() => handleRemoveSection(index)}
                          variant="destructive"
                          className="mt-4"
                        >
                          Remove Section
                        </Button>
                      </CardContent>
                    </Card>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            onClick={async () => {
              if (!slug) return;
              setPublishError(null);
              setIsPublishing(true);
              try {
                // Ensure latest content is saved to staging before publishing
                await pageApi.saveStaging(slug, { title: pageData?.title, slug, sections, visible: pageData?.visible });
                await pageApi.publish(slug);
                setIsPublishSuccessOpen(true);
              } catch (e: any) {
                console.error("Publish failed", e);
                setPublishError(e?.response?.data?.detail || "Failed to publish. See console.");
                setIsPublishSuccessOpen(true); // reuse dialog to show error
              } finally {
                setIsPublishing(false);
              }
            }}
            className="mt-6 bg-blue-600 hover:bg-blue-700"
            disabled={isPublishing}
          >
            Publish
          </Button>

          {/* Publish Result Dialog */}
          <AlertDialog open={isPublishSuccessOpen} onOpenChange={setIsPublishSuccessOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{publishError ? "Publish failed" : "Published successfully"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {publishError ? publishError : "Your draft has been published to the live site."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsPublishSuccessOpen(false)} className="bg-blue-600 hover:bg-blue-700">
                  OK
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently remove this section from the page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteSection} className="bg-red-600 hover:bg-red-700">
                  Delete Section
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </WebBuilderLayout>
  );
};

export default EditPage;