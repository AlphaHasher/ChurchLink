import DOMPurify from "dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Allows common text formatting tags but strips scripts and dangerous attributes.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      // Text formatting
      "b", "i", "u", "s", "strong", "em", "mark", "small", "del", "ins", "sub", "sup",
      // Structure
      "p", "br", "hr", "div", "span",
      // Lists
      "ul", "ol", "li",
      // Headings
      "h1", "h2", "h3", "h4", "h5", "h6",
      // Links
      "a",
      // Quotes
      "blockquote", "q", "cite",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", // for links
      "class", "style", // for styling
    ],
  });
}
