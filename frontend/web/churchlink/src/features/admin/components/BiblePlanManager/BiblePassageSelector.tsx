import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { BIBLE_BOOKS, BibleBook, BiblePassage } from '../../../../shared/types/BiblePlan';
import { Button } from '../../../../shared/components/ui/button';
import { Input } from '../../../../shared/components/ui/input';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface BiblePassageSelectorProps {
  onPassageAdd?: (passage: BiblePassage) => void;
  onRegisterRemoveCallback?: (callback: (passageId: string) => void) => void;
}

interface PassageChipProps {
  passage: BiblePassage;
}

const PassageChip = ({ passage }: PassageChipProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: passage.id,
    data: passage,
  });

  // When using a DragOverlay, hide the original while dragging to avoid duplicate render
  const style = isDragging ? { opacity: 0 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium cursor-grab whitespace-nowrap
        hover:bg-blue-200 transition-colors ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <span>{passage.reference}</span>
    </div>
  );
};

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

const BiblePassageSelector = ({ onPassageAdd, onRegisterRemoveCallback }: BiblePassageSelectorProps) => {
  const [expandedTestament, setExpandedTestament] = useState<'Old' | 'New' | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<{ book: BibleBook; chapter: number } | null>(null);
  const [selectedPassages, setSelectedPassages] = useState<BiblePassage[]>([]);
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

  const addSelectedChapters = () => {
    if (selectedChaptersSet.size === 0) return;
    // Group by book, collect chapters, sort, and merge contiguous sequences
    const chaptersByBook = new Map<string, number[]>();
    selectedChaptersSet.forEach((k) => {
      const [bookId, chapterStr] = k.split('-');
      const chapter = parseInt(chapterStr, 10);
      if (Number.isNaN(chapter)) return;
      const arr = chaptersByBook.get(bookId) ?? [];
      arr.push(chapter);
      chaptersByBook.set(bookId, arr);
    });

    const toAdd: BiblePassage[] = [];
    const now = Date.now();

    chaptersByBook.forEach((chapters, bookId) => {
      const book = BIBLE_BOOKS.find((b) => b.id === bookId);
      if (!book) return;
      chapters.sort((a, b) => a - b);
      let start = chapters[0];
      let prev = chapters[0];
      for (let i = 1; i <= chapters.length; i++) {
        const curr = chapters[i];
        if (curr !== prev + 1) {
          // finalize range [start..prev]
          const id = `${book.id}-${start}-${prev}-${now}-${Math.random().toString(36).slice(2, 8)}`;
          const reference = start === prev ? `${book.name} ${start}` : `${book.name} ${start}-${prev}`;
          toAdd.push({ id, book: book.name, chapter: start, reference });
          start = curr;
        }
        prev = curr;
      }
    });

    if (toAdd.length === 0) return;
    setSelectedPassages((prev) => [...prev, ...toAdd]);
    toAdd.forEach((p) => onPassageAdd?.(p));
    clearSelectedChapters();
  };

  const addWholeChapter = (book: BibleBook, chapter: number) => {
    const passage: BiblePassage = {
      id: `${book.id}-${chapter}-${Date.now()}`,
      book: book.name,
      chapter,
      reference: `${book.name} ${chapter}`
    };
    
    setSelectedPassages(prev => [...prev, passage]);
    onPassageAdd?.(passage);
  };

  const addVerseRange = () => {
    if (!selectedChapter || !verseRange.start) return;
    
    const { book, chapter } = selectedChapter;
    const reference = verseRange.end 
      ? `${book.name} ${chapter}:${verseRange.start}-${verseRange.end}`
      : `${book.name} ${chapter}:${verseRange.start}`;
    
    const passage: BiblePassage = {
      id: `${book.id}-${chapter}-${verseRange.start}-${verseRange.end || verseRange.start}-${Date.now()}`,
      book: book.name,
      chapter,
      startVerse: parseInt(verseRange.start),
      endVerse: verseRange.end ? parseInt(verseRange.end) : parseInt(verseRange.start),
      reference
    };
    
    setSelectedPassages(prev => [...prev, passage]);
    onPassageAdd?.(passage);
    setVerseRange({ start: '', end: '' });
  };

  const removePassage = useCallback((passageId: string) => {
    setSelectedPassages(prev => prev.filter(p => p.id !== passageId));
  }, []);

  // Register the remove callback with the parent
  useEffect(() => {
    onRegisterRemoveCallback?.(removePassage);
  }, [onRegisterRemoveCallback, removePassage]);

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
      {/* Selected Passages */}
      {selectedPassages.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Selected Passages (Drag to Calendar)</div>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg min-h-[60px]">
            {selectedPassages.map((passage) => (
              <PassageChip 
                key={passage.id} 
                passage={passage}
              />
            ))}
          </div>
        </div>
      )}
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
                    <div className="pl-4 space-y-1">
                      {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => (
                        <div key={chapter} className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="checkbox"
                              checked={isChapterSelected(book.id, chapter)}
                              onChange={() => toggleChapterSelected(book.id, chapter)}
                              className="h-3 w-3 accent-blue-600"
                              aria-label={`Select chapter ${chapter}`}
                            />
                            <button
                              onClick={() => selectChapter(book, chapter)}
                              className={`flex-1 text-left p-1 hover:bg-gray-100 rounded ${
                                selectedChapter?.book.id === book.id && selectedChapter?.chapter === chapter 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : ''
                              }`}
                            >
                              Chapter {chapter}
                            </button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addWholeChapter(book, chapter)}
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
                    <div className="pl-4 space-y-1">
                      {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => (
                        <div key={chapter} className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="checkbox"
                              checked={isChapterSelected(book.id, chapter)}
                              onChange={() => toggleChapterSelected(book.id, chapter)}
                              className="h-3 w-3 accent-blue-600"
                              aria-label={`Select chapter ${chapter}`}
                            />
                            <button
                              onClick={() => selectChapter(book, chapter)}
                              className={`flex-1 text-left p-1 hover:bg-gray-100 rounded ${
                                selectedChapter?.book.id === book.id && selectedChapter?.chapter === chapter 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : ''
                              }`}
                            >
                              Chapter {chapter}
                            </button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addWholeChapter(book, chapter)}
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

      {/* Selected chapters bulk actions */}
      {selectedChaptersSet.size > 0 && (
        <div className="sticky bottom-0 z-10 p-2 bg-blue-50 border border-blue-200 rounded">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-blue-800">{selectedChaptersSet.size} chapter(s) selected</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={addSelectedChapters} className="h-7 whitespace-nowrap text-xs">
                Add Selected Chapters
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelectedChapters} className="h-7 whitespace-nowrap text-xs">
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Verse Selector */}
      {selectedChapter && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="text-sm font-medium text-gray-700 mb-3">
            Select Verses from {selectedChapter.book.name} {selectedChapter.chapter}
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
              placeholder="Start"
              value={verseRange.start}
              onChange={(e) => setVerseRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-24 h-8 text-sm"
              />
              <Input
              placeholder="End"
              value={verseRange.end}
              onChange={(e) => setVerseRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-24 h-8 text-sm"
              />
              <Button
              size="sm"
              onClick={addVerseRange}
              disabled={!verseRange.start}
              className="w-24 h-8"
              >
              Add Verses
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              Leave end verse empty to select a single verse, or enter both to select a range.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BiblePassageSelector;
