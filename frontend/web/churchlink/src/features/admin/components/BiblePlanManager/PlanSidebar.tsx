import { useState } from 'react';
import { Button } from '../../../../shared/components/ui/button';
import { Input } from '../../../../shared/components/ui/input';
import { Label } from '../../../../shared/components/ui/label';
import { ReadingPlan, READING_PLAN_TEMPLATES } from '../../../../shared/types/BiblePlan';
import BiblePassageSelector from './BiblePassageSelector';
import { Download, Upload, Save } from 'lucide-react';

interface PlanSidebarProps {
  plan: ReadingPlan;
  setPlan: React.Dispatch<React.SetStateAction<ReadingPlan>>;
}

const PlanSidebar = ({ plan, setPlan }: PlanSidebarProps) => {
  const [planName, setPlanName] = useState(plan.name);

  const handleDurationChange = (value: string) => {
    setPlan(prev => ({ ...prev, duration: parseInt(value) }));
  };

  const handleTemplateChange = (value: string) => {
    setPlan(prev => ({ ...prev, template: value }));
    // TODO: Auto-populate readings based on template
  };

  const handleSavePlan = () => {
    // TODO
    console.log('Saving plan:', plan);
  };

  const handleImportPlan = () => {
    // TODO
    console.log('Importing plan');
  };

  const handleExportPlan = () => {
    // TODO
    console.log('Exporting plan');
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Plan Name */}
        <div className="space-y-2">
          <Label htmlFor="plan-name">Plan Name</Label>
          <Input
            id="plan-name"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="Enter plan name"
          />
        </div>

        {/* Duration Selector */}
        <div className="space-y-2">
          <Label htmlFor="duration">Plan Duration (Days)</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            max="365"
            value={plan.duration}
            onChange={(e) => handleDurationChange(e.target.value)}
          />
        </div>

        {/* Template Selector */}
        <div className="space-y-2">
          <Label htmlFor="template">Select a Template</Label>
          <select
            id="template"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onChange={(e) => handleTemplateChange(e.target.value)}
            value={plan.template}
          >
            <option value="">Choose a reading plan template</option>
            {READING_PLAN_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
        </div>

        {/* Bible Passage Selector */}
        <div className="space-y-2">
          <Label>Bible Passage Selector</Label>
          <BiblePassageSelector />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-6 border-t border-gray-200">
          <Button onClick={handleSavePlan} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            Save Plan
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleImportPlan} className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExportPlan} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSidebar;
