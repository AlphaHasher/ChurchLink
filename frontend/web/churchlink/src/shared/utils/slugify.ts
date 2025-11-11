/**
 * Converts a string into a URL-friendly slug
 * @param text - The text to slugify
 * @returns A slugified string (lowercase, spaces to hyphens, special characters removed)
 * @example
 * slugify("Hello World!") // "hello-world"
 * slugify("My Form Title") // "my-form-title"
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
