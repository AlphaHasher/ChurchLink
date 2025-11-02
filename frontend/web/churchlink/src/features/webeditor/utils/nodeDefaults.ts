/**
 * Get default width units (wu) based on node type
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
 * Get default height units (hu) based on node type
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

