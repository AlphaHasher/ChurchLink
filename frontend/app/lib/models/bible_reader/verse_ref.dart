// Verse reference model for Bible reader

/// Represents a reference to a specific verse in the Bible.
/// Stores book, chapter, verse as properties.
/// "book" is stored as a canonical English name (e.g., 'John').
class VerseRef {
  final String book; // canonical name
  final int chapter;
  final int verse;

  const VerseRef(this.book, this.chapter, this.verse);

  @override
  bool operator ==(Object other) =>
      other is VerseRef &&
      other.book == book &&
      other.chapter == chapter &&
      other.verse == verse;

  @override
  int get hashCode => Object.hash(book, chapter, verse);

  @override
  String toString() => '$book $chapter:$verse';
}
