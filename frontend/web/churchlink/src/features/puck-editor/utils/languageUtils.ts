import type { Data as PuckData, ComponentData } from "@measured/puck";

// Language codes and names from backend constants.py
export const LANGUAGES: Record<string, string> = {
  af: "Afrikaans",
  ak: "Twi",
  am: "Amharic",
  ar: "Arabic",
  as: "Assamese",
  ay: "Aymara",
  az: "Azerbaijani",
  be: "Belarusian",
  bg: "Bulgarian",
  bho: "Bhojpuri",
  bm: "Bambara",
  bn: "Bengali",
  bs: "Bosnian",
  ca: "Catalan",
  ceb: "Cebuano",
  ckb: "Kurdish (Sorani)",
  co: "Corsican",
  cs: "Czech",
  cy: "Welsh",
  da: "Danish",
  de: "German",
  doi: "Dogri",
  dv: "Divehi",
  ee: "Ewe",
  el: "Greek",
  en: "English",
  eo: "Esperanto",
  es: "Spanish",
  et: "Estonian",
  eu: "Basque",
  fa: "Persian",
  fi: "Finnish",
  fr: "French",
  fy: "Frisian",
  ga: "Irish Gaelic",
  gd: "Scots Gaelic",
  gl: "Galician",
  gn: "Guarani",
  gom: "Konkani",
  gu: "Gujarati",
  ha: "Hausa",
  haw: "Hawaiian",
  he: "Hebrew",
  hi: "Hindi",
  hmn: "Hmong",
  hr: "Croatian",
  ht: "Haitian Creole",
  hu: "Hungarian",
  hy: "Armenian",
  id: "Indonesian",
  ig: "Igbo",
  ilo: "Iloko",
  is: "Icelandic",
  it: "Italian",
  iw: "Hebrew",
  ja: "Japanese",
  jv: "Javanese",
  jw: "Javanese",
  ka: "Georgian",
  kk: "Kazakh",
  km: "Khmer",
  kn: "Kannada",
  ko: "Korean",
  kri: "Krio",
  ku: "Kurdish (Kurmanji)",
  ky: "Kyrgyz",
  la: "Latin",
  lb: "Luxembourgish",
  lg: "Ganda",
  ln: "Lingala",
  lo: "Lao",
  lt: "Lithuanian",
  lus: "Mizo",
  lv: "Latvian",
  mai: "Maithili",
  mg: "Malagasy",
  mi: "Maori",
  mk: "Macedonian",
  ml: "Malayalam",
  mn: "Mongolian",
  "mni-Mtei": "Meiteilon (Manipuri)",
  mr: "Marathi",
  ms: "Malay",
  mt: "Maltese",
  my: "Myanmar (Burmese)",
  ne: "Nepali",
  nl: "Dutch",
  no: "Norwegian",
  nso: "Northern Sotho",
  ny: "Chichewa",
  om: "Oromo",
  or: "Odia (Oriya)",
  pa: "Punjabi",
  pl: "Polish",
  ps: "Pashto",
  pt: "Portuguese",
  qu: "Quechua",
  ro: "Romanian",
  ru: "Russian",
  rw: "Kinyarwanda",
  sa: "Sanskrit",
  sd: "Sindhi",
  si: "Sinhala",
  sk: "Slovak",
  sl: "Slovenian",
  sm: "Samoan",
  sn: "Shona",
  so: "Somali",
  sq: "Albanian",
  sr: "Serbian",
  st: "Sesotho",
  su: "Sundanese",
  sv: "Swedish",
  sw: "Swahili",
  ta: "Tamil",
  te: "Telugu",
  tg: "Tajik",
  th: "Thai",
  ti: "Tigrinya",
  tk: "Turkmen",
  tl: "Filipino",
  tr: "Turkish",
  ts: "Tsonga",
  tt: "Tatar",
  ug: "Uyghur",
  uk: "Ukrainian",
  ur: "Urdu",
  uz: "Uzbek",
  vi: "Vietnamese",
  xh: "Xhosa",
  yi: "Yiddish",
  yo: "Yoruba",
  zh: "Chinese (Simplified)",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  zu: "Zulu",
};

export type TranslationMap = {
  [locale: string]: {
    [fieldName: string]: string;
  };
};

/**
 * Get display value for a field with smart fallback logic:
 * 1. User's account language
 * 2. Browser language (if different)
 * 3. Default language value
 * 4. First non-empty translation
 */
export function getDisplayValue(
  field: string,
  translations: TranslationMap,
  defaultValue: string,
  userLang: string,
  browserLang: string
): string {
  // 1. Try user's account language
  if (translations[userLang]?.[field]?.trim()) {
    return translations[userLang][field];
  }

  // 2. Try browser language (if different from user lang)
  if (browserLang !== userLang && translations[browserLang]?.[field]?.trim()) {
    return translations[browserLang][field];
  }

  // 3. Use default language value
  if (defaultValue?.trim()) {
    return defaultValue;
  }

  // 4. Last resort: find first non-empty translation
  for (const lang in translations) {
    if (translations[lang]?.[field]?.trim()) {
      return translations[lang][field];
    }
  }

  return ""; // Should never happen in practice
}

/**
 * Transform component data to use specific language with smart fallback
 */
export function localizeComponentData(
  data: PuckData,
  userLang: string,
  browserLang: string,
  _defaultLang: string
): PuckData {
  function localizeComponent(component: ComponentData): ComponentData {
    const translations = component.props.translations || {};
    const localizedProps = { ...component.props };

    // For each translatable field, use smart fallback
    Object.keys(localizedProps).forEach((key) => {
      if (key === "id" || key === "children" || key === "translations") return;

      // Check if this field has translations
      const hasTranslations = Object.values(translations).some(
        (langObj) => (langObj as Record<string, unknown>)?.[key] !== undefined
      );

      if (hasTranslations) {
        localizedProps[key] = getDisplayValue(
          key,
          translations,
          localizedProps[key] as string, // default value
          userLang,
          browserLang
        );
      }
    });

    // Recursively localize children
    if (Array.isArray(localizedProps.children)) {
      localizedProps.children = localizedProps.children.map(localizeComponent);
    }

    return { ...component, props: localizedProps };
  }

  return {
    ...data,
    content: data.content.map(localizeComponent),
  };
}

/**
 * Scan component data to find all languages that have translations
 */
export function getAvailableLanguages(data: PuckData): string[] {
  const defaultLanguage = ((data.root.props as { defaultLanguage?: string })?.defaultLanguage) || "en";
  const languages = new Set<string>([defaultLanguage]);

  function scanComponent(component: ComponentData) {
    // Check if component has translations
    if (component.props.translations) {
      Object.keys(component.props.translations).forEach((lang) => languages.add(lang));
    }

    // Recursively scan children (for GroupBlock and slots)
    if (Array.isArray(component.props.children)) {
      component.props.children.forEach(scanComponent);
    }
  }

  data.content.forEach(scanComponent);

  return Array.from(languages).sort();
}

/**
 * Get languages that have actual translations in components (excluding default language)
 */
export function getLanguagesInUse(data: PuckData): string[] {
  const languages = new Set<string>();

  function scanComponent(component: ComponentData) {
    // Check if component has translations
    if (component.props.translations) {
      Object.keys(component.props.translations).forEach((lang) => {
        // Only add if there's at least one non-empty translation
        const hasContent = Object.values(component.props.translations[lang] || {}).some(
          (val) => typeof val === "string" && val.trim() !== ""
        );
        if (hasContent) {
          languages.add(lang);
        }
      });
    }

    // Recursively scan children (for GroupBlock and slots)
    if (Array.isArray(component.props.children)) {
      component.props.children.forEach(scanComponent);
    }
  }

  data.content.forEach(scanComponent);

  return Array.from(languages).sort();
}
