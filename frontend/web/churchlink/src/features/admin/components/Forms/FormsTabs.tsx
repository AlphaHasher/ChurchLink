import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

const FormsTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const current = location.pathname.includes('/forms/form-builder') ? 'builder' : 'manage';

  return (
    <Tabs value={current} onValueChange={(v) => {
      if (v === 'builder') navigate('/admin/forms/form-builder');
      else navigate('/admin/forms/manage-forms');
    }}>
      <TabsList>
        <TabsTrigger value="manage">Form Manager</TabsTrigger>
        <TabsTrigger value="builder">Form Builder</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default FormsTabs;
