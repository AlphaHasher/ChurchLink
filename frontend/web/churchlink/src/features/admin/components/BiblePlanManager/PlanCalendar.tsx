import { useState } from 'react';
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core';
import { ReadingPlan, BiblePassage } from '../../../../shared/types/BiblePlan';
import { Button } from '../../../../shared/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PlanCalendarProps { plan: ReadingPlan }

interface CalendarDayProps { dayNumber: number; passages: BiblePassage[] }

const CalendarPassageChip = ({ passage, dayKey }: { passage: BiblePassage; dayKey: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
  id: `cal-${dayKey}-${passage.id}`,
  data: { type: 'passage', passage, sourceDayKey: dayKey },
  });

  const style = isDragging ? { opacity: 0 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium cursor-grab hover:bg-blue-200 transition-colors whitespace-nowrap"
    >
      <span className="truncate">{passage.reference}</span>
    </div>
  );
};

const CalendarDay = ({ dayNumber, passages }: CalendarDayProps) => {
  const dayKey = String(dayNumber);
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dayKey}`,
  });
  const { active } = useDndContext();
  const isPassageOver = isOver && (active?.data?.current as any)?.type === 'passage';

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[120px] p-2 rounded-lg transition-colors duration-200
        ${isPassageOver
          ? 'border-2 border-dashed border-green-400 bg-green-50'
          : 'border border-gray-200 bg-white hover:bg-gray-50'}
      `}
    >
      <div className="flex items-center mb-2">
        <div className="text-sm font-medium text-gray-900">Day {dayNumber}</div>
      </div>
      
      <div className="flex flex-col gap-1">
        {passages.map((passage) => (
          <CalendarPassageChip key={passage.id} passage={passage} dayKey={dayKey} />
        ))}
        
        {passages.length === 0 && (
          <div className="text-xs text-gray-400 italic text-center py-4">
            Drop passages here
          </div>
        )}
      </div>
    </div>
  );
};

const PlanCalendar = ({ plan }: PlanCalendarProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const daysPerPage = 31;
  const totalPages = Math.ceil(plan.duration / daysPerPage);

  const getCurrentPageDays = () => {
    const startDay = currentPage * daysPerPage;
    const endDay = Math.min(startDay + daysPerPage, plan.duration);
    
    return Array.from({ length: endDay - startDay }, (_, i) => {
      const dayNumber = startDay + i + 1;
      const dayKey = String(dayNumber);
      const passages = plan.readings[dayKey] || [];
      
      return {
        dayNumber,
        passages
      };
    });
  };

  const days = getCurrentPageDays();

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {plan.duration}-Day Reading Plan
          </h2>
  </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-gray-600 px-3">
            Page {currentPage + 1} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

  <div className="grid grid-cols-4 gap-3 lg:grid-cols-7">
        {days.map((day) => (
          <CalendarDay
              key={day.dayNumber}
              dayNumber={day.dayNumber}
              passages={day.passages} />
        ))}
      </div>
      
      {plan.duration > daysPerPage && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Showing days {currentPage * daysPerPage + 1} - {Math.min((currentPage + 1) * daysPerPage, plan.duration)} of {plan.duration}
        </div>
      )}
    </div>
  );
};

export default PlanCalendar;
