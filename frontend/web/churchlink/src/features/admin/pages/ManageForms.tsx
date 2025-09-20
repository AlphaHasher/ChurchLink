import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

const ManageForms = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchDept, setSearchDept] = useState('');

  const fetchForms = async () => {
    try {
      const resp = await api.get('/v1/forms/');
      setForms(resp.data || []);
    } catch (e) {
      console.error('Failed to fetch forms', e);
    }
  };

  const search = async () => {
    try {
      const params: Record<string, string> = {};
      if (searchName) params.name = searchName;
      if (searchDept) params.folder = searchDept;
      const resp = await api.get('/v1/forms/search', { params });
      setForms(resp.data || []);
    } catch (e) {
      console.error('Search failed', e);
    }
  };

  useEffect(() => { fetchForms(); }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Forms</h1>

      <FormsTabs />

      <div className="mt-4 p-4 bg-white border rounded">
        <div className="flex gap-2 items-center mb-4">
          <Input placeholder="Search by name" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
          <Input placeholder="Department" value={searchDept} onChange={(e) => setSearchDept(e.target.value)} />
          <Button onClick={search}>Search</Button>
          <Button variant="ghost" onClick={fetchForms}>Clear</Button>
        </div>

        <div className="space-y-2">
          {forms.length === 0 && <div className="text-sm text-muted-foreground">No forms found</div>}
          {forms.map((f) => (
            <div key={f.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <div className="font-medium">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.folder}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate(`/admin/forms/form-builder?load=${f.id}`)}>Edit</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManageForms;
