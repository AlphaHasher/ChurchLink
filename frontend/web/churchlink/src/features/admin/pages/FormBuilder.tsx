import { BuilderShell } from "../components/Forms/BuilderShell";
import FormsTabs from '@/features/admin/components/Forms/FormsTabs';

const FormBuilder = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Forms</h1>
      <FormsTabs />
      <div className="mt-4">
        <BuilderShell />
      </div>
    </div>
  );
};

export default FormBuilder;


