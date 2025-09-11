import { useMemo, useRef, useState, useEffect } from 'react';
import api from '@/api/api';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { ReadingPlan, BiblePassage } from '@/shared/types/BiblePlan';
import BiblePassageSelector from './BiblePassageSelector';
import { Download, Upload, Save, ChevronDown } from 'lucide-react';

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
  
  // Template selection state
  const [templates, setTemplates] = useState<ReadingPlan[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReadingPlan | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // keep plan name wired to parent for persistence
  const commitName = (name: string) => setPlan(prev => ({ ...prev, name }));

  const handleDurationChange = (value: string) => {
    setPlan(prev => ({ ...prev, duration: parseInt(value) }));
  };

  const normalizedPlan = useMemo(() => ({
    id: plan.id,
    name: plan.name,
    duration: plan.duration,
    readings: plan.readings,
  }), [plan]);

  const planJson = useMemo(() => JSON.stringify(normalizedPlan, null, 2), [normalizedPlan]);

  // Auto-dismiss success alerts after a short delay
  useEffect(() => {
    if (status?.type === 'success') {
      const timeoutId = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [status]);

  // Load templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const response = await api.get('/v1/bible-plans/templates');
        setTemplates(response.data);
      } catch (error) {
        console.error('Failed to load templates:', error);
        setStatus({ 
          type: 'error', 
          title: 'Failed to load templates', 
          message: 'Could not load Bible plan templates. Please try again.' 
        });
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  // Check if plan has any readings
  const planHasReadings = useMemo(() => {
    return Object.values(plan.readings).some(dayReadings => dayReadings.length > 0);
  }, [plan.readings]);

  // Handle template selection
  const handleTemplateSelect = (template: ReadingPlan) => {
    setSelectedTemplate(template);
    if (planHasReadings) {
      setShowConfirmDialog(true);
    } else {
      applyTemplate(template);
    }
  };

  // Apply template to plan
  const applyTemplate = (template: ReadingPlan) => {
    // Template already has readings in the correct format
    setPlan(prev => ({
      ...prev,
      name: template.name,
      duration: template.duration,
      readings: template.readings,
    }));

    setPlanName(template.name);
    setShowConfirmDialog(false);
    setSelectedTemplate(null);
    
    setStatus({ 
      type: 'success', 
      title: 'Template Applied', 
      message: `Successfully applied "${template.name}" template.` 
    });
  };

  const handleSavePlan = async () => {
    // Frontend validation
    const trimmedName = (planName || '').trim();
  const hasAnyPassages = Object.values(plan.readings).some((d: any) => (d || []).length > 0);
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
      if (data && typeof data === 'object' && data.duration != null && data.readings) {
        setPlan(data as ReadingPlan);
        setPlanName(data.name ?? '');
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
          <Label>Bible Plan Templates</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between"
                disabled={loadingTemplates}
              >
                {loadingTemplates ? 'Loading templates...' : 'Choose a template'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full">
              {templates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="flex flex-col items-start"
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-gray-400">{template.duration} days</div>
                </DropdownMenuItem>
              ))}
              {templates.length === 0 && !loadingTemplates && (
                <DropdownMenuItem disabled>No templates available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Current Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have readings in your current plan. Applying the template "{selectedTemplate?.name}" 
              will replace all existing readings and settings. This action cannot be undone.
              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmDialog(false);
              setSelectedTemplate(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedTemplate && applyTemplate(selectedTemplate)}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Replace Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlanSidebar;
