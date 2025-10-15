import React from 'react';

import { Node } from '@/shared/types/pageV2';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { BuilderState } from '@/features/webeditor/state/BuilderState';

type ContainerInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
};

export const ContainerInspector: React.FC<ContainerInspectorProps> = ({ node, onUpdate }) => {
  const prevRef = React.useRef<Node | null>(null);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="container-maxwidth">Max Width</Label>
        <Select
          value={node.props?.maxWidth || 'xl'}
          onValueChange={(value) =>
            onUpdate((n) =>
              n.type === 'container'
                ? ({ ...n, props: { ...(n.props || {}), maxWidth: value } } as Node)
                : n
            )
          }
          onOpenChange={(open) => {
            if (open) {
              prevRef.current = { ...node };
            } else {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }
          }}
        >
          <SelectTrigger id="container-maxwidth">
            <SelectValue placeholder="Select max width" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Small (640px)</SelectItem>
            <SelectItem value="md">Medium (768px)</SelectItem>
            <SelectItem value="lg">Large (1024px)</SelectItem>
            <SelectItem value="xl">Extra Large (1280px)</SelectItem>
            <SelectItem value="2xl">2XL (1536px)</SelectItem>
            <SelectItem value="full">Full Width</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="container-px">Padding X</Label>
          <NumericDragInput
            id="container-px"
            min={0}
            max={12}
            step={2}
            value={node.props?.paddingX ?? 4}
            onChange={(val) =>
              onUpdate((n) =>
                n.type === 'container'
                  ? ({ ...n, props: { ...(n.props || {}), paddingX: val } } as Node)
                  : n
              )
            }
            onFocus={() => { prevRef.current = { ...node }; }}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="container-py">Padding Y</Label>
          <NumericDragInput
            id="container-py"
            min={0}
            max={12}
            step={2}
            value={node.props?.paddingY ?? 6}
            onChange={(val) =>
              onUpdate((n) =>
                n.type === 'container'
                  ? ({ ...n, props: { ...(n.props || {}), paddingY: val } } as Node)
                  : n
              )
            }
            onFocus={() => { prevRef.current = { ...node }; }}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};


