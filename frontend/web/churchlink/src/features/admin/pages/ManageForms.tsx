import FormsTabs from '@/features/admin/components/Forms/FormsTabs';

const ManageForms = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Forms</h1>

      <FormsTabs />

      <div className="mt-4 p-4 bg-white border rounded">
        <p className="text-muted-foreground">Placeholder for managing forms</p>
      </div>
    </div>
  );
};

export default ManageForms;
