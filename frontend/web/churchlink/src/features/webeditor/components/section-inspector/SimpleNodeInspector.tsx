import React from "react";
import { Separator } from "@/shared/components/ui/separator";
import { Node } from "@/shared/types/pageV2";

interface SimpleNodeInspectorProps {
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
}

export const SimpleNodeInspector: React.FC<SimpleNodeInspectorProps> = ({
  node,
  onUpdateNode,
}) => {
  return (
    <>
      <div className="text-sm text-gray-500">Node ID: {node.id}</div>
      <Separator />
      
      {node.type === 'text' && (
        <div className="space-y-2">
          <label className="text-sm">Text / HTML</label>
          <textarea
            className="w-full h-28 border rounded p-2"
            defaultValue={(node as any).props?.html ?? ''}
            onChange={(e) =>
              onUpdateNode((n) => ({
                ...n,
                props: { ...(n.props || {}), html: e.target.value }
              }))
            }
          />
        </div>
      )}
      
      {node.type === 'button' && (
        <>
          <div className="space-y-2">
            <label className="text-sm">Button Label</label>
            <input
              className="w-full border rounded p-2"
              defaultValue={(node as any).props?.label ?? ''}
              onChange={(e) =>
                onUpdateNode((n) => ({
                  ...n,
                  props: { ...(n.props || {}), label: e.target.value }
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Button Link</label>
            <input
              className="w-full border rounded p-2"
              defaultValue={(node as any).props?.href ?? ''}
              onChange={(e) =>
                onUpdateNode((n) => ({
                  ...n,
                  props: { ...(n.props || {}), href: e.target.value }
                }))
              }
            />
          </div>
        </>
      )}
      
      {node.type === 'container' && (
        <>
          <div className="space-y-2">
            <label className="text-sm">Max Width Preset</label>
            <select
              value={(node as any).props?.maxWidth ?? 'xl'}
              onChange={(e) => onUpdateNode((n) => ({
                ...n,
                props: { ...(n.props || {}), maxWidth: e.target.value }
              }))}
              className="w-full border rounded p-2"
            >
              <option value="full">Full</option>
              <option value="2xl">2XL</option>
              <option value="xl">XL</option>
              <option value="lg">LG</option>
              <option value="md">MD</option>
              <option value="sm">SM</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Padding X</label>
              <input
                type="range"
                min={0}
                max={6}
                step={2}
                value={(node as any).props?.paddingX ?? 4}
                onChange={(e) => onUpdateNode((n) => ({
                  ...n,
                  props: { ...(n.props || {}), paddingX: Number(e.target.value) }
                }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm">Padding Y</label>
              <input
                type="range"
                min={0}
                max={6}
                step={2}
                value={(node as any).props?.paddingY ?? 6}
                onChange={(e) => onUpdateNode((n) => ({
                  ...n,
                  props: { ...(n.props || {}), paddingY: Number(e.target.value) }
                }))}
                className="w-full"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
};

