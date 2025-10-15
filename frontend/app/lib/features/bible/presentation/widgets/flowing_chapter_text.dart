// -----------------------------------------------------------------------------
// Reformats all of the verses in the bible into a continuous flowing
// text with verse numbers. Each verse can be tapped, and tapping will
// bring up a highlighting and notetaking popup menu.
// -----------------------------------------------------------------------------

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:app/features/bible/data/bible_repo_elisha.dart';
import 'package:app/features/bible/domain/highlight.dart'; // for HighlightColor

/// The following elements are stored in this class:
/// - verses: Pairs of VerseRef (verse ID) + verse text
/// - highlights: Places colored highlight on a corresponding VerseRef
/// - onTapVerse: Executes callback when a verse is tapped
/// - baseStyle: Optionally defines the text's appearance using the TextStyle format
/// - lineHeight: Adjust vertical spacing between lines
/// - horizontalPadding: Extra left/right padding inside the paragraph
/// - runs: Optional heading/section runs (e.g., mt1, s1) to render above text
class FlowingChapterText extends StatefulWidget {
  const FlowingChapterText({
    super.key,
    required this.verses,
    required this.highlights,
    required this.onTapVerse,
    this.baseStyle,
    this.lineHeight = 1.6,
    this.horizontalPadding = 16,
    this.runs,
    this.verseBlocks,
    this.verseKeys,
  });

  final List<(VerseRef, String)> verses;
  final Map<VerseRef, HighlightColor?> highlights;
  final void Function((VerseRef, String) verse) onTapVerse;
  final TextStyle? baseStyle;
  final double lineHeight;
  final double horizontalPadding;
  final List<Map<String, String>>? runs; // {type,text}
  final Map<int, Map<String, dynamic>>? verseBlocks; // verse -> {type,level,break}
  final Map<VerseRef, GlobalKey>? verseKeys; // Optional: for scroll-to-verse

  @override
  State<FlowingChapterText> createState() => _FlowingChapterTextState();
}

/// Displays the whole chapter as flowing paragraph text.
class _FlowingChapterTextState extends State<FlowingChapterText> {
  // Places one tap recognizer per each verse.
  final Map<VerseRef, TapGestureRecognizer> _taps = {};

  @override
  void dispose() {
    for (final r in _taps.values) {
      r.dispose();
    }
    _taps.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    
    // Base style (caller’s style > theme > default), with consistent line height.
    final base = (widget.baseStyle ??
            theme.textTheme.bodyLarge ??
            const TextStyle(fontSize: 16))
        .copyWith(
          height: widget.lineHeight,
          color: (widget.baseStyle?.color ?? theme.textTheme.bodyLarge?.color) ?? cs.onSurface,
        );

    final numberStyle = base.copyWith(
      fontSize: (base.fontSize ?? 16) * 0.70,
      color: cs.onSurface.withOpacity(0.60),
    );

    final headingStyle = base.copyWith(
      color: cs.onSurface,
      fontSize: (base.fontSize ?? 16) * 1.4,
      fontWeight: FontWeight.w700,
    );

    // Build a single rich paragraph: [num][space][verse text][space]...
    final spans = <InlineSpan>[];

    // Prepend headings/runs if provided
    if (widget.runs != null && widget.runs!.isNotEmpty) {
      for (final r in widget.runs!) {
        final text = (r['text'] ?? '').trim();
        if (text.isEmpty) continue;
        spans.add(TextSpan(text: '$text\n', style: headingStyle));
      }
      spans.add(const TextSpan(text: '\n'));
    }

    for (final v in widget.verses) {
      final ref = v.$1; // VerseRef
      final txt = v.$2; // String

      // Apply per-verse block: spacing and indent
      final vb = widget.verseBlocks?[ref.verse];
      if (vb != null && (vb['break'] == true)) {
        spans.add(const TextSpan(text: '\n\n'));
      }
      double indent = 0;
      if (vb != null) {
        final type = (vb['type'] as String?) ?? '';
        final level = (vb['level'] as int?) ?? 1;
        if (type == 'q' || type == 'pi') {
          indent = 16.0 * level;
        } else if (type == 'm') {
          indent = 12.0;
        }
      }

      // Ensure a recognizer for this verse.
      final recognizer = _taps.putIfAbsent(ref, () => TapGestureRecognizer());
      recognizer.onTap = () => widget.onTapVerse(v);

      final highlight = widget.highlights[ref];

      // Verse number (never highlighted)
      final leading = '${ref.verse} ';
      InlineSpan verseSpan = TextSpan(
        children: [
          if (indent > 0)
            WidgetSpan(child: SizedBox(width: indent)),
          TextSpan(text: leading, style: numberStyle),
          ..._buildInlineSpans(
            txt.trim(),
            base,
            cs,
            recognizer,
            switch (highlight) {
              HighlightColor.yellow => Colors.yellow.withValues(alpha: .28),
              HighlightColor.green  => Colors.lightGreenAccent.withValues(alpha: .28),
              HighlightColor.blue   => Colors.lightBlueAccent.withValues(alpha: .28),
              HighlightColor.red    => Colors.redAccent.withValues(alpha: .20),
              HighlightColor.purple => Colors.purpleAccent.withValues(alpha: .20),
              _ => null,
            },
          ),
          const TextSpan(text: ' '),
        ],
      );
      // If a key is provided for this verse, wrap in WidgetSpan with a Container and key
      if (widget.verseKeys != null && widget.verseKeys![ref] != null) {
        verseSpan = WidgetSpan(
          child: Container(
            key: widget.verseKeys![ref],
            child: RichText(text: TextSpan(children: [verseSpan], style: base)),
          ),
        );
      }
      spans.add(verseSpan);
    }

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.horizontalPadding),
      child: RichText(text: TextSpan(children: spans, style: base)),
    );
    // If you need selectable text later: use SelectableRegion with a RichText child.
  }
}

extension on _FlowingChapterTextState {
  List<InlineSpan> _buildInlineSpans(
    String text,
    TextStyle base,
    ColorScheme cs,
    GestureRecognizer recognizer,
    Color? bg,
  ) {
    // Split by our marker ⟦tag⟧...⟦/tag⟧
    final spans = <InlineSpan>[];
    TextStyle current = base.copyWith(backgroundColor: bg);
    final regex = RegExp(r'⟦(/?)(it|bd|bdit|sc|wj)⟧');
    int idx = 0;
    final matches = regex.allMatches(text).toList();
    final stack = <String>[];
    void pushStyle(String tag) {
      stack.add(tag);
      current = _applyTagStyle(base, cs, bg, stack);
    }
    void popStyle(String tag) {
      if (stack.isNotEmpty && stack.last == tag) {
        stack.removeLast();
        current = _applyTagStyle(base, cs, bg, stack);
      }
    }

    for (final m in matches) {
      if (m.start > idx) {
        spans.add(TextSpan(text: text.substring(idx, m.start), style: current, recognizer: recognizer));
      }
      final isClose = (m.group(1) ?? '').isNotEmpty;
      final tag = m.group(2)!;
      if (isClose) {
        popStyle(tag);
      } else {
        pushStyle(tag);
      }
      idx = m.end;
    }
    if (idx < text.length) {
      spans.add(TextSpan(text: text.substring(idx), style: current, recognizer: recognizer));
    }
    return spans;
  }

  TextStyle _applyTagStyle(TextStyle base, ColorScheme cs, Color? bg, List<String> stack) {
    TextStyle s = base.copyWith(backgroundColor: bg);
    bool ital = false, bold = false, smallCaps = false, red = false;
    for (final t in stack) {
      if (t == 'it') ital = true;
      if (t == 'bd') bold = true;
      if (t == 'bdit') { ital = true; bold = true; }
      if (t == 'sc') smallCaps = true;
      if (t == 'wj') red = true;
    }
    if (bold) s = s.copyWith(fontWeight: FontWeight.w600);
    if (ital) s = s.copyWith(fontStyle: FontStyle.italic);
    if (smallCaps) s = s.copyWith(letterSpacing: 0.5, fontFeatures: const [FontFeature.enable('smcp')]);
    if (red) s = s.copyWith(color: cs.error);
    return s;
  }
}
