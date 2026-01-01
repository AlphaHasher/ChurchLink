import type { ComponentConfig } from "@measured/puck";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";

export type EventSectionBlockProps = {
  title: string;
  showTitle: boolean;
  showFilters: boolean;
};

export const EventSectionBlock: ComponentConfig<EventSectionBlockProps> = {
  label: "Events",
  fields: {
    title: {
      type: "text",
      label: "Section Title",
    },
    showTitle: {
      type: "radio",
      label: "Show Title",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    showFilters: {
      type: "radio",
      label: "Show Filters",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
  },
  defaultProps: {
    title: "Upcoming Events",
    showTitle: true,
    showFilters: true,
  },
  render: ({ title, showTitle, showFilters }) => {
    return (
      <EventSection
        title={title}
        showTitle={showTitle}
        showFilters={showFilters}
      />
    );
  },
};
