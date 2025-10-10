import { useState } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
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

    const formatWeek = (date: Date) => {
        return format(date, 'MMM dd, yyyy');
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
                {formatWeek(service.display_week)}
            </TableCell>
            <TableCell>
                <span
                    className={
                        `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
                            service.visibility_mode === 'always'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                        }`
                    }
                >
                    {service.visibility_mode === 'always' ? 'Always' : 'Specific Weeks'}
                </span>
            </TableCell>
            <TableCell>
                <span
                    className={
                        `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
                            service.published
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`
                    }
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
    const [localServices, setLocalServices] = useState(services);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const filtered = (localServices.length ? localServices : services).filter((s) => 
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
        setLocalServices(reordered);

        const serviceIds = reordered.map(s => s.id);

        setIsReordering(true);
        try {
            await onReorder(serviceIds);
            console.log(`[Service Reorder] Successfully reordered ${serviceIds.length} services at ${new Date().toISOString()}`);
            toast.success('Services reordered successfully');
        } catch (err) {
            console.error('[Service Reorder Error]', err);
            toast.error('Failed to reorder services. Changes not saved.');
            setLocalServices(services);
        } finally {
            setIsReordering(false);
        }
    };

    const handleRefresh = async () => {
        await onRefresh();
        setLocalServices([]);
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
                <div className="ml-auto flex items-center space-x-2">
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
