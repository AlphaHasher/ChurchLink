import React from 'react';

export const ScopedStyle: React.FC<{ nodeId: string; css: string | undefined }>
  = ({ nodeId, css }) => {
  React.useEffect(() => {
    const id = `scoped-style-${nodeId}`;
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!css || !css.trim()) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    const scoped = css.replace(/&/g, `[data-node-id='${nodeId}']`);
    if (!el) {
      el = document.createElement('style');
      el.type = 'text/css';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = scoped;
    return () => {
      const existing = document.getElementById(id);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    };
  }, [nodeId, css]);
  return null;
};

export default ScopedStyle;


