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
import { ServiceBulletin } from '@/shared/types/ChurchBulletin';
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import { format } from 'date-fns';
import CreateServiceDialog from './CreateServiceDialog';
import EditServiceDialog from './EditServiceDialog';
import { GripVertical } from 'lucide-react';
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

interface ServicesTableProps {
    services: ServiceBulletin[];
    permissions: AccountPermissions | null;
    onRefresh: () => Promise<void>;
    onReorder: (serviceIds: string[]) => Promise<void>;
}

interface SortableRowProps {
    service: ServiceBulletin;
    permissions: AccountPermissions | null;
    onRefresh: () => Promise<void>;
}

function SortableRow({ service, permissions, onRefresh }: SortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: service.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const formatWeek = (service: ServiceBulletin) => {
        // For 'always' visibility mode, display the current week's Monday
        if (service.visibility_mode === 'always') {
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Normalize to Monday
            const currentWeekMonday = new Date(now);
            currentWeekMonday.setDate(now.getDate() - daysToSubtract);
            currentWeekMonday.setHours(0, 0, 0, 0); // Normalize time to 00:00:00
            return format(currentWeekMonday, 'MMM dd, yyyy');
        }
        // For 'specific_weeks' visibility mode, display the stored display_week
        return format(service.display_week, 'MMM dd, yyyy');
    };

    const formatServiceTime = (dayOfWeek: string, timeOfDay: string) => {
        // Convert 24-hour time to 12-hour format with AM/PM
        const [hours, minutes] = timeOfDay.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${dayOfWeek} ${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    return (
        <TableRow ref={setNodeRef} style={style}>
            <TableCell {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-gray-400" />
            </TableCell>
            <TableCell>{service.order}</TableCell>
            <TableCell className="font-medium">
                {service.title}
            </TableCell>
            <TableCell>
                {formatServiceTime(service.day_of_week, service.time_of_day)}
            </TableCell>
            <TableCell>
                {formatWeek(service)}
            </TableCell>
            <TableCell>
                <span
                    className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
                        service.visibility_mode === 'always'
                            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/20'
                            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/20'
                    )}
                >
                    {service.visibility_mode === 'always' ? 'Always' : 'Specific Weeks'}
                </span>
            </TableCell>
            <TableCell>
                <span
                    className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
                        service.published
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-400/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25'
                            : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20'
                    )}
                >
                    {service.published ? 'Published' : 'Draft'}
                </span>
            </TableCell>
            <TableCell>
                <EditServiceDialog 
                    service={service} 
                    onSave={onRefresh} 
                    permissions={permissions} 
                />
            </TableCell>
        </TableRow>
    );
}

export function ServicesTable({ 
    services, 
    permissions, 
    onRefresh,
    onReorder 
}: ServicesTableProps) {
    const [search, setSearch] = useState('');
    const [isReordering, setIsReordering] = useState(false);
    const [localServices, setLocalServices] = useState<ServiceBulletin[]>(services);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Sync local state when services prop changes
    useEffect(() => {
        setLocalServices(services);
    }, [services]);

    const filtered = localServices.filter((s) => 
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = filtered.findIndex((s) => s.id === active.id);
        const newIndex = filtered.findIndex((s) => s.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(filtered, oldIndex, newIndex);
        
        // Update order field values to reflect new positions
        const updatedServices = reordered.map((service, index) => ({
            ...service,
            order: index + 1
        }));
        
        // Immediately update UI with new order values
        setLocalServices(updatedServices);

        const serviceIds = updatedServices.map(s => s.id);

        setIsReordering(true);
        try {
            await onReorder(serviceIds);
            console.log(`[Service Reorder] Successfully reordered ${serviceIds.length} services at ${new Date().toISOString()}`);
            toast.success('Services reordered successfully');
            // Refresh from backend to get authoritative order
            await onRefresh();
        } catch (err) {
            console.error('[Service Reorder Error]', err);
            toast.error('Failed to reorder services. Changes not saved.');
            // Revert to original order on error
            setLocalServices(services);
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
                    placeholder="Search Title or Description..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    className="max-w-sm" 
                />
                <div className="ml-auto flex items-center gap-3">
                    <Button onClick={handleRefresh} disabled={isReordering}>
                        Refresh
                    </Button>
                    <CreateServiceDialog onSave={handleRefresh} permissions={permissions} />
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
                                <TableHead>Title</TableHead>
                                <TableHead>Service Time</TableHead>
                                <TableHead>Display Week</TableHead>
                                <TableHead>Visibility</TableHead>
                                <TableHead>Published</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>

                        <SortableContext 
                            items={filtered.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <TableBody>
                                {filtered.length ? (
                                    filtered.map((service) => (
                                        <SortableRow 
                                            key={service.id}
                                            service={service}
                                            permissions={permissions}
                                            onRefresh={handleRefresh}
                                        />
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No services found.
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

export default ServicesTable;
