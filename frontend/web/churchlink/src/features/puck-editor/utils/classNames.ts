/**
 * BEM-style className generator for CSS modules
 *
 * Usage:
 * const getClassName = getClassNameFactory("Card", styles);
 *
 * getClassName() → "Card"
 * getClassName("title") → "Card-title"
 * getClassName({ card: true }) → "Card Card--card"
 * getClassName({ card: true, flat: false }) → "Card Card--card"
 */
export function getClassNameFactory(
  block: string,
  styles: Record<string, string>
) {
  return (element?: string | Record<string, boolean>, extra?: string) => {
    // Base block class
    if (!element && !extra) {
      return styles[block] || block;
    }

    // Element: "Card-title"
    if (typeof element === 'string') {
      const className = `${block}-${element}`;
      return styles[className] || className;
    }

    // Modifiers: { card: true, flat: false }
    if (typeof element === 'object') {
      const baseClass = styles[block] || block;
      const modifiers = Object.keys(element)
        .filter(key => element[key])
        .map(key => {
          const modifierClass = `${block}--${key}`;
          return styles[modifierClass] || modifierClass;
        })
        .join(' ');

      const result = [baseClass, modifiers, extra].filter(Boolean).join(' ');
      return result.trim();
    }

    return styles[block] || block;
  };
}
