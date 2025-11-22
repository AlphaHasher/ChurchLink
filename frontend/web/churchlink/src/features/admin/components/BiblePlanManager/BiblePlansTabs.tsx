import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

const BiblePlansTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  let current = 'manage';
  if (location.pathname.includes('/bible-plans/plan-builder')) {
    current = 'builder';
  } else if (location.pathname.includes('/bible-plans/manage-templates')) {
    current = 'templates';
  }

  return (
    <Tabs value={current} onValueChange={(v) => {
      if (v === 'builder') navigate('/admin/bible-plans/plan-builder');
      else if (v === 'templates') navigate('/admin/bible-plans/manage-templates');
      else navigate('/admin/bible-plans/manage-plans');
    }}>
      <TabsList>
        <TabsTrigger value="manage">Plan Manager</TabsTrigger>
        <TabsTrigger value="builder">Plan Builder</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default BiblePlansTabs;
