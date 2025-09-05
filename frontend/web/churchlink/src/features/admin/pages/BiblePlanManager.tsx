import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import PlanSidebar from '../components/BiblePlanManager/PlanSidebar';
import PlanCalendar from '../components/BiblePlanManager/PlanCalendar';
import { BiblePassage, ReadingPlan } from '../../../shared/types/BiblePlan';

const BiblePlanManager = () => {
  const [plan, setPlan] = useState<ReadingPlan>({
    id: '',
    name: '',
    duration: 30,
    template: '',
    readings: {}
  });
  
  const [activePassage, setActivePassage] = useState<BiblePassage | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const passage = active.data.current as BiblePassage;
    setActivePassage(passage);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActivePassage(null);
      return;
    }

    const passage = active.data.current as BiblePassage;
    const dayKey = over.id as string;

    if (dayKey.startsWith('day-')) {
      const date = dayKey.replace('day-', '');
      setPlan(prev => ({
        ...prev,
        readings: {
          ...prev.readings,
          [date]: [...(prev.readings[date] || []), passage]
        }
      }));
    }

    setActivePassage(null);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Sidebar */}
        <PlanSidebar plan={plan} setPlan={setPlan} />
        
        {/* Main Content Area */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Bible Plan Manager</h1>
            <p className="text-gray-600 mt-2">Create and manage Bible reading plans for your congregation</p>
          </div>
          
          <PlanCalendar plan={plan} setPlan={setPlan} />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activePassage ? (
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium shadow-lg border border-blue-200">
              {activePassage.reference}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default BiblePlanManager;
