// USFM (Unified Standard Format Markers) parser for Bible text

import 'dart:convert';

import 'package:app/models/bible_reader/books.dart';

/// Result of parsing a USFM file containing verses and formatting metadata.
class UsfmParseResult {
  /// List of verse data: [{book, chapter, verse, text}]
  final List<Map<String, dynamic>> verses;

  /// Chapter runs (headings/sections): { chapter -> [ {type, text} ] }
  final Map<int, List<Map<String, String>>> runs;

  /// Verse block styles: { chapter -> { verse -> {type, level, break} } }
  final Map<int, Map<int, Map<String, dynamic>>> blocks;

  UsfmParseResult({
    required this.verses,
    required this.runs,
    required this.blocks,
  });
}

/// Parser for USFM (Unified Standard Format Markers) Bible text format.
///
/// Supports common USFM markers:
/// - \id - Book identification
/// - \c - Chapter marker
/// - \v - Verse marker
/// - \p, \m - Paragraph markers
/// - \q1, \q2 - Poetry/quote indentation
/// - \pi1, \pi2 - Paragraph indentation
/// - \b - Blank line
/// - \nb - No break
/// - \mt1, \mt2 - Main titles
/// - \s1, \s2 - Section headings
/// - \w...\w* - Word with Strong's numbers (stripped)
/// - \add...\add* - Added text (italics)
/// - \nd...\nd* - Divine name (small caps)
/// - \wj...\wj* - Words of Jesus (red letter)
/// - \f...\f* - Footnotes (stripped)
/// - \x...\x* - Cross references (stripped)
class UsfmParser {
  /// Parse USFM content for a specific book.
  ///
  /// [content] - Raw USFM text content
  /// [bookKey] - Three-letter book key (e.g., 'GEN', 'MAT')
  static UsfmParseResult parse(String content, String bookKey) {
    final verses = <Map<String, dynamic>>[];
    final runs = <int, List<Map<String, String>>>{};
    final blocks = <int, Map<int, Map<String, dynamic>>>{};

    int currentChapter = 0;
    int currentVerse = 0;

    // Block style state applied to next verses until changed
    String? blockType; // e.g., p, m, q, pi, b
    int blockLevel = 0;
    bool blockBreak = false; // insert spacing before verse

    String buffer = '';

    void flush() {
      final text = _cleanInlineMarkers(buffer.trim());
      if (currentChapter > 0 && currentVerse > 0 && text.isNotEmpty) {
        verses.add({
          'book': Books.instance.englishByKey(bookKey),
          'chapter': currentChapter,
          'verse': currentVerse,
          'text': text,
        });
        if (blockType != null) {
          final chMap = (blocks[currentChapter] ??= <int, Map<String, dynamic>>{});
          chMap[currentVerse] = {
            'type': blockType,
            'level': blockLevel,
            'break': blockBreak,
          };
        }
      }
      buffer = '';
      // After first verse, subsequent verses in same block shouldn't reinsert paragraph break
      blockBreak = false;
    }

    final lines = const LineSplitter().convert(content);
    for (final raw in lines) {
      final line = raw.trimRight();
      if (line.isEmpty) continue;

      // Chapter marker: \c N
      if (line.startsWith(r'\c ')) {
        flush();
        currentChapter =
            int.tryParse(line.substring(3).trim().split(' ').first) ?? currentChapter;
        currentVerse = 0;
        blockType = null;
        blockLevel = 0;
        blockBreak = false;
        continue;
      }

      // Main title: \mt1, \mt2, etc.
      final mt = RegExp(r'^\\mt(\d+)\s+(.*)').firstMatch(line);
      if (mt != null) {
        final text = _cleanInlineMarkers(mt.group(2) ?? '');
        final ch = currentChapter == 0 ? 1 : currentChapter; // Preface applies to ch1
        if (text.isNotEmpty) {
          (runs[ch] ??= <Map<String, String>>[]).add({
            'type': 'mt${mt.group(1)}',
            'text': text,
          });
        }
        continue;
      }

      // Section heading: \s, \s1, \s2, etc.
      final s = RegExp(r'^\\s(\d*)\s+(.*)').firstMatch(line);
      if (s != null) {
        final text = _cleanInlineMarkers(s.group(2) ?? '');
        final ty = 's${(s.group(1) ?? '1')}';
        final ch = currentChapter == 0 ? 1 : currentChapter;
        if (text.isNotEmpty) {
          (runs[ch] ??= <Map<String, String>>[]).add({
            'type': ty,
            'text': text,
          });
        }
        continue;
      }

      // Paragraph marker: \p
      if (RegExp(r'^\\p\b').hasMatch(line)) {
        blockType = 'p';
        blockLevel = 0;
        blockBreak = true;
        continue;
      }

      // Margin paragraph: \m
      if (RegExp(r'^\\m\b').hasMatch(line)) {
        blockType = 'm';
        blockLevel = 0;
        blockBreak = true;
        continue;
      }

      // Indented paragraph: \pi, \pi1, \pi2
      final mPi = RegExp(r'^\\pi(\d*)\b').firstMatch(line);
      if (mPi != null) {
        blockType = 'pi';
        blockLevel = int.tryParse(mPi.group(1) ?? '1') ?? 1;
        blockBreak = true;
        continue;
      }

      // Poetry/quote: \q, \q1, \q2
      final mQ = RegExp(r'^\\q(\d*)\b').firstMatch(line);
      if (mQ != null) {
        blockType = 'q';
        blockLevel = int.tryParse(mQ.group(1) ?? '1') ?? 1;
        blockBreak = true;
        continue;
      }

      // Blank line: \b
      if (RegExp(r'^\\b\b').hasMatch(line)) {
        blockType = 'b';
        blockLevel = 0;
        blockBreak = true;
        continue;
      }

      // No break: \nb
      if (RegExp(r'^\\nb\b').hasMatch(line)) {
        blockType = 'nb';
        blockLevel = 0;
        blockBreak = false;
        continue;
      }

      // Verse marker: \v N text...
      if (line.startsWith(r'\v ')) {
        flush();
        final rest = line.substring(3).trim();
        final parts = rest.split(RegExp(r'\s+'));
        final v = int.tryParse(parts.first) ?? 0;
        currentVerse = v;
        final text = rest.substring(parts.first.length).trim();
        buffer = text.isEmpty ? '' : '$text ';
        continue;
      }

      // Paragraph or poetry markers with inline text: \p text, \m text, \q1 text
      if (RegExp(r'^\\(p|m|q\d*)').hasMatch(line)) {
        final t = line.replaceFirst(RegExp(r'^\\\S+\s*'), '').trim();
        if (t.isNotEmpty) {
          buffer += '$t ';
        } else {
          buffer += ' ';
        }
        continue;
      }

      // Skip standalone title/section heading lines in verse context
      if (RegExp(r'^\\(mt\d+|s\d+)').hasMatch(line)) {
        continue;
      }

      // Default: append plain text
      buffer += '$line ';
    }
    flush();

    return UsfmParseResult(verses: verses, runs: runs, blocks: blocks);
  }

  /// Extract book key from USFM \id marker.
  /// Returns null if not found.
  static String? extractBookKey(String content) {
    for (final raw in const LineSplitter().convert(content)) {
      final line = raw.trim();
      if (line.isEmpty) continue;
      if (line.startsWith(r'\id ')) {
        final parts = line.substring(4).trim().split(RegExp(r'\s+'));
        if (parts.isNotEmpty) return parts.first.toUpperCase();
        break;
      }
      // Stop searching if we hit chapter or verse markers
      if (line.startsWith(r'\c ') || line.startsWith(r'\v ')) break;
    }
    return null;
  }

  /// Clean inline USFM markers from text, preserving styled spans.
  ///
  /// Converts emphasis markers to lightweight tags our renderer understands:
  /// - \add, \it → ⟦it⟧...⟦/it⟧ (italics)
  /// - \nd, \sc → ⟦sc⟧...⟦/sc⟧ (small caps)
  /// - \wj → ⟦wj⟧...⟦/wj⟧ (words of Jesus - red letter)
  /// - \bd → ⟦bd⟧...⟦/bd⟧ (bold)
  /// - \bdit → ⟦bdit⟧...⟦/bdit⟧ (bold italics)
  ///
  /// Strips:
  /// - \w word|strong\w* → word
  /// - \f...\f* footnotes
  /// - \x...\x* cross references
  ///
  /// Handles nested markers with \+ prefix (e.g., \+w, \+add, \+wj)
  static String _cleanInlineMarkers(String s) {
    // 1. Strip \w and \+w (word markers with Strong's numbers) FIRST
    // This must happen before processing \wj since \wj often contains nested \+w
    s = s.replaceAllMapped(
      RegExp(r'\\\+?w\s*([^|\\]*?)(?:\|[^\\]*)?\\\+?w\*'),
      (m) => m[1]?.trim() ?? '',
    );

    // 2. Convert emphasis tags to lightweight markers our renderer understands
    // Handle both \tag and \+tag variants, with optional whitespace after marker
    String wrap(String tag, String text) => '⟦$tag⟧$text⟦/$tag⟧';
    final tagMap = <String, String>{
      'add': 'it',
      'it': 'it',
      'bd': 'bd',
      'bdit': 'bdit',
      'wj': 'wj',
      'nd': 'sc',
      'sc': 'sc',
      'qt': 'it', // quote inline → italics
    };
    for (final e in tagMap.entries) {
      final src = e.key;
      final dst = e.value;
      // Match \tag or \+tag, optional space, content, then \tag* or \+tag*
      s = s.replaceAllMapped(
        RegExp('\\\\\\+?$src\\s*([\\s\\S]*?)\\\\\\+?$src\\*', dotAll: true),
        (m) => wrap(dst, m[1]?.trim() ?? ''),
      );
    }

    // 3. Remove any stray opening markers that did not have a closing tag
    // Handle both \tag and \+tag variants
    s = s.replaceAll(RegExp(r'\\\+?(add|nd|wj|it|bdit|bd|em|sc|qt)\s*'), '');

    // Remove footnotes and cross references entirely
    s = s.replaceAll(RegExp(r'\\f\s[\s\S]*?\\f\*', dotAll: true), '');
    s = s.replaceAll(RegExp(r'\\x\s[\s\S]*?\\x\*', dotAll: true), '');

    // 4. Remove any remaining closing markers (both \tag* and \+tag*)
    s = s.replaceAll(RegExp(r'\\\+?[a-zA-Z0-9]+\*'), '');

    // Remove pilcrow if present in text
    s = s.replaceAll('¶', '');

    // Normalize punctuation spacing: remove spaces before , . ; : ? !
    s = s.replaceAllMapped(RegExp(r'\s+([,.;:?!])'), (m) => m[1]!);
    // Ensure a space after punctuation if followed by a word
    s = s.replaceAllMapped(RegExp(r'([,.;:?!])(\S)'), (m) => '${m[1]} ${m[2]}');

    // Collapse whitespace
    s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
    return s;
  }
}
