import React from 'react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { Node } from '@/shared/types/pageV2';

type ButtonInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
};

export const ButtonInspector: React.FC<ButtonInspectorProps> = ({ node, onUpdate }) => {
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
          placeholder="https://example.com"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Button Preview</Label>
        <div className="border rounded-md p-4 bg-muted/30">
          <Button className="px-4 py-2">
            {node.props?.label || 'Button'}
          </Button>
        </div>
      </div>
    </div>
  );
};


