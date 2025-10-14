import React from 'react';

import { Node } from '@/shared/types/pageV2';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';

type EventListInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
};

export const EventListInspector: React.FC<EventListInspectorProps> = ({ node, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-title">Event List Title</Label>
        <Input
          id="event-title"
          value={node.props?.title || ''}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'eventList'
                ? ({ ...n, props: { ...(n.props || {}), title: e.target.value } } as Node)
                : n
            )
          }
          placeholder="Upcoming Events"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="event-show-filters"
          checked={node.props?.showFilters !== false}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'eventList'
                ? ({ ...n, props: { ...(n.props || {}), showFilters: e.target.checked } } as Node)
                : n
            )
          }
        />
        <Label htmlFor="event-show-filters">Show Filters</Label>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="event-show-title"
          checked={node.props?.showTitle !== false}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'eventList'
                ? ({ ...n, props: { ...(n.props || {}), showTitle: e.target.checked } } as Node)
                : n
            )
          }
        />
        <Label htmlFor="event-show-title">Show Title</Label>
      </div>
    </div>
  );
};


