export interface BiblePassage {
  id: string;
  book: string;
  chapter: number;
  endChapter?: number;
  startVerse?: number;
  endVerse?: number;
  reference: string;
}

export interface ReadingPlan {
  id: string;
  name: string;
  duration: number;
  template: string;
  readings: { [day: string]: BiblePassage[] };
}

export interface BibleBook {
  id: string;
  name: string;
  chapters: number;
  testament: 'Old' | 'New';
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament
  { id: 'genesis', name: 'Genesis', chapters: 50, testament: 'Old' },
  { id: 'exodus', name: 'Exodus', chapters: 40, testament: 'Old' },
  { id: 'leviticus', name: 'Leviticus', chapters: 27, testament: 'Old' },
  { id: 'numbers', name: 'Numbers', chapters: 36, testament: 'Old' },
  { id: 'deuteronomy', name: 'Deuteronomy', chapters: 34, testament: 'Old' },
  { id: 'joshua', name: 'Joshua', chapters: 24, testament: 'Old' },
  { id: 'judges', name: 'Judges', chapters: 21, testament: 'Old' },
  { id: 'ruth', name: 'Ruth', chapters: 4, testament: 'Old' },
  { id: '1samuel', name: '1 Samuel', chapters: 31, testament: 'Old' },
  { id: '2samuel', name: '2 Samuel', chapters: 24, testament: 'Old' },
  { id: '1kings', name: '1 Kings', chapters: 22, testament: 'Old' },
  { id: '2kings', name: '2 Kings', chapters: 25, testament: 'Old' },
  { id: '1chronicles', name: '1 Chronicles', chapters: 29, testament: 'Old' },
  { id: '2chronicles', name: '2 Chronicles', chapters: 36, testament: 'Old' },
  { id: 'ezra', name: 'Ezra', chapters: 10, testament: 'Old' },
  { id: 'nehemiah', name: 'Nehemiah', chapters: 13, testament: 'Old' },
  { id: 'esther', name: 'Esther', chapters: 10, testament: 'Old' },
  { id: 'job', name: 'Job', chapters: 42, testament: 'Old' },
  { id: 'psalms', name: 'Psalms', chapters: 150, testament: 'Old' },
  { id: 'proverbs', name: 'Proverbs', chapters: 31, testament: 'Old' },
  { id: 'ecclesiastes', name: 'Ecclesiastes', chapters: 12, testament: 'Old' },
  { id: 'songofsolomon', name: 'Song of Solomon', chapters: 8, testament: 'Old' },
  { id: 'isaiah', name: 'Isaiah', chapters: 66, testament: 'Old' },
  { id: 'jeremiah', name: 'Jeremiah', chapters: 52, testament: 'Old' },
  { id: 'lamentations', name: 'Lamentations', chapters: 5, testament: 'Old' },
  { id: 'ezekiel', name: 'Ezekiel', chapters: 48, testament: 'Old' },
  { id: 'daniel', name: 'Daniel', chapters: 12, testament: 'Old' },
  { id: 'hosea', name: 'Hosea', chapters: 14, testament: 'Old' },
  { id: 'joel', name: 'Joel', chapters: 3, testament: 'Old' },
  { id: 'amos', name: 'Amos', chapters: 9, testament: 'Old' },
  { id: 'obadiah', name: 'Obadiah', chapters: 1, testament: 'Old' },
  { id: 'jonah', name: 'Jonah', chapters: 4, testament: 'Old' },
  { id: 'micah', name: 'Micah', chapters: 7, testament: 'Old' },
  { id: 'nahum', name: 'Nahum', chapters: 3, testament: 'Old' },
  { id: 'habakkuk', name: 'Habakkuk', chapters: 3, testament: 'Old' },
  { id: 'zephaniah', name: 'Zephaniah', chapters: 3, testament: 'Old' },
  { id: 'haggai', name: 'Haggai', chapters: 2, testament: 'Old' },
  { id: 'zechariah', name: 'Zechariah', chapters: 14, testament: 'Old' },
  { id: 'malachi', name: 'Malachi', chapters: 4, testament: 'Old' },
  
  // New Testament
  { id: 'matthew', name: 'Matthew', chapters: 28, testament: 'New' },
  { id: 'mark', name: 'Mark', chapters: 16, testament: 'New' },
  { id: 'luke', name: 'Luke', chapters: 24, testament: 'New' },
  { id: 'john', name: 'John', chapters: 21, testament: 'New' },
  { id: 'acts', name: 'Acts', chapters: 28, testament: 'New' },
  { id: 'romans', name: 'Romans', chapters: 16, testament: 'New' },
  { id: '1corinthians', name: '1 Corinthians', chapters: 16, testament: 'New' },
  { id: '2corinthians', name: '2 Corinthians', chapters: 13, testament: 'New' },
  { id: 'galatians', name: 'Galatians', chapters: 6, testament: 'New' },
  { id: 'ephesians', name: 'Ephesians', chapters: 6, testament: 'New' },
  { id: 'philippians', name: 'Philippians', chapters: 4, testament: 'New' },
  { id: 'colossians', name: 'Colossians', chapters: 4, testament: 'New' },
  { id: '1thessalonians', name: '1 Thessalonians', chapters: 5, testament: 'New' },
  { id: '2thessalonians', name: '2 Thessalonians', chapters: 3, testament: 'New' },
  { id: '1timothy', name: '1 Timothy', chapters: 6, testament: 'New' },
  { id: '2timothy', name: '2 Timothy', chapters: 4, testament: 'New' },
  { id: 'titus', name: 'Titus', chapters: 3, testament: 'New' },
  { id: 'philemon', name: 'Philemon', chapters: 1, testament: 'New' },
  { id: 'hebrews', name: 'Hebrews', chapters: 13, testament: 'New' },
  { id: 'james', name: 'James', chapters: 5, testament: 'New' },
  { id: '1peter', name: '1 Peter', chapters: 5, testament: 'New' },
  { id: '2peter', name: '2 Peter', chapters: 3, testament: 'New' },
  { id: '1john', name: '1 John', chapters: 5, testament: 'New' },
  { id: '2john', name: '2 John', chapters: 1, testament: 'New' },
  { id: '3john', name: '3 John', chapters: 1, testament: 'New' },
  { id: 'jude', name: 'Jude', chapters: 1, testament: 'New' },
  { id: 'revelation', name: 'Revelation', chapters: 22, testament: 'New' }
];

export const READING_PLAN_TEMPLATES = [
  { id: 'chronological', name: 'Chronological', description: 'Read the Bible in chronological order' },
  { id: 'navigators', name: 'Navigators Bible Reading Plan', description: 'Popular systematic reading plan' },
  { id: 'canonical', name: 'Canonical (Straight Through)', description: 'Read from Genesis to Revelation' },
  { id: '90day-nt', name: '90-Day New Testament', description: 'Complete the New Testament in 90 days' },
];
