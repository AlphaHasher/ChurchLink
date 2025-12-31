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
import { Download, Upload, Save, ChevronDown, RefreshCw } from 'lucide-react';

interface PlanSidebarProps {
  plan: ReadingPlan;
  setPlan: React.Dispatch<React.SetStateAction<ReadingPlan>>;
  selectedDay?: number | null;
  onCreatePassageForDay?: (day: number, passage: BiblePassage) => void;
  initialPlanId?: string | null;
}

type ReadingPlanWithId = ReadingPlan & { id: string };

// Module-level caches
let templatesCache: ReadingPlanWithId[] | null = null;
let templatesInFlight: Promise<ReadingPlanWithId[]> | null = null;

const PlanSidebar = ({ plan, setPlan, selectedDay, onCreatePassageForDay, initialPlanId }: PlanSidebarProps) => {
  const [planName, setPlanName] = useState(plan.name);
  const [planId, setPlanId] = useState<string | null>(initialPlanId || null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | 'warning' | null; title?: string; message?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ReadingPlanWithId[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ plan: ReadingPlanWithId; type: 'template' | 'userPlan' } | null>(null);
  const [showNameConflictDialog, setShowNameConflictDialog] = useState(false);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);

  useEffect(() => {
    setPlanName(plan.name);
  }, [plan.name]);

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

  // Function to refresh templates (clears cache and refetches)
  const refreshTemplates = async () => {
    templatesCache = null; // Clear the cache
    setLoadingTemplates(true);
    try {
      const response = await api.get('/v1/bible-plans/templates');
      const freshTemplates = response.data as ReadingPlanWithId[] || [];
      templatesCache = freshTemplates; // Update cache
      setTemplates(freshTemplates);
      setStatus({
        type: 'success',
        title: 'Templates Refreshed',
        message: 'Bible plan templates have been reloaded.'
      });
    } catch (error) {
      console.error('Failed to refresh templates:', error);
      setStatus({
        type: 'error',
        title: 'Failed to refresh templates',
        message: 'Could not reload Bible plan templates. Please try again.'
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load templates using cache/in-flight promise
  useEffect(() => {
    let cancelled = false;
    if (templatesCache) {
      setTemplates(templatesCache);
      return; // Already have data
    }
    setLoadingTemplates(true);
    if (!templatesInFlight) {
      templatesInFlight = api.get('/v1/bible-plans/templates')
        .then(r => r.data as ReadingPlanWithId[])
        .then(data => {
          const templates = data || [];
          templatesCache = templates; // Cache the fetched templates
          return templates;
        })
        .finally(() => {
          templatesInFlight = null;
        });
    }
    templatesInFlight
      .then(data => { if (!cancelled) setTemplates(data || []); })
      .catch(error => {
        if (!cancelled) {
          console.error('Failed to load templates:', error);
          setStatus({
            type: 'error',
            title: 'Failed to load templates',
            message: 'Could not load Bible plan templates. Please try again.'
          });
        }
      })
      .finally(() => { if (!cancelled) setLoadingTemplates(false); });
    return () => { cancelled = true; };
  }, []);


  // Check if plan has any readings
  const planHasReadings = useMemo(() => {
    return Object.values(plan.readings).some(dayReadings => dayReadings.length > 0);
  }, [plan.readings]);

  // Unified plan selection handler
  const handlePlanSelect = (planToSelect: ReadingPlanWithId, type: 'template' | 'userPlan') => {
    setSelectedPlan({ plan: planToSelect, type });
    if (planHasReadings) {
      setShowConfirmDialog(true);
    } else {
      applyPlan(planToSelect, type);
    }
  };

  // Unified plan application
  const applyPlan = (planToApply: ReadingPlanWithId, type: 'template' | 'userPlan') => {
    setPlan(prev => ({
      ...prev,
      name: planToApply.name,
      duration: planToApply.duration,
      readings: planToApply.readings,
    }));

    setPlanName(planToApply.name);

    if (type === 'userPlan') {
      setPlanId(planToApply.id);
    } else {
      setPlanId(null);
    }

    setShowConfirmDialog(false);
    setSelectedPlan(null);

    const actionName = type === 'template' ? 'Template Applied' : 'Plan Loaded';
    const itemType = type === 'template' ? 'template' : 'plan';

    setStatus({
      type: 'success',
      title: actionName,
      message: `Successfully ${type === 'template' ? 'applied' : 'loaded'} "${planToApply.name}" ${itemType}.`
    });
  };


  const renderPlanDropdown = (
    label: string,
    plans: ReadingPlanWithId[],
    type: 'template' | 'userPlan',
    isLoading = false,
    emptyMessage = 'No items available',
    onRefresh?: () => void
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-6 w-6 p-0"
            title="Refresh templates"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={isLoading || plans.length === 0}
          >
            {isLoading ? 'Loading...' : plans.length === 0 ? emptyMessage : `Choose a ${type === 'template' ? 'template' : 'saved plan'}`}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full">
          {plans.map((planItem) => (
            <DropdownMenuItem
              key={planItem.id || planItem.name}
              onClick={() => handlePlanSelect(planItem, type)}
              className="flex justify-between items-start p-3"
            >
              <div className="flex flex-col">
                <div className="font-medium">{planItem.name}</div>
                <div className="text-xs text-muted-foreground">{planItem.duration} days</div>
              </div>
            </DropdownMenuItem>
          ))}
          {plans.length === 0 && !isLoading && (
            <DropdownMenuItem disabled>{emptyMessage}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const handleSavePlan = async () => {
    const trimmedName = (planName || '').trim();
    const hasAnyPassages = Object.values(plan.readings).some((d: BiblePassage[]) => (d || []).length > 0);
    if (!trimmedName) {
      setStatus({ type: 'warning', title: 'Name required', message: 'Please enter a plan name before saving.' });
      return;
    }
    if (!hasAnyPassages) {
      setStatus({ type: 'warning', title: 'No passages', message: 'Add at least one passage to save this plan.' });
      return;
    }
    let currentPlans: ReadingPlanWithId[] = [];
    try {
      const { data } = await api.get('/v1/bible-plans/');
      currentPlans = data || [];
    } catch {
      // Silently fail - proceed with empty plans list if API call fails
    }

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
        resp = await api.put(`/v1/bible-plans/by-id/${planId}`, {
          name: trimmedName,
          duration: plan.duration,
          readings: plan.readings
        });
      } else {
        // Create a new plan
        setPlanId(null);
        resp = await api.post('/v1/bible-plans/', {
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
      const resp = await api.put(`/v1/bible-plans/by-id/${overrideTargetId}`, {
        name: trimmedName,
        duration: plan.duration,
        readings: plan.readings
      });
      const data = resp.data;
      setPlanId(data.id);
      setPlan(prev => ({ ...prev, name: data.name }));
      setStatus({ type: 'success', title: 'Overridden', message: 'Existing plan overridden.' });

    } catch {
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
      const data = JSON.parse(text) as unknown;
      if (data && typeof data === 'object' && data !== null && 'duration' in data && 'readings' in data) {
        setPlan(data as ReadingPlan);
        setPlanName('name' in data && typeof data.name === 'string' ? data.name : '');
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
    <div className="w-80 h-full bg-card flex flex-col shrink-0 rounded-lg border border-border">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
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
        {renderPlanDropdown(
          'Bible Plan Templates',
          templates,
          'template',
          loadingTemplates,
          'No templates available',
          refreshTemplates
        )}

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
          <Alert variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'warning' ? 'warning' : 'info'} className="mt-2">
            <AlertTitle>{status.title}</AlertTitle>
            {status.message && <AlertDescription>{status.message}</AlertDescription>}
          </Alert>
        )}
      </div>

      {/* Action Buttons - Sticky at Bottom */}
      <div className="border-t border-border bg-card p-6 space-y-3 flex-shrink-0">
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
              You already have readings in your current plan. Applying {selectedPlan ? `the ${selectedPlan.type === 'template' ? 'template' : 'plan'} "${selectedPlan.plan.name}"` : 'this selection'}
              will replace all existing readings and settings. This action cannot be undone.
              <br /><br />
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConfirmDialog(false);
              setSelectedPlan(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedPlan) {
                  applyPlan(selectedPlan.plan, selectedPlan.type);
                }
              }}
              variant="destructive"
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
            <AlertDialogAction onClick={confirmOverride} variant="destructive">Override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default PlanSidebar;
