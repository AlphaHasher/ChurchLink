import { useState } from 'react';
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

interface PlanCalendarProps { plan: ReadingPlan; selectedDay: number | null; onSelectDay: (day: number) => void; }

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

const CalendarDay = ({ dayNumber, passages, isSelected, onSelect }: { dayNumber: number; passages: BiblePassage[]; isSelected: boolean; onSelect: (day: number) => void }) => {
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
        min-h-[120px] p-2 rounded-lg transition-colors duration-200 cursor-pointer
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
        {isSelected && <span className="text-[10px] uppercase tracking-wide text-blue-600 font-semibold">Selected</span>}
      </div>
      
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
    </div>
  );
};

const PlanCalendar = ({ plan, selectedDay, onSelectDay }: PlanCalendarProps) => {
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
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {plan.duration}-Day Reading Plan
        </h2>
      </div>

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
