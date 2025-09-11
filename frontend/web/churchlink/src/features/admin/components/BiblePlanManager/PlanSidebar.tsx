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

type ReadingPlanWithId = ReadingPlan & { id: string };

const PlanSidebar = ({ plan, setPlan, selectedDay, onCreatePassageForDay }: PlanSidebarProps) => {
  const [planName, setPlanName] = useState(plan.name);
  const [planId, setPlanId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; title?: string; message?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ReadingPlanWithId[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReadingPlanWithId | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [userPlans, setUserPlans] = useState<ReadingPlanWithId[]>([]);
  const [showNameConflictDialog, setShowNameConflictDialog] = useState(false);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);

  // keep plan name wired to parent for persistence
  const commitName = (name: string) => setPlan(prev => ({ ...prev, name }));

  const handleDurationChange = (value: string) => {
    setPlan(prev => ({ ...prev, duration: parseInt(value) }));
  };

  const planJson = useMemo(() => JSON.stringify({
    name: plan.name,
    duration: plan.duration,
    readings: plan.readings,
  }, null, 2), [plan]);

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

  useEffect(() => {
    const loadUserPlans = async () => {
      try {
        const { data } = await api.get('/v1/bible-plans');
        setUserPlans(data || []);
      } catch (e) { }
    };
    loadUserPlans();
  }, []);

  // Check if plan has any readings
  const planHasReadings = useMemo(() => {
    return Object.values(plan.readings).some(dayReadings => dayReadings.length > 0);
  }, [plan.readings]);

  const handleTemplateSelect = (template: ReadingPlanWithId) => {
    setSelectedTemplate(template);
    if (planHasReadings) {
      setShowConfirmDialog(true);
    } else {
      applyTemplate(template);
    }
  };

  const applyTemplate = (template: ReadingPlanWithId) => {
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
    let currentPlans = userPlans;
    try {
      const { data } = await api.get('/v1/bible-plans');
      currentPlans = data || [];
      setUserPlans(currentPlans);
    } catch {  }

    // Check for duplicate names
    const duplicate = currentPlans.find(p => p.name && p.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      setOverrideTargetId(duplicate.id);
      setShowNameConflictDialog(true);
      return;
    }
    
    try {
      // Determine if we should update an existing plan or create a new one
      // Only update if:
      // 1. We have a planId (indicating we're working with an existing plan)
      // 2. The plan still exists in the current plans list
      // 3. The original plan name matches the current plan name (no name change)
      const existingPlan = planId && currentPlans.find(p => p.id === planId);
      const shouldUpdate = existingPlan && existingPlan.name.trim().toLowerCase() === trimmedName.toLowerCase();
      
      let resp;
      if (shouldUpdate) {
        resp = await api.put(`/v1/bible-plans/${planId}`, { 
          name: trimmedName, 
          duration: plan.duration, 
          readings: plan.readings 
        });
      } else {
        // Create a new plan
        setPlanId(null);
        resp = await api.post('/v1/bible-plans', {
          name: trimmedName,
          duration: plan.duration,
          readings: plan.readings
        });
      }
      const data = resp.data;
      if (data?.id) setPlanId(data.id);
      setStatus({ type: 'success', title: shouldUpdate ? 'Updated' : 'Saved', message: `Reading plan ${shouldUpdate ? 'updated' : 'saved'} successfully.` });
    } catch (err) {
      console.error('Failed to save/update plan', err);
      setStatus({ type: 'error', title: 'Save failed', message: 'We could not save your plan. Please try again.' });
    }
  };

  const confirmOverride = async () => {
    if (!overrideTargetId) return;
    try {
      const trimmedName = (planName || '').trim();
      const resp = await api.put(`/v1/bible-plans/${overrideTargetId}`, { 
        name: trimmedName, 
        duration: plan.duration, 
        readings: plan.readings 
      });
      const data = resp.data;
      setPlanId(data.id);
      setPlan(prev => ({ ...prev, name: data.name }));
      setStatus({ type: 'success', title: 'Overridden', message: 'Existing plan overridden.' });

      try {
        const { data: refreshed } = await api.get('/v1/bible-plans');
        setUserPlans(refreshed || []);
      } catch {}
    } catch (e) {
      setStatus({ type: 'error', title: 'Override failed', message: 'Could not override existing plan.' });
    } finally {
      setShowNameConflictDialog(false);
      setOverrideTargetId(null);
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
                  key={template.id || template.name}
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

      <AlertDialog open={showNameConflictDialog} onOpenChange={setShowNameConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan Name Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a reading plan named "{planName}". Do you want to override it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowNameConflictDialog(false); setOverrideTargetId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverride} className="bg-red-600 hover:bg-red-700">Override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlanSidebar;
