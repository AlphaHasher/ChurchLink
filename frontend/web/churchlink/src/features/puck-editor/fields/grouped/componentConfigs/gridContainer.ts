import type { ComponentGroupConfig } from "../types";

export const gridContainerGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Layout",
      icon: "layout",
      fields: [
        {
          name: "name",
          label: "Container Name",
          type: "text",
        },
        {
          name: "layoutMode",
          label: "Layout Mode",
          type: "radio",
          options: [
            { label: "Row", value: "row" },
            { label: "Column", value: "column" },
          ],
        },
        {
          name: "gap",
          label: "Gap (px)",
          type: "number",
          min: 0,
        },
      ],
    },
  ],
};
