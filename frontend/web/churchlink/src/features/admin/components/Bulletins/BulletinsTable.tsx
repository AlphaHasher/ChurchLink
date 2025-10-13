import { useState } from 'react';
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
import { ChurchBulletin } from '@/shared/types/ChurchBulletin';
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import { format } from 'date-fns';
import CreateBulletinDialog from './CreateBulletinDialog';
import EditBulletinDialog from './EditBulletinDialog';

interface BulletinsTableProps {
    bulletins: ChurchBulletin[];
    permissions: AccountPermissions | null;
    onRefresh: () => Promise<void>;
}

export function BulletinsTable({ bulletins, permissions, onRefresh }: BulletinsTableProps) {
    const [search, setSearch] = useState('');

    const filtered = bulletins.filter((b) => 
        b.headline.toLowerCase().includes(search.toLowerCase()) ||
        (b.ru_headline && b.ru_headline.toLowerCase().includes(search.toLowerCase()))
    );

    const formatWeek = (date: Date) => {
        return format(date, 'MMM dd, yyyy');
    };

    return (
        <div className="container mx-start">
            <div className="flex items-center py-4">
                <Input 
                    placeholder="Search Headline..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    className="max-w-sm" 
                />
                <div className="ml-auto flex items-center space-x-2">
                    <Button onClick={() => onRefresh()}>Refresh</Button>
                    <CreateBulletinDialog onSave={onRefresh} permissions={permissions} />
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto max-w-full">
                <Table className="w-full min-w-max">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Headline</TableHead>
                            <TableHead>Headline (RU)</TableHead>
                            <TableHead>Publish Date</TableHead>
                            <TableHead>Published</TableHead>
                            <TableHead>Pinned</TableHead>
                            <TableHead>Ministries</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {filtered.length ? (
                            filtered.map((b) => (
                                <TableRow key={b.id}>
                                    <TableCell>{b.headline}</TableCell>
                                    <TableCell>{b.ru_headline ?? ''}</TableCell>
                                    <TableCell>{formatWeek(b.publish_date)}</TableCell>
                                    <TableCell>
                                        <span
                                            className={
                                                `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
                                                    b.published
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                                }`
                                            }
                                        >
                                            {b.published ? 'Published' : 'Draft'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={
                                                `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
                                                    b.pinned
                                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                        : 'border-gray-200 bg-gray-50 text-gray-600'
                                                }`
                                            }
                                        >
                                            {b.pinned ? 'Pinned' : 'Normal'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {b.ministries.join(', ')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex space-x-2">
                                            <EditBulletinDialog bulletin={b} onSave={onRefresh} permissions={permissions} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">No results.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export default BulletinsTable;
