/**
 * Determine the default width units for a given node type.
 *
 * @param type - Node type identifier (e.g., 'container', 'text', 'button', 'eventList')
 * @returns `12` for 'container' and 'eventList', `8` for 'text' and unknown or missing types, `4` for 'button'
 */
export function getDefaultWu(type?: string): number {
  switch (type) {
    case 'container': return 12;
    case 'text': return 8;
    case 'button': return 4;
    case 'eventList': return 12;
    default: return 8;
  }
}

/**
 * Selects the default height units for a node type.
 *
 * @param type - Node type; accepted values: `'container'`, `'text'`, `'button'`, `'eventList'`
 * @returns `8` for `'container'`, `2` for `'text'` and unknown/omitted types, `1` for `'button'`, `6` for `'eventList'`
 */
export function getDefaultHu(type?: string): number {
  switch (type) {
    case 'container': return 8;
    case 'text': return 2;
    case 'button': return 1;
    case 'eventList': return 6;
    default: return 2;
  }
}
