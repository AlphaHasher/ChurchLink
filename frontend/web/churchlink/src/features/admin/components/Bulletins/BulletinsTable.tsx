import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/components/ui/DataTable';
import { ChurchBulletin } from '@/shared/types/ChurchBulletin';
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import { format } from 'date-fns';
import CreateBulletinDialog from './CreateBulletinDialog';
import EditBulletinDialog from './EditBulletinDialog';
import { GripVertical, Image as ImageIcon } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface BulletinsTableProps {
    bulletins: ChurchBulletin[];
    permissions: AccountPermissions | null;
    onRefresh: () => Promise<void>;
    onReorder: (bulletinIds: string[]) => Promise<void>;
}

interface SortableRowProps {
    bulletin: ChurchBulletin;
    permissions: AccountPermissions | null;
    onRefresh: () => Promise<void>;
}

function SortableRow({ bulletin, permissions, onRefresh }: SortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: bulletin.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const formatDate = (date: Date) => {
        return format(date, 'MMM dd, yyyy');
    };

    // Check if bulletin has expired
    const isExpired = bulletin.expire_at && new Date(bulletin.expire_at) < new Date();

    // Determine status display
    const getStatusDisplay = () => {
        if (isExpired) {
            return {
                label: 'Expired',
                className: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-400/15 dark:text-red-200 dark:hover:bg-red-400/25'
            };
        } else if (bulletin.published) {
            return {
                label: 'Published',
                className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-400/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25'
            };
        } else {
            return {
                label: 'Draft',
                className: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20'
            };
        }
    };

    const status = getStatusDisplay();

    return (
        <TableRow ref={setNodeRef} style={style}>
            <TableCell {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-gray-400" />
            </TableCell>
            <TableCell>{bulletin.order}</TableCell>
            <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                    {bulletin.image_id && (
                        <ImageIcon className="h-4 w-4 text-gray-400" title="Has image" />
                    )}
                    {bulletin.headline}
                </div>
            </TableCell>
            <TableCell>{formatDate(bulletin.publish_date)}</TableCell>
            <TableCell>
                {bulletin.expire_at ? formatDate(bulletin.expire_at) : (
                    <span className="text-gray-400 italic">Never</span>
                )}
            </TableCell>
            <TableCell>
                <span
                    className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
                        status.className
                    )}
                >
                    {status.label}
                </span>
            </TableCell>
            <TableCell>
                {bulletin.ministries && bulletin.ministries.length > 0
                    ? bulletin.ministries.join(', ')
                    : '-'}
            </TableCell>
            <TableCell>
                <EditBulletinDialog 
                    bulletin={bulletin} 
                    onSave={onRefresh} 
                    permissions={permissions} 
                />
            </TableCell>
        </TableRow>
    );
}

export function BulletinsTable({ 
    bulletins, 
    permissions, 
    onRefresh,
    onReorder,
}: BulletinsTableProps) {
    const [search, setSearch] = useState('');
    const [isReordering, setIsReordering] = useState(false);
    const [localBulletins, setLocalBulletins] = useState<ChurchBulletin[]>(bulletins);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Sync local state when bulletins prop changes
    useEffect(() => {
        setLocalBulletins(bulletins);
    }, [bulletins]);

    const filtered = localBulletins.filter((b) => 
        b.headline.toLowerCase().includes(search.toLowerCase()) ||
        (b.body && b.body.toLowerCase().includes(search.toLowerCase()))
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = filtered.findIndex((b) => b.id === active.id);
        const newIndex = filtered.findIndex((b) => b.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(filtered, oldIndex, newIndex);
        
        // Update order field values to reflect new positions
        const updatedBulletins = reordered.map((bulletin, index) => ({
            ...bulletin,
            order: index + 1
        }));
        
        // Immediately update UI with new order values
        setLocalBulletins(updatedBulletins);

        const bulletinIds = updatedBulletins.map(b => b.id);

        setIsReordering(true);
        try {
            await onReorder(bulletinIds);
            console.log(`[Bulletin Reorder] Successfully reordered ${bulletinIds.length} bulletins at ${new Date().toISOString()}`);
            toast.success('Bulletins reordered successfully');
            // Refresh from backend to get authoritative order
            await onRefresh();
        } catch (err) {
            console.error('[Bulletin Reorder Error]', err);
            toast.error('Failed to reorder bulletins. Changes not saved.');
            // Revert to original order on error
            setLocalBulletins(bulletins);
        } finally {
            setIsReordering(false);
        }
    };

    const handleRefresh = async () => {
        await onRefresh();
    };

    return (
        <div className="container mx-start">
            <div className="flex items-center py-4">
                <Input 
                    placeholder="Search Headline or Body..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    className="max-w-sm" 
                />
                <div className="ml-auto flex items-center gap-3">
                    <Button onClick={handleRefresh} disabled={isReordering}>
                        Refresh
                    </Button>
                    <CreateBulletinDialog onSave={handleRefresh} permissions={permissions} />
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto max-w-full">
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <Table className="w-full min-w-max">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead>Headline</TableHead>
                                <TableHead>Publish Date</TableHead>
                                <TableHead>Expiration Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Ministries</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>

                        <SortableContext 
                            items={filtered.map(b => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <TableBody>
                                {filtered.length ? (
                                    filtered.map((bulletin) => (
                                        <SortableRow 
                                            key={bulletin.id}
                                            bulletin={bulletin}
                                            permissions={permissions}
                                            onRefresh={handleRefresh}
                                        />
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            No bulletins found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </SortableContext>
                    </Table>
                </DndContext>
            </div>
        </div>
    );
}

export default BulletinsTable;
