import { useMemo, useRef, useState, useEffect } from 'react';
import api from '@/api/api';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { ReadingPlan, READING_PLAN_TEMPLATES, BiblePassage } from '@/shared/types/BiblePlan';
import BiblePassageSelector from './BiblePassageSelector';
import { Download, Upload, Save } from 'lucide-react';

interface PlanSidebarProps {
  plan: ReadingPlan;
  setPlan: React.Dispatch<React.SetStateAction<ReadingPlan>>;
  selectedDay?: number | null;
  onCreatePassageForDay?: (day: number, passage: BiblePassage) => void;
}

const PlanSidebar = ({ plan, setPlan, selectedDay, onCreatePassageForDay }: PlanSidebarProps) => {
  const [planName, setPlanName] = useState(plan.name);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; title?: string; message?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // keep plan name wired to parent for persistence
  const commitName = (name: string) => setPlan(prev => ({ ...prev, name }));

  const handleDurationChange = (value: string) => {
    setPlan(prev => ({ ...prev, duration: parseInt(value) }));
  };

  const handleTemplateChange = (value: string) => {
    setPlan(prev => ({ ...prev, template: value }));
    // TODO: Auto-populate readings based on template
  };

  const normalizedPlan = useMemo(() => {
    const days = Array.from({ length: plan.duration }, (_, i) => {
      const dayKey = String(i + 1);
      return {
        dayNumber: i + 1,
        passages: plan.readings[dayKey] || [],
      };
    });
    return {
      id: plan.id,
      name: plan.name,
      duration: plan.duration,
      template: plan.template,
      days,
    };
  }, [plan]);

  const planJson = useMemo(() => JSON.stringify(normalizedPlan, null, 2), [normalizedPlan]);

  // Auto-dismiss success alerts after a short delay
  useEffect(() => {
    if (status?.type === 'success') {
      const timeoutId = setTimeout(() => setStatus(null), 10000);
      return () => clearTimeout(timeoutId);
    }
  }, [status]);

  const handleSavePlan = async () => {
    // Frontend validation
    const trimmedName = (planName || '').trim();
    const hasAnyPassages = Object.values(normalizedPlan.days).some((d: any) => (d.passages || []).length > 0);
    if (!trimmedName) {
      setStatus({ type: 'warning' as any, title: 'Name required', message: 'Please enter a plan name before saving.' });
      return;
    }
    if (!hasAnyPassages) {
      setStatus({ type: 'warning' as any, title: 'No passages', message: 'Add at least one passage to save this plan.' });
      return;
    }
    try {
      const { data } = await api.post('/v1/bible-plans', normalizedPlan);
      console.log('Saved plan:', data);
      // Optionally set returned id/name
      if (data?.id) {
        setPlan(prev => ({ ...prev, id: data.id }));
      }
      setStatus({ type: 'success', title: 'Saved', message: 'Reading plan saved successfully.' });
    } catch (err) {
      console.error('Failed to save plan', err);
      setStatus({ type: 'error', title: 'Save failed', message: 'We could not save your plan. Please try again.' });
    }
  };

  const handleImportPlan = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as any;
      // Accept either full ReadingPlan shape or normalized { days: [...] }
      if (data && Array.isArray(data.days)) {
        const readings: Record<string, BiblePassage[]> = {};
        for (const d of data.days) {
          if (!d || typeof d.dayNumber !== 'number') continue;
          readings[String(d.dayNumber)] = Array.isArray(d.passages) ? d.passages : [];
        }
        setPlan({
          id: data.id ?? '',
          name: data.name ?? '',
          duration: data.duration ?? data.days.length ?? 0,
          template: data.template ?? '',
          readings,
        });
      } else if (data && typeof data === 'object' && data.duration != null && data.readings) {
        setPlan(data as ReadingPlan);
      } else {
        throw new Error('Invalid plan file');
      }
    } catch (err) {
      console.error('Failed to import plan:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleExportPlan = () => {
    const blob = new Blob([planJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.name || 'reading-plan'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
            onChange={(e) => {
              setPlanName(e.target.value);
              commitName(e.target.value);
            }}
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

  {/* No real-world dates: plan uses numbered days only */}

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
          <BiblePassageSelector
            selectedDay={selectedDay}
            onCreatePassage={(p) => {
              if (!selectedDay) return;
              if (onCreatePassageForDay) {
                onCreatePassageForDay(selectedDay, p);
                return;
              }
              setPlan(prev => ({
                ...prev,
                readings: {
                  ...prev.readings,
                  [String(selectedDay)]: [...(prev.readings[String(selectedDay)] || []), p]
                }
              }));
            }}
          />
        </div>

        {/* Alerts */}
        {status?.type && (
          <Alert variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'} className="mt-2">
            <AlertTitle>{status.title}</AlertTitle>
            {status.message && <AlertDescription>{status.message}</AlertDescription>}
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-6 border-t border-gray-200">
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onFileSelected} />
          <Button onClick={handleSavePlan} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            Save Plan
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleImportPlan} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExportPlan} className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSidebar;
