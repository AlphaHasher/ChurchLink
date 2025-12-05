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
import { ChurchSermon } from '@/shared/types/ChurchSermon';
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import { format } from 'date-fns';
import CreateSermonDialog from './CreateSermonDialog';
import EditSermonDialog from './EditSermonDialog';
import { Ministry } from '@/shared/types/Ministry';

interface SermonsTableProps {
    data: ChurchSermon[];
    permData: AccountPermissions[];
    onSave: () => Promise<void>;
    availableMinistries: Ministry[];
}

export function SermonsTable({ data, permData: _permData, onSave, availableMinistries }: SermonsTableProps) {
    const [search, setSearch] = useState('');
    // permData is accepted for future permission-based filtering; reference to avoid unused var lint
    void _permData;

    const filtered = data.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div >
            <div className="flex items-center py-4">
                <Input placeholder="Search Title..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
                <div className="ml-auto flex items-center space-x-2">
                    <Button onClick={() => onSave()}>Refresh</Button>
                    <CreateSermonDialog onSave={onSave} availableMinistries={availableMinistries} />
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto max-w-full">
                <Table className="w-full min-w-max">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Speaker</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Published</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {filtered.length ? (
                            filtered.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.title}</TableCell>
                                    <TableCell>{s.speaker}</TableCell>
                                    <TableCell>{s.date_posted ? format(new Date(s.date_posted), 'MMM dd, yyyy') : ''}</TableCell>
                                    <TableCell>
                                        <span
                                            className={
                                                `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
                                                    s.published
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                                }`
                                            }
                                        >
                                            {s.published ? 'Published' : 'Draft'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex space-x-2">
                                            <EditSermonDialog sermon={s} onSave={onSave} availableMinistries={availableMinistries} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No results.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export default SermonsTable;
