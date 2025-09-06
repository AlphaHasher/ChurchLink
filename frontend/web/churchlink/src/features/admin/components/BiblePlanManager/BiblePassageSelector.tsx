import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { BIBLE_BOOKS, BibleBook, BiblePassage } from '../../../../shared/types/BiblePlan';
import { Button } from '../../../../shared/components/ui/button';
import { Input } from '../../../../shared/components/ui/input';
import { useDroppable } from '@dnd-kit/core';

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
      className={`
        flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg text-sm
        transition-colors duration-200 min-h-[50px]
        ${isOver 
          ? 'border-red-400 bg-red-50 text-red-700' 
          : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400'
        }
      `}
    >
      <Trash2 className={`w-4 h-4 ${isOver ? 'text-red-600' : 'text-gray-400'}`} />
      <span>Drop here to remove</span>
    </div>
  );
};

const BiblePassageSelector = ({ selectedDay, onCreatePassage }: BiblePassageSelectorProps) => {
  const [expandedTestament, setExpandedTestament] = useState<'Old' | 'New' | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<{ book: BibleBook; chapter: number } | null>(null);
  const [verseRange, setVerseRange] = useState({ start: '', end: '' });
  const [selectedChaptersSet, setSelectedChaptersSet] = useState<Set<string>>(new Set());

  const oldTestamentBooks = BIBLE_BOOKS.filter(book => book.testament === 'Old');
  const newTestamentBooks = BIBLE_BOOKS.filter(book => book.testament === 'New');

  const toggleTestament = (testament: 'Old' | 'New') => {
    setExpandedTestament(expandedTestament === testament ? null : testament);
    setExpandedBook(null);
    setSelectedChapter(null);
  };

  const toggleBook = (bookId: string) => {
    setExpandedBook(expandedBook === bookId ? null : bookId);
    setSelectedChapter(null);
  };

  const selectChapter = (book: BibleBook, chapter: number) => {
    setSelectedChapter({ book, chapter });
    setVerseRange({ start: '', end: '' });
  };

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

  const clearSelectedChapters = () => setSelectedChaptersSet(new Set());

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
      chapters.sort((a,b)=> a-b);
      let start = chapters[0];
      let prev = chapters[0];
      const ranges: { start: number; end: number }[] = [];
      for (let i=1;i<=chapters.length;i++) {
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

  let isInvalidVerseRange = false;

  const addVerseRange = () => {
    if (!selectedDay) return;
    const meta = multiChapterSelectionMeta;
    if (!selectedChapter && !meta) return;
    const useMulti = !!(meta && meta.type === 'multi' && meta.range.start !== meta.range.end);
    const book = useMulti ? meta!.book : (selectedChapter?.book as BibleBook);
    const baseChapter = useMulti ? meta!.range.start : (selectedChapter?.chapter || 1);
    const endChapter = useMulti ? meta!.range.end : undefined;

    const startTxt = verseRange.start.trim();
    const endTxt = verseRange.end.trim();
    const hasStart = startTxt !== '';
    const hasEnd = endTxt !== '';
    let startVerseNum: number | undefined = undefined;
    let endVerseNum: number | undefined = undefined;
    if (hasStart) {
      startVerseNum = parseInt(startTxt, 10);
      if (Number.isNaN(startVerseNum) || startVerseNum < 1) return;
    }
    if (hasEnd) {
      endVerseNum = parseInt(endTxt, 10);
      if (Number.isNaN(endVerseNum) || endVerseNum < 1) return;
    }
    // Only enforce ordering if both verses are in SAME chapter context
    if (!useMulti && hasStart && hasEnd && startVerseNum! >= endVerseNum!) return;
    if (isInvalidVerseRange) return;

    // Build reference with new formatting rules
    let reference: string;
    if (useMulti) {
      if (!hasStart && !hasEnd) reference = `${book.name} ${baseChapter}-${endChapter}`;
      else if (hasStart && !hasEnd) reference = `${book.name} ${baseChapter}:${startVerseNum}-${endChapter}`;
      else if (!hasStart && hasEnd) reference = `${book.name} ${baseChapter}-${endChapter}:${endVerseNum}`;
      else reference = `${book.name} ${baseChapter}:${startVerseNum}-${endChapter}:${endVerseNum}`;
    } else { // single chapter
      if (!hasStart && !hasEnd) reference = `${book.name} ${baseChapter}`;
      else if (hasStart && !hasEnd) reference = `${book.name} ${baseChapter}:${startVerseNum}`;
      else if (!hasStart && hasEnd) reference = `${book.name} ${baseChapter}:${endVerseNum}`;
      else reference = startVerseNum === endVerseNum
        ? `${book.name} ${baseChapter}:${startVerseNum}`
        : `${book.name} ${baseChapter}:${startVerseNum}-${endVerseNum}`;
    }

    const passage: BiblePassage = {
      id: `${book.id}-${baseChapter}-${endChapter ?? baseChapter}-${startVerseNum ?? 'x'}-${endVerseNum ?? 'x'}-${Date.now()}`,
      book: book.name,
      chapter: baseChapter,
      endChapter,
      startVerse: hasStart ? startVerseNum : undefined,
      endVerse: hasEnd ? (hasStart ? endVerseNum : endVerseNum) : (hasStart ? startVerseNum : undefined),
      reference
    };
    onCreatePassage?.(passage);
    setVerseRange({ start: '', end: '' });
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Hide verse selector when clicking outside this component
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (selectedChapter) {
          setSelectedChapter(null);
          setVerseRange({ start: '', end: '' });
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedChapter]);

  return (
    <div ref={containerRef} className="space-y-4">

      <TrashDropZone />

  {/* Bible Book Selector */}
  <div className="border rounded-lg max-h-64 overflow-y-auto">
        {/* Old Testament */}
        <div className="border-b">
          <button
            onClick={() => toggleTestament('Old')}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
          >
            <span className="font-medium">Old Testament</span>
            {expandedTestament === 'Old' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {expandedTestament === 'Old' && (
            <div className="pl-4 pb-2">
              {oldTestamentBooks.map((book) => (
                <div key={book.id}>
                  <button
                    onClick={() => toggleBook(book.id)}
                    className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 text-sm"
                  >
                    <span>{book.name}</span>
                    {expandedBook === book.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  
                  {expandedBook === book.id && (
                    <div className="pl-4">
                      {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => (
                        <div key={chapter} className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <button
                              onClick={() => { toggleChapterSelected(book.id, chapter); selectChapter(book, chapter); }}
                              className={`relative flex-1 text-left p-1 hover:bg-gray-100 rounded ${
                                isChapterSelected(book.id, chapter) ? 'bg-blue-100 text-blue-800' : ''
                              }`}
                              aria-pressed={isChapterSelected(book.id, chapter)}
                              aria-label={`Chapter ${chapter}`}
                            >
                              {/* selection indicator */}
                              <span className={`absolute left-1 top-1 w-2 h-2 rounded-full transition-colors ${isChapterSelected(book.id, chapter) ? 'bg-blue-600' : 'bg-transparent border border-gray-200'}`} />
                              <span className="ml-4">Chapter {chapter}</span>
                            </button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addWholeChapter(book, chapter)}
                            disabled={!selectedDay}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Testament */}
        <div>
          <button
            onClick={() => toggleTestament('New')}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
          >
            <span className="font-medium">New Testament</span>
            {expandedTestament === 'New' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          {expandedTestament === 'New' && (
            <div className="pl-4 pb-2">
              {newTestamentBooks.map((book) => (
                <div key={book.id}>
                  <button
                    onClick={() => toggleBook(book.id)}
                    className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 text-sm"
                  >
                    <span>{book.name}</span>
                    {expandedBook === book.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  
                  {expandedBook === book.id && (
                    <div className="pl-4">
                      {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => (
                        <div key={chapter} className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <button
                              onClick={() => { toggleChapterSelected(book.id, chapter); selectChapter(book, chapter); }}
                              className={`relative flex-1 text-left p-1 hover:bg-gray-100 rounded ${
                                isChapterSelected(book.id, chapter) ? 'bg-blue-100 text-blue-800' : ''
                              }`}
                              aria-pressed={isChapterSelected(book.id, chapter)}
                              aria-label={`Chapter ${chapter}`}
                            >
                              <span className={`absolute left-1 top-1 w-2 h-2 rounded-full transition-colors ${isChapterSelected(book.id, chapter) ? 'bg-blue-600' : 'bg-transparent border border-gray-200'}`} />
                              <span className="ml-4">Chapter {chapter}</span>
                            </button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addWholeChapter(book, chapter)}
                            disabled={!selectedDay}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chapter & Verse Selection */}
      {(selectedChapter || selectedChaptersSet.size > 0) && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-3">
          <div className="mb-2">
            <div className="text-sm font-medium text-gray-700 w-full">
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
          {multiChapterSelectionMeta && multiChapterSelectionMeta.type === 'multi' && !selectedDay && (
            <div className="text-xs text-red-600">Select a day to add passages.</div>
          )}
          {/* Warning for non-contiguous multi-book or multi-range selection */}
          {selectedChaptersSet.size > 0 && !multiChapterSelectionMeta && !selectedChapter && (
            <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
              Select a single contiguous range within one book to enable verse-level range across chapters.
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Start Verse"
                value={verseRange.start}
                onChange={(e) => setVerseRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-28 h-8 text-sm"
                disabled={(!selectedChapter && !(multiChapterSelectionMeta && multiChapterSelectionMeta.type === 'multi')) || !selectedDay}
              />
              <Input
                placeholder="End Verse"
                value={verseRange.end}
                onChange={(e) => setVerseRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-28 h-8 text-sm"
                disabled={(!selectedChapter && !(multiChapterSelectionMeta && multiChapterSelectionMeta.type === 'multi')) || !selectedDay}
              />
            </div>
            <Button
              size="sm"
              onClick={addVerseRange}
              disabled={!selectedDay || isInvalidVerseRange || (!selectedChapter && !multiChapterSelectionMeta)}
              className="h-8 text-xs"
            >
              Add
            </Button>
          </div>
          {isInvalidVerseRange && (verseRange.start || verseRange.end) && (
            <div className="text-xs text-red-600">Verses must be at least 1 and end greater than start (only enforced within a single chapter).</div>
          )}
          <div className="text-xs text-gray-500">
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
