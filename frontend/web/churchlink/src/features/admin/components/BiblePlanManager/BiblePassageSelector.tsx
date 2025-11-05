import { useState, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BIBLE_BOOKS, BibleBook, BiblePassage } from '@/shared/types/BiblePlan';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useDroppable } from '@dnd-kit/core';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';
import { cn } from '@/lib/utils';

interface BiblePassageSelectorProps {
  selectedDay?: number | null;           // Day currently selected in the calendar
  onCreatePassage?: (passage: BiblePassage) => void; // Notify parent to add passage directly to that day
}

const TrashDropZone = () => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'trash-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[50px] items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-sm transition-colors duration-200',
        isOver
          ? 'border-destructive/60 bg-destructive/10 text-destructive'
          : 'border-border/70 bg-muted text-muted-foreground hover:border-muted-foreground/60'
      )}
    >
      <Trash2
        className={cn(
          'h-4 w-4 transition-colors',
          isOver ? 'text-destructive' : 'text-muted-foreground'
        )}
      />
      <span>Drop here to remove</span>
    </div>
  );
};

const BiblePassageSelector = ({ selectedDay, onCreatePassage }: BiblePassageSelectorProps) => {

  const [selectedChapter, setSelectedChapter] = useState<{ book: BibleBook; chapter: number } | null>(null);
  const [verseRange, setVerseRange] = useState({ start: '', end: '' });
  const [selectedChaptersSet, setSelectedChaptersSet] = useState<Set<string>>(new Set());

  const oldTestamentBooks = BIBLE_BOOKS.filter(book => book.testament === 'Old');
  const newTestamentBooks = BIBLE_BOOKS.filter(book => book.testament === 'New');


  const keyFor = (bookId: string, chapter: number) => `${bookId}-${chapter}`;
  const isChapterSelected = (bookId: string, chapter: number) => selectedChaptersSet.has(keyFor(bookId, chapter));
  const toggleChapterSelected = (bookId: string, chapter: number) => {
    setSelectedChaptersSet(prev => {
      const next = new Set(prev);
      const k = keyFor(bookId, chapter);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const clearSelectedChapters = () => {
    setSelectedChaptersSet(new Set());
    setSelectedChapter(null);
    setVerseRange({ start: '', end: '' });
  };

  // Returns structure for contiguous ranges per book
  const groupSelectedChaptersByBook = () => {
    const chaptersByBook = new Map<string, number[]>();
    selectedChaptersSet.forEach(k => {
      const [bookId, chapterStr] = k.split('-');
      const chapter = parseInt(chapterStr, 10);
      if (Number.isNaN(chapter)) return;
      const arr = chaptersByBook.get(bookId) ?? [];
      arr.push(chapter);
      chaptersByBook.set(bookId, arr);
    });
    const result: { book: BibleBook; ranges: { start: number; end: number }[] }[] = [];
    chaptersByBook.forEach((chapters, bookId) => {
      const book = BIBLE_BOOKS.find(b => b.id === bookId);
      if (!book) return;
      chapters.sort((a, b) => a - b);
      let start = chapters[0];
      let prev = chapters[0];
      const ranges: { start: number; end: number }[] = [];
      for (let i = 1; i <= chapters.length; i++) {
        const curr = chapters[i];
        if (curr !== prev + 1) {
          ranges.push({ start, end: prev });
          start = curr;
        }
        prev = curr;
      }
      result.push({ book, ranges });
    });
    return result;
  };

  // Determine if user has selected a multi-chapter contiguous range within a single book for verse-level selection
  const multiChapterSelectionMeta = (() => {
    if (selectedChaptersSet.size === 0) return null;
    const grouped = groupSelectedChaptersByBook();
    if (grouped.length !== 1) return null; // must be single book
    const { book, ranges } = grouped[0];
    if (ranges.length !== 1) return null; // must be single contiguous range
    const range = ranges[0];
    // If also a specific chapter is clicked, ensure it resides in range; keep single-chapter reference UI else
    if (range.start === range.end && !selectedChapter) {
      // treat as single-chapter selection
      return { type: 'single', book, range } as const;
    }
    return { type: 'multi', book, range } as const;
  })();

  const computeVerseContext = () => {
    const meta = multiChapterSelectionMeta;
    const useMulti = !!(meta && meta.type === 'multi' && meta.range.start !== meta.range.end);
    const sTxt = verseRange.start.trim();
    const eTxt = verseRange.end.trim();
    const hasStart = sTxt !== '';
    const hasEnd = eTxt !== '';
    let startNum: number | undefined;
    let endNum: number | undefined;
    if (hasStart) {
      startNum = parseInt(sTxt, 10);
    }
    if (hasEnd) {
      endNum = parseInt(eTxt, 10);
    }
    // Validation
    const invalid = (
      (hasStart && (Number.isNaN(startNum as number) || (startNum as number) < 1)) ||
      (hasEnd && (Number.isNaN(endNum as number) || (endNum as number) < 1)) ||
      (!useMulti && hasStart && hasEnd && (startNum as number) >= (endNum as number))
    );
    return { useMulti, hasStart, hasEnd, startNum, endNum, invalid };
  };

  const addWholeChapter = (book: BibleBook, chapter: number) => {
    if (!selectedDay) return; // Must have a day selected
    const passage: BiblePassage = {
      id: `${book.id}-${chapter}-${Date.now()}`,
      book: book.name,
      chapter,
      reference: `${book.name} ${chapter}`
    };
    onCreatePassage?.(passage);
  };

  const isInvalidVerseRange = computeVerseContext().invalid;

  const addVerseRange = () => {
    if (!selectedDay) return;
    const meta = multiChapterSelectionMeta;
    if (!selectedChapter && !meta) return;
    const { useMulti, hasStart, hasEnd, startNum, endNum, invalid } = computeVerseContext();
    const book = useMulti ? meta!.book : (selectedChapter?.book || meta?.book as BibleBook);
    const baseChapter = useMulti ? meta!.range.start : (selectedChapter?.chapter || meta?.range.start || 1);
    const endChapter = useMulti ? meta!.range.end : undefined;
    if (invalid) return;

    // Build reference with new formatting rules
    let reference: string;
    if (useMulti) {
      if (!hasStart && !hasEnd) reference = `${book.name} ${baseChapter}-${endChapter}`;
      else if (hasStart && !hasEnd) reference = `${book.name} ${baseChapter}:${startNum}-${endChapter}`;
      else if (!hasStart && hasEnd) reference = `${book.name} ${baseChapter}-${endChapter}:${endNum}`;
      else reference = `${book.name} ${baseChapter}:${startNum}-${endChapter}:${endNum}`;
    } else { // single chapter
      if (!hasStart && !hasEnd) reference = `${book.name} ${baseChapter}`;
      else if (hasStart && !hasEnd) reference = `${book.name} ${baseChapter}:${startNum}`;
      else if (!hasStart && hasEnd) reference = `${book.name} ${baseChapter}:${endNum}`;
      else reference = startNum === endNum
        ? `${book.name} ${baseChapter}:${startNum}`
        : `${book.name} ${baseChapter}:${startNum}-${endNum}`;
    }

    const passage: BiblePassage = {
      id: `${book.id}-${baseChapter}-${endChapter ?? baseChapter}-${(hasStart ? startNum : 'x') as any}-${(hasEnd ? endNum : 'x') as any}-${Date.now()}`,
      book: book.name,
      chapter: baseChapter,
      endChapter,
      startVerse: hasStart ? startNum : undefined,
      endVerse: hasEnd ? (hasStart ? endNum : endNum) : (hasStart ? startNum : undefined),
      reference
    };
    onCreatePassage?.(passage);
    setVerseRange({ start: '', end: '' });
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Render a list of books and their chapters
  const renderBooks = (books: BibleBook[]) => (
    <Accordion type="multiple" className="w-full">
      {books.map((book) => (
        <AccordionItem key={book.id} value={book.id}>
          <AccordionTrigger className="px-2 py-2 text-sm transition-colors hover:bg-muted/60">
            {book.name}
          </AccordionTrigger>
          <AccordionContent className="pl-2">
            {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => (
              <div key={chapter} className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => {
                      const currentlySelected = isChapterSelected(book.id, chapter);
                      if (currentlySelected) {
                        toggleChapterSelected(book.id, chapter);
                        if (selectedChapter?.book.id === book.id && selectedChapter.chapter === chapter) {
                          setSelectedChapter(null);
                          setVerseRange({ start: '', end: '' });
                        }
                      } else {
                        toggleChapterSelected(book.id, chapter);
                        setSelectedChapter({ book, chapter });
                      }
                    }}
                    className={cn(
                      'relative flex-1 rounded p-1 text-left transition-colors hover:bg-muted',
                      isChapterSelected(book.id, chapter) && 'bg-primary/10 text-primary'
                    )}
                    aria-pressed={isChapterSelected(book.id, chapter)}
                    aria-label={`Chapter ${chapter}`}
                  >
                    <span
                      className={cn(
                        'absolute left-1 top-1 h-2 w-2 rounded-full border transition-colors',
                        isChapterSelected(book.id, chapter)
                          ? 'border-transparent bg-primary'
                          : 'border-border/70 bg-transparent'
                      )}
                    />
                    <span className="ml-3">Chapter {chapter}</span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addWholeChapter(book, chapter)}
                    disabled={!selectedDay}
                    className="mr-1 h-6 w-6 p-0 text-muted-foreground"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

  return (
    <div ref={containerRef} className="space-y-4">

      <TrashDropZone />

      {/* Bible Book Selector */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-card pr-3" style={{ scrollbarGutter: 'stable' }}>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="old">
            <AccordionTrigger className="px-3 py-3 font-medium transition-colors hover:bg-muted/60">Old Testament</AccordionTrigger>
            <AccordionContent className="pl-2 pb-2">
              {renderBooks(oldTestamentBooks)}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="new">
            <AccordionTrigger className="px-3 py-3 font-medium transition-colors hover:bg-muted/60">New Testament</AccordionTrigger>
            <AccordionContent className="pl-2 pb-2">
              {renderBooks(newTestamentBooks)}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Chapter & Verse Selection */}
      {(selectedChapter || selectedChaptersSet.size > 0) && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <div className="mb-2">
            <div className="w-full text-sm font-medium text-foreground">
              {(() => {
                if (multiChapterSelectionMeta && multiChapterSelectionMeta.type === 'multi') {
                  const { book, range } = multiChapterSelectionMeta;
                  const s = verseRange.start.trim();
                  const e = verseRange.end.trim();
                  const hasS = s !== '';
                  const hasE = e !== '';
                  let preview: string;
                  // If the range covers only a single chapter (start === end) show it as a single chapter
                  if (range.start === range.end) {
                    const chap = range.start;
                    if (!hasS && !hasE) preview = `${chap}`;
                    else if (hasS && !hasE) preview = `${chap}:${s}`;
                    else if (!hasS && hasE) preview = `${chap}:${e}`;
                    else preview = hasS && hasE && s === e ? `${chap}:${s}` : `${chap}:${s}-${e}`;
                  } else {
                    if (!hasS && !hasE) preview = `${range.start}-${range.end}`;
                    else if (hasS && !hasE) preview = `${range.start}:${s}-${range.end}`;
                    else if (!hasS && hasE) preview = `${range.start}-${range.end}:${e}`;
                    else preview = `${range.start}:${s}-${range.end}:${e}`;
                  }
                  return <span className="block w-full">Select Verse Range From:<br /> {book.name} {preview}</span>;
                }
                if (selectedChapter) {
                  const s = verseRange.start.trim();
                  const e = verseRange.end.trim();
                  let preview = `${selectedChapter.chapter}`;
                  if (s && !e) preview = `${selectedChapter.chapter}:${s}`;
                  else if (!s && e) preview = `${selectedChapter.chapter}:${e}`;
                  else if (s && e) preview = s === e ? `${selectedChapter.chapter}:${s}` : `${selectedChapter.chapter}:${s}-${e}`;
                  return <span className="block w-full">Select Verses from <br /> {selectedChapter.book.name} {preview}</span>;
                }
                return <span className="block w-full">Chapter Selection</span>;
              })()}
            </div>
          </div>
          {(!!selectedChapter || selectedChaptersSet.size > 0) && !selectedDay && (
            <div className="text-xs text-destructive">Select a day to add passages.</div>
          )}
          {/* Warning for non-contiguous multi-book or multi-range selection */}
          {selectedChaptersSet.size > 0 && !multiChapterSelectionMeta && (
            <div className="rounded border border-border bg-muted/60 p-2 text-xs text-foreground">
              Select a single contiguous range within one book to enable verse-level range across chapters.
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Start Verse"
                value={verseRange.start}
                onChange={(e) => setVerseRange(prev => ({ ...prev, start: e.target.value }))}
                className="h-8 w-28 text-sm"
                disabled={(!selectedChapter && !multiChapterSelectionMeta) || !selectedDay || (selectedChaptersSet.size > 0 && !multiChapterSelectionMeta)}
              />
              <Input
                placeholder="End Verse"
                value={verseRange.end}
                onChange={(e) => setVerseRange(prev => ({ ...prev, end: e.target.value }))}
                className="h-8 w-28 text-sm"
                disabled={(!selectedChapter && !multiChapterSelectionMeta) || !selectedDay || (selectedChaptersSet.size > 0 && !multiChapterSelectionMeta)}
              />
            </div>
            <Button
              size="sm"
              onClick={addVerseRange}
              disabled={!selectedDay || isInvalidVerseRange || (!selectedChapter && !multiChapterSelectionMeta) || (selectedChaptersSet.size > 0 && !multiChapterSelectionMeta)}
              className="h-8 text-xs"
            >
              Add
            </Button>
          </div>
          {isInvalidVerseRange && (verseRange.start || verseRange.end) && (
            <div className="text-xs text-destructive">Verses must be at least 1 and end greater than start (only enforced within a single chapter).</div>
          )}
          <div className="text-xs text-muted-foreground">
            Leave verse inputs blank to include entire chapter(s). For multi-chapter contiguous selections you can specify verses spanning start of first to end of last chapter.
          </div>
          {selectedChaptersSet.size > 0 && (
            <div className="pt-2">
              <Button size="sm" variant="ghost" onClick={clearSelectedChapters} className="text-xs">
                Clear Chapters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BiblePassageSelector;
