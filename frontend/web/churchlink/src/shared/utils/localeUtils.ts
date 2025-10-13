/**
 * Locale utility functions for internationalization support
 */

/**
 * Detect user's preferred locale from browser
 * Returns 'ru' for Russian, 'en' for English (default)
 */
export function detectUserLocale(): 'en' | 'ru' {
    const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage;
    
    if (browserLang) {
        const langCode = browserLang.toLowerCase().split('-')[0];
        if (langCode === 'ru') {
            return 'ru';
        }
    }
    
    return 'en';
}

/**
 * Get locale-appropriate text from an object with en and ru variants
 * Falls back to English if Russian not available
 */
export function getLocalizedText(
    enText: string,
    ruText: string | undefined | null,
    locale?: 'en' | 'ru'
): string {
    const userLocale = locale || detectUserLocale();
    
    if (userLocale === 'ru' && ruText && ruText.trim() !== '') {
        return ruText;
    }
    
    return enText;
}

/**
 * Helper to get localized bulletin fields
 */
export function getLocalizedBulletinFields(
    bulletin: {
        headline: string;
        body: string;
        ru_headline?: string;
        ru_body?: string;
    },
    locale?: 'en' | 'ru'
) {
    const userLocale = locale || detectUserLocale();
    
    return {
        headline: getLocalizedText(bulletin.headline, bulletin.ru_headline, userLocale),
        body: getLocalizedText(bulletin.body, bulletin.ru_body, userLocale),
    };
}

/**
 * Log locale detection for debugging
 */
export function logLocaleInfo() {
    const locale = detectUserLocale();
    console.log(`[Locale] Detected user locale: ${locale} at ${new Date().toISOString()}`);
    return locale;
}
