import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core';
import { ReadingPlan, BiblePassage } from '@/shared/types/BiblePlan';
import React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/components/ui/pagination';
import PassageBadge from './PassageBadge';
import { Calendar } from '@/shared/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface PlanCalendarProps { 
  plan: ReadingPlan; 
  selectedDay: number | null; 
  onSelectDay: (day: number) => void; 
  className?: string;
}

const CalendarPassageChip = ({ passage, dayKey }: { passage: BiblePassage; dayKey: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal-${dayKey}-${passage.id}`,
    data: { type: 'passage', passage, sourceDayKey: dayKey },
  });

  const style = isDragging ? { opacity: 0 } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="min-w-0">
      <PassageBadge passage={passage} />
    </div>
  );
};

const CalendarDay = React.memo(({ dayNumber, passages, isSelected, onSelect, dateLabel }: { dayNumber: number; passages: BiblePassage[]; isSelected: boolean; onSelect: (day: number) => void; dateLabel?: string | null }) => {
  const dayKey = String(dayNumber);
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dayKey}`,
  });
  const { active } = useDndContext();
  const isPassageOver = isOver && (active?.data?.current as any)?.type === 'passage';

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(dayNumber)}
      className={`
        relative min-h-[120px] p-2 rounded-lg transition-colors duration-200 cursor-pointer
        min-w-[150px] max-w-full flex flex-col
        ${isPassageOver
          ? 'border-2 border-dashed border-green-400 bg-green-50'
          : isSelected
            ? 'border-2 border-blue-500 bg-blue-50'
            : 'border border-gray-200 bg-white hover:bg-gray-50'}
      `}
    >
      <div className="flex items-center mb-2">
        <div className="text-sm font-medium text-gray-900 flex-1">Day {dayNumber}</div>
      </div>
      {dateLabel && (
        <div className="absolute top-1 right-1 text-[10px] font-semibold text-gray-600 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
          {dateLabel}
        </div>
      )}
      
      <div className="flex flex-col gap-1 min-w-0">
        {passages.map((passage: BiblePassage) => (
          <CalendarPassageChip key={passage.id} passage={passage} dayKey={dayKey} />
        ))}
        
        {passages.length === 0 && (
          <div className="text-xs text-gray-400 italic text-center py-4">
            Drop passages here
          </div>
        )}
      </div>
      {isSelected && (
        <span className="pointer-events-none absolute bottom-1 right-1 text-[10px] uppercase tracking-wide text-blue-600 font-semibold">
          Selected
        </span>
      )}
    </div>
  );
}, (prev, next) => {
  // Re-render only if selection state, date label, day number, or passages list identity/length/ids change.
  if (prev.dayNumber !== next.dayNumber) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.dateLabel !== next.dateLabel) return false;
  if (prev.passages.length !== next.passages.length) return false;
  for (let i = 0; i < prev.passages.length; i++) {
    if (prev.passages[i].id !== next.passages[i].id) return false;
  }
  return true;
});

const PlanCalendar = ({ plan, selectedDay, onSelectDay, className }: PlanCalendarProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [showDayOverlay, setShowDayOverlay] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [baseDate, setBaseDate] = useState<Date | undefined>(new Date());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const calendarToggleRef = useRef<HTMLButtonElement | null>(null);

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

  const days = useMemo(() => getCurrentPageDays(), [currentPage, plan.duration, plan.readings]);

  const dateLabels = useMemo(() => {
    if (!showDayOverlay || !baseDate) return {} as Record<number, string>;
    const startTime = baseDate.getTime();
    const map: Record<number, string> = {};
    const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (const d of days) {
      const date = new Date(startTime + (d.dayNumber - 1) * 86400000);
      const dow = weekday[date.getDay()];
      const md = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map[d.dayNumber] = `${md}, ${dow}`; // e.g., Jan 5, Mon
    }
    return map;
  }, [showDayOverlay, baseDate, days]);

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

  // Close calendar picker on outside click or Escape
  useEffect(() => {
    if (!(showDayOverlay && showCalendarPicker)) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        overlayRef.current &&
        !overlayRef.current.contains(target) &&
        calendarToggleRef.current &&
        !calendarToggleRef.current.contains(target)
      ) {
        setShowCalendarPicker(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCalendarPicker(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [showDayOverlay, showCalendarPicker]);

  return (
    <div className={cn('relative', className)}>
      <div className="mb-4 flex items-start justify-between gap-4 px-1">
        <h2 className="text-lg font-semibold text-gray-900">
          {plan.duration}-Day Reading Plan
        </h2>
        <div className="flex items-center gap-2">
          <Button variant={showDayOverlay ? 'secondary' : 'outline'} size="sm" onClick={() => {
            setShowDayOverlay(o => !o);
          }}>
            {showDayOverlay ? 'Hide Day Overlay' : 'Show Day Overlay'}
          </Button>
          {showDayOverlay && (
            <Button ref={calendarToggleRef} variant={showCalendarPicker ? 'default' : 'outline'} size="sm" onClick={() => {
              setShowCalendarPicker(p => !p);
            }} aria-label="Select Start Date">
              <CalendarIcon className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {showDayOverlay && showCalendarPicker && (
        <div ref={overlayRef} className="absolute z-20 top-16 right-4">
          <Calendar
            mode="single"
            selected={baseDate}
            onSelect={(d) => { if (d) setBaseDate(d); }}
            captionLayout="dropdown"
            className="rounded-md border shadow-sm"
          />
        </div>
      )}

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))'
        }}
      >
        {days.map((day) => (
          <CalendarDay
            key={day.dayNumber}
            dayNumber={day.dayNumber}
            passages={day.passages}
            isSelected={selectedDay === day.dayNumber}
            onSelect={onSelectDay}
            dateLabel={dateLabels[day.dayNumber]}
          />
        ))}
      </div>
      
      {plan.duration > daysPerPage && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Pagination className="w-full">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={(e: any) => { e.preventDefault(); prevPage(); }}
                  href="#"
                  className={currentPage === 0 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {(() => {
                const items: React.ReactNode[] = [];
                const maxNumbersToShow = 5; // center window size
                let start = Math.max(0, currentPage - 2);
                let end = Math.min(totalPages - 1, start + maxNumbersToShow - 1);
                if (end - start < maxNumbersToShow - 1) {
                  start = Math.max(0, end - (maxNumbersToShow - 1));
                }
                // Always show first page link
                if (start > 0) {
                  items.push(
                    <PaginationItem key={0}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === 0}
                        onClick={(e: any) => { e.preventDefault(); setCurrentPage(0); }}
                      >1</PaginationLink>
                    </PaginationItem>
                  );
                  if (start > 1) {
                    items.push(
                      <PaginationItem key="start-ellipsis">
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                }
                for (let p = start; p <= end; p++) {
                  items.push(
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === currentPage}
                        onClick={(e: any) => { e.preventDefault(); setCurrentPage(p); }}
                      >{p + 1}</PaginationLink>
                    </PaginationItem>
                  );
                }
                if (end < totalPages - 1) {
                  if (end < totalPages - 2) {
                    items.push(
                      <PaginationItem key="end-ellipsis">
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  items.push(
                    <PaginationItem key={totalPages - 1}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === totalPages - 1}
                        onClick={(e: any) => { e.preventDefault(); setCurrentPage(totalPages - 1); }}
                      >{totalPages}</PaginationLink>
                    </PaginationItem>
                  );
                }
                return items;
              })()}
              <PaginationItem>
                <PaginationNext
                  onClick={(e: any) => { e.preventDefault(); nextPage(); }}
                  href="#"
                  className={currentPage === totalPages - 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <div className="text-xs text-gray-500">
            Showing days {currentPage * daysPerPage + 1}-{Math.min((currentPage + 1) * daysPerPage, plan.duration)} of {plan.duration}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanCalendar;
