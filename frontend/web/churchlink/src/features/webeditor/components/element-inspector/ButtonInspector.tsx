import React from 'react';

// import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Node } from '@/shared/types/pageV2';
import { BuilderState } from '@/features/webeditor/state/BuilderState';

type ButtonInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
  activeLocale?: string;
  defaultLocale?: string;
};

function resolveLocalized(node: Node, key: string, activeLocale?: string, defaultLocale?: string): any {
  const i18n = (node as any).i18n as Record<string, Record<string, any>> | undefined;
  const locale = activeLocale || defaultLocale;
  if (locale && i18n && i18n[locale] && i18n[locale].hasOwnProperty(key)) return i18n[locale][key];
  return (node as any).props?.[key];
}

export const ButtonInspector: React.FC<ButtonInspectorProps> = ({ node, onUpdate, activeLocale, defaultLocale }) => {
  const prevRef = React.useRef<Node | null>(null);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="button-label">Button Label</Label>
        <Input
          id="button-label"
          value={resolveLocalized(node, 'label', activeLocale, defaultLocale) || ''}
          onChange={(e) => {
            const value = e.target.value;
            onUpdate((n) => {
              if (n.type !== 'button') return n;
              const useLocale = activeLocale && defaultLocale && activeLocale !== defaultLocale ? activeLocale : null;
              if (useLocale) {
                const prevI18n = ((n as any).i18n || {}) as Record<string, Record<string, any>>;
                const prevFor = prevI18n[useLocale] || {};
                return { ...(n as any), i18n: { ...prevI18n, [useLocale]: { ...prevFor, label: value } } } as Node;
              }
              return ({ ...n, props: { ...(n.props || {}), label: value } } as Node);
            });
          }}
          onFocus={() => { prevRef.current = { ...node }; }}
          onBlur={() => {
            const sectionId = BuilderState.selection?.sectionId;
            const nodeId = BuilderState.selection?.nodeId;
            if (sectionId && nodeId && prevRef.current) {
              BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
              prevRef.current = null;
            }
          }}
          placeholder="Click me"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="button-href">Link URL</Label>
        <Input
          id="button-href"
          value={node.props?.href || ''}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'button'
                ? ({ ...n, props: { ...(n.props || {}), href: e.target.value } } as Node)
                : n
            )
          }
          onFocus={() => { prevRef.current = { ...node }; }}
          onBlur={() => {
            const sectionId = BuilderState.selection?.sectionId;
            const nodeId = BuilderState.selection?.nodeId;
            if (sectionId && nodeId && prevRef.current) {
              BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
              prevRef.current = null;
            }
          }}
          placeholder="https://example.com"
        />
      </div>

      {/* Background is now handled by the global Background control above. */}
    </div>
  );
};


