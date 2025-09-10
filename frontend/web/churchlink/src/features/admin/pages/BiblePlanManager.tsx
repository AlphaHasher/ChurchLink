import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import PlanSidebar from '../components/BiblePlanManager/PlanSidebar';
import PlanCalendar from '../components/BiblePlanManager/PlanCalendar';
import PassageBadge from '../components/BiblePlanManager/PassageBadge';
import { BiblePassage, ReadingPlan } from '@/shared/types/BiblePlan';

const BiblePlanManager = () => {
  const [plan, setPlan] = useState<ReadingPlan>({
    id: '',
    name: '',
    duration: 30,
    template: '',
    readings: {}
  });
  
  const [activePassage, setActivePassage] = useState<BiblePassage | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
  const data = active.data.current as unknown as BiblePassage | { passage: BiblePassage; sourceDayKey?: string };
    const passage = (data as any)?.passage ? (data as any).passage as BiblePassage : (data as BiblePassage);
    setActivePassage(passage);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
  const data = active.data?.current as unknown as BiblePassage | { passage: BiblePassage; sourceDayKey?: string } | undefined;

    if (!over || !data) {
      setActivePassage(null);
      return;
    }

  const overId = over.id as string;
  const isFromCalendar = (data as any)?.passage !== undefined;
    const passage = isFromCalendar ? (data as any).passage as BiblePassage : (data as BiblePassage);
  const sourceDayKey: string | undefined = isFromCalendar ? (data as any).sourceDayKey : undefined;

    if (overId === 'trash-zone') {
      if (sourceDayKey) {
        // Remove from the calendar day
        setPlan(prev => ({
          ...prev,
          readings: {
            ...prev.readings,
            [sourceDayKey]: (prev.readings[sourceDayKey] || []).filter(p => p.id !== passage.id),
          },
        }));
      }
    } else if (overId.startsWith('day-')) {
      const targetDay = overId.replace('day-', '');
      if (sourceDayKey) {
        // Move between days if different
        if (sourceDayKey !== targetDay) {
          setPlan(prev => {
            const source = (prev.readings[sourceDayKey] || []).filter(p => p.id !== passage.id);
            const target = [...(prev.readings[targetDay] || []), passage];
            return {
              ...prev,
              readings: {
                ...prev.readings,
                [sourceDayKey]: source,
                [targetDay]: target,
              },
            };
          });
        }
      }
    }

    setActivePassage(null);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Sidebar */}
        <PlanSidebar 
          plan={plan} 
          setPlan={setPlan}
          selectedDay={selectedDay}
          onCreatePassageForDay={(day, passage) => {
            setPlan(prev => ({
              ...prev,
              readings: {
                ...prev.readings,
                [String(day)]: [...(prev.readings[String(day)] || []), passage]
              }
            }));
          }}
        />
        
        {/* Main Content Area */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Bible Plan Manager</h1>
            <p className="text-gray-600 mt-2">Create and manage Bible reading plans for your congregation</p>
          </div>
          
          <PlanCalendar 
            plan={plan} 
            selectedDay={selectedDay}
            onSelectDay={(d) => setSelectedDay(d)}
          />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activePassage ? <PassageBadge passage={activePassage} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default BiblePlanManager;
