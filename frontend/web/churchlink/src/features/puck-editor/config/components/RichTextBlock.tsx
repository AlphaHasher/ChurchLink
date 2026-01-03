import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";

export type RichTextBlockPropsInner = {
  html: string;
};

export type RichTextBlockProps = RichTextBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const RichTextBlockInternal: ComponentConfig<RichTextBlockPropsInner> = {
  label: "Rich Text",
  fields: {
    html: {
      type: "textarea",
      label: "HTML Content",
    },
  },
  defaultProps: {
    html: "<h2>Heading</h2><p>Enter your rich text content here. You can use HTML tags.</p>",
  },
  render: ({ html }) => {
    return (
      <Section>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </Section>
    );
  },
};

export const RichTextBlock = withLayout(RichTextBlockInternal);
