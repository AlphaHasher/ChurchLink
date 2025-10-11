import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

const BiblePlansTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const current = location.pathname.includes('/bible-plans/plan-builder') ? 'builder' : 'manage';

  return (
    <Tabs value={current} onValueChange={(v) => {
      if (v === 'builder') navigate('/admin/bible-plans/plan-builder');
      else navigate('/admin/bible-plans/manage-plans');
    }}>
      <TabsList>
        <TabsTrigger value="manage">Plan Manager</TabsTrigger>
        <TabsTrigger value="builder">Plan Builder</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default BiblePlansTabs;
