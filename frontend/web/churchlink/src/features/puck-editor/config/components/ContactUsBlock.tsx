import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/ContactUs.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyVariables } from "../../utils/fontLoader";
import {
  headingField,
  descriptionField,
  badgeField,
  badgeDefaults,
  buttonsField,
  featuresField,
  paddingField,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { CompoundBadge } from "../../components/compound/CompoundBadge";
import { CompoundButton } from "../../components/compound/CompoundButton";
import { CompoundIcon } from "../../components/compound/CompoundIcon";
import { useState, useEffect, useMemo } from "react";
import { PreviewRendererClient } from "@/features/admin/components/Forms/PreviewRendererClient";

const getClassName = getClassNameFactory("ContactUs", styles);

type ButtonItem = {
  label: string;
  url: string;
  variant: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size: "default" | "sm" | "lg" | "icon";
  icon: string;
};

type FeatureItem = {
  icon: string;
  name: string;
  description: string;
};

type Form = {
  id: string;
  title: string;
  slug: string | null;
  visible: boolean;
};

export type ContactUsBlockPropsInner = {
  heading: string;
  headingFont?: string;
  description: string;
  descriptionFont?: string;
  badge?: {
    label: string;
    url: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  features: FeatureItem[];
  buttons: ButtonItem[];
  buttonFont?: string;
  formSlug?: string;
  padding: {
    top: string;
    bottom: string;
  };
  translations?: TranslationMap;
};

export type ContactUsBlockProps = ContactUsBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const ContactUsBlockInternal: ComponentConfig<ContactUsBlockPropsInner> = {
  label: "Contact Us",
  fields: {
    heading: headingField,
    headingFont: fontFamilyField,
    description: descriptionField,
    descriptionFont: fontFamilyField,
    badge: badgeField,
    features: featuresField,
    buttons: buttonsField,
    buttonFont: fontFamilyField,
    formSlug: {
      type: "custom",
      label: "Form",
      render: ({ value, onChange }) => {
        const [forms, setForms] = useState<Form[]>([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
          const fetchForms = async () => {
            try {
              const response = await fetch("/v1/forms/");
              if (response.ok) {
                const data = await response.json();
                setForms(data);
              }
            } catch (error) {
              console.error("Error fetching forms:", error);
            } finally {
              setLoading(false);
            }
          };
          fetchForms();
        }, []);

        const publishedForms = useMemo(() => {
          return forms.filter((form) => form.visible && form.slug);
        }, [forms]);

        if (loading) {
          return <div>Loading forms...</div>;
        }

        if (publishedForms.length === 0) {
          return (
            <div style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))" }}>
              No published forms available. Create a form first in Admin &gt; Forms.
            </div>
          );
        }

        return (
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              backgroundColor: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
            }}
          >
            <option value="">Select a form...</option>
            {publishedForms.map((form) => (
              <option key={form.id} value={form.slug!}>
                {form.title}
              </option>
            ))}
          </select>
        );
      },
    },
    padding: paddingField,
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const buttons = (field as unknown as { value?: ButtonItem[] })?.value || [];
        const features = (field as unknown as { value?: FeatureItem[] })?.value || [];
        const translatableFields = [
          { name: "heading", type: "text" as const, label: "Heading" },
          { name: "description", type: "textarea" as const, label: "Description" },
          { name: "badge.label", type: "text" as const, label: "Badge Label" },
          ...features.flatMap((_, index) => [
            {
              name: `features.${index}.name`,
              type: "text" as const,
              label: `Feature ${index + 1} Name`,
            },
            {
              name: `features.${index}.description`,
              type: "textarea" as const,
              label: `Feature ${index + 1} Description`,
            },
          ]),
          ...buttons.flatMap((_, index) => [
            {
              name: `buttons.${index}.label`,
              type: "text" as const,
              label: `Button ${index + 1} Label`,
            },
          ]),
        ];

        return (
          <TranslationsField
            value={value as TranslationMap}
            onChange={onChange}
            translatableFields={translatableFields}
          />
        );
      },
    },
  },
  defaultProps: {
    heading: "Get in touch",
    headingFont: "",
    description: "We'd love to hear from you. Fill out the form and we'll be in touch soon.",
    descriptionFont: "",
    badge: badgeDefaults,
    features: [
      {
        icon: "mail",
        name: "Email",
        description: "info@example.com",
      },
      {
        icon: "phone",
        name: "Phone",
        description: "+1 (555) 123-4567",
      },
    ],
    buttons: [],
    buttonFont: "",
    formSlug: "",
    padding: paddingDefaults,
    translations: {},
  },
  render: ({
    heading,
    headingFont,
    description,
    descriptionFont,
    badge,
    features,
    buttons,
    buttonFont,
    formSlug,
    padding,
    translations,
    puck,
  }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayHeading = translations?.[previewLanguage]?.heading || heading;
    const displayDescription = translations?.[previewLanguage]?.description || description;
    const displayBadgeLabel = translations?.[previewLanguage]?.["badge.label"] || badge?.label || "";

    const headingFontVars = getFontFamilyVariables(headingFont);
    const descriptionFontVars = getFontFamilyVariables(descriptionFont);
    const buttonFontVars = getFontFamilyVariables(buttonFont);

    return (
      <Section
        className={getClassName()}
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div className={getClassName("container")}>
          {/* Content section */}
          <div className={getClassName("content")}>
            {badge?.label && (
              <CompoundBadge
                label={displayBadgeLabel}
                url={badge?.url || ""}
                variant={badge?.variant || "default"}
                isEditing={puck.isEditing}
              />
            )}
            <h2 className="puck-font-scope" style={headingFontVars}>
              {displayHeading}
            </h2>
            <p className="puck-font-scope" style={descriptionFontVars}>
              {displayDescription}
            </p>

            {features && features.length > 0 && (
              <div className={getClassName("features")}>
                {features.map((feature, index) => {
                  const nameKey = `features.${index}.name`;
                  const descKey = `features.${index}.description`;

                  const displayName =
                    translations?.[previewLanguage]?.[nameKey] || feature.name;
                  const displayDesc =
                    translations?.[previewLanguage]?.[descKey] || feature.description;

                  return (
                    <div key={index} className={getClassName("feature")}>
                      <CompoundIcon
                        icon={feature.icon}
                        size={20}
                        className={getClassName("featureIcon")}
                      />
                      <div>
                        <div className={getClassName("featureName")}>{displayName}</div>
                        <div className={getClassName("featureDesc")}>{displayDesc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {buttons && buttons.length > 0 && (
              <div className={getClassName("buttons")}>
                {buttons.map((button, i) => {
                  const labelKey = `buttons.${i}.label`;
                  const displayLabel =
                    translations?.[previewLanguage]?.[labelKey] || button.label;

                  return (
                    <CompoundButton
                      key={i}
                      label={displayLabel}
                      url={button.url}
                      variant={button.variant}
                      size={button.size}
                      icon={button.icon}
                      isEditing={puck.isEditing}
                      fontVars={buttonFontVars}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Form section */}
          <div className={getClassName("form")}>
            {formSlug ? (
              <PreviewRendererClient slug={formSlug} applyFormWidth={true} />
            ) : (
              <div className={getClassName("formPlaceholder")}>
                <p>Select a form from the editor sidebar</p>
              </div>
            )}
          </div>
        </div>
      </Section>
    );
  },
};

export const ContactUsBlock = withLayout(ContactUsBlockInternal);
