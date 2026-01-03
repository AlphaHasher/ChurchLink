import { ReactElement } from "react";
import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Card.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import {
  Heart,
  Star,
  Check,
  X,
  Calendar,
  MapPin,
  Mail,
  Phone,
  Users,
  Home,
  Settings,
  Search,
  Bell,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Plus,
  Minus,
} from "lucide-react";

const getClassName = getClassNameFactory("Card", styles);

// Curated icon set (20 common icons instead of 2000+)
const icons: Record<string, ReactElement> = {
  heart: <Heart />,
  star: <Star />,
  check: <Check />,
  x: <X />,
  calendar: <Calendar />,
  mapPin: <MapPin />,
  mail: <Mail />,
  phone: <Phone />,
  users: <Users />,
  home: <Home />,
  settings: <Settings />,
  search: <Search />,
  bell: <Bell />,
  info: <Info />,
  alertCircle: <AlertCircle />,
  checkCircle: <CheckCircle />,
  xCircle: <XCircle />,
  helpCircle: <HelpCircle />,
  plus: <Plus />,
  minus: <Minus />,
};

const iconOptions = Object.keys(icons).map((iconName) => ({
  label: iconName,
  value: iconName,
}));

export type CardBlockPropsInner = {
  title: string;
  description: string;
  icon?: string;
  mode: "flat" | "card";
  translations?: TranslationMap;
};

export type CardBlockProps = CardBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const CardBlockInternal: ComponentConfig<CardBlockPropsInner> = {
  label: "Card",
  fields: {
    title: {
      type: "text",
      contentEditable: true,
    },
    description: {
      type: "textarea",
      contentEditable: true,
    },
    icon: {
      type: "select",
      options: iconOptions,
    },
    mode: {
      type: "radio",
      options: [
        { label: "card", value: "card" },
        { label: "flat", value: "flat" },
      ],
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[
            { name: "title", type: "text", label: "Title" },
            { name: "description", type: "textarea", label: "Description" },
          ]}
        />
      ),
    },
  },
  defaultProps: {
    title: "Title",
    description: "Description",
    icon: "heart",
    mode: "flat",
    translations: {},
  },
  render: ({ title, icon, description, mode, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayTitle = translations?.[previewLanguage]?.title || title;
    const displayDescription = translations?.[previewLanguage]?.description || description;

    return (
      <Section>
        <div className={getClassName({ [mode]: true })}>
          <div className={getClassName("inner")}>
            <div className={getClassName("icon")}>{icon && icons[icon]}</div>
            <div className={getClassName("title")}>{displayTitle}</div>
            <div className={getClassName("description")}>{displayDescription}</div>
          </div>
        </div>
      </Section>
    );
  },
};

export const CardBlock = withLayout(CardBlockInternal);
