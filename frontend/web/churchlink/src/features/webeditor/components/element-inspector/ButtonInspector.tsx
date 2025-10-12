import React from 'react';

// import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Node } from '@/shared/types/pageV2';
import { BuilderState } from '@/features/webeditor/state/BuilderState';

type ButtonInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
};

export const ButtonInspector: React.FC<ButtonInspectorProps> = ({ node, onUpdate }) => {
  const prevRef = React.useRef<Node | null>(null);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="button-label">Button Label</Label>
        <Input
          id="button-label"
          value={node.props?.label || ''}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'button'
                ? ({ ...n, props: { ...(n.props || {}), label: e.target.value } } as Node)
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


