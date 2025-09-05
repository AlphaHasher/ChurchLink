import { useState } from 'react';
import { format, addDays, startOfToday } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { ReadingPlan, BiblePassage } from '../../../../shared/types/BiblePlan';
import { Button } from '../../../../shared/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface PlanCalendarProps {
  plan: ReadingPlan;
  setPlan: React.Dispatch<React.SetStateAction<ReadingPlan>>;
}

interface CalendarDayProps {
  date: Date;
  dayNumber: number;
  passages: BiblePassage[];
  onRemovePassage: (passageId: string) => void;
}

const CalendarDay = ({ date, dayNumber, passages, onRemovePassage }: CalendarDayProps) => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dateKey}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[120px] border border-gray-200 p-2 bg-white rounded-lg
        ${isOver ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}
        transition-colors duration-200
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-900">Day {dayNumber}</div>
        <div className="text-xs text-gray-500">{format(date, 'MMM d')}</div>
      </div>
      
      <div className="space-y-1">
        {passages.map((passage) => (
          <div
            key={passage.id}
            className="group flex items-center justify-between bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
          >
            <span className="truncate">{passage.reference}</span>
            <button
              onClick={() => onRemovePassage(passage.id)}
              className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
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

const PlanCalendar = ({ plan, setPlan }: PlanCalendarProps) => {
  const [startDate] = useState(startOfToday());
  const [currentPage, setCurrentPage] = useState(0);
  
  const daysPerPage = 28; // 4 weeks at a time
  const totalPages = Math.ceil(plan.duration / daysPerPage);

  const removePassageFromDay = (dateKey: string, passageId: string) => {
    setPlan(prev => ({
      ...prev,
      readings: {
        ...prev.readings,
        [dateKey]: (prev.readings[dateKey] || []).filter(p => p.id !== passageId)
      }
    }));
  };

  const getCurrentPageDays = () => {
    const startDay = currentPage * daysPerPage;
    const endDay = Math.min(startDay + daysPerPage, plan.duration);
    
    return Array.from({ length: endDay - startDay }, (_, i) => {
      const dayNumber = startDay + i + 1;
      const date = addDays(startDate, startDay + i);
      const dateKey = format(date, 'yyyy-MM-dd');
      const passages = plan.readings[dateKey] || [];
      
      return {
        date,
        dayNumber,
        dateKey,
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
          <p className="text-sm text-gray-600">
            Starting {format(startDate, 'MMMM d, yyyy')}
          </p>
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
            key={day.dateKey}
            date={day.date}
            dayNumber={day.dayNumber}
            passages={day.passages}
            onRemovePassage={(passageId) => removePassageFromDay(day.dateKey, passageId)}
          />
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
