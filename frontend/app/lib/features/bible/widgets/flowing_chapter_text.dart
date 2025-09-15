// -----------------------------------------------------------------------------
// Reformats all of the verses in the bible into a continuous flowing
// text with verse numbers. Each verse can be tapped, and tapping will
// bring up a highlighting and notetaking popup menu.
// -----------------------------------------------------------------------------

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../data/bible_repo_elisha.dart';
import 'bible_reader_body.dart' show HighlightColor;

/// The following elements are stored in this class:
/// - verses: Pairs of VerseRef (verse ID) + verse text
/// - highlights: Places colored highlight on a corresponding VerseRef
/// - onTapVerse: Executes callback when a verse is tapped
/// - baseStyle: Optionally defines the text's appearance using the TextStyle format
/// - lineHeight: Adjust vertical spacing between lines
class FlowingChapterText extends StatefulWidget {
  const FlowingChapterText({
    super.key,
    required this.verses,
    required this.highlights,
    required this.onTapVerse,
    this.baseStyle,
    this.lineHeight = 1.6,
  });

  final List<(VerseRef, String)> verses;
  final Map<VerseRef, HighlightColor?> highlights;
  final void Function((VerseRef, String) verse) onTapVerse;
  final TextStyle? baseStyle;
  final double lineHeight;

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
    // Base style (caller’s style > theme > default), with consistent line height.
    final base = (widget.baseStyle ??
            Theme.of(context).textTheme.bodyLarge ??
            const TextStyle(fontSize: 16))
        .copyWith(height: widget.lineHeight);

    final numberStyle = base.copyWith(
      fontSize: (base.fontSize ?? 16) * 0.70,
      color: Theme.of(context).colorScheme.secondary.withOpacity(.9),
    );

    // Build a single rich paragraph: [num][space][verse text][space]...
    final spans = <InlineSpan>[];
    for (final v in widget.verses) {
      final ref = v.$1; // VerseRef
      final txt = v.$2; // String

      // Ensure a recognizer for this verse.
      final recognizer = _taps.putIfAbsent(ref, () => TapGestureRecognizer());
      recognizer.onTap = () => widget.onTapVerse(v);

      final highlight = widget.highlights[ref];

      // Verse number (never highlighted)
      spans.add(TextSpan(text: '${ref.verse} ', style: numberStyle));

      // ---- IMPORTANT FIX ----
      // Put ONLY the verse glyphs in the highlighted span,
      // and add the trailing space as its own unhighlighted span.
      spans.add(TextSpan(
        text: txt.trim(),
        recognizer: recognizer,
        style: base.copyWith(
          backgroundColor: switch (highlight) {
            HighlightColor.yellow => Colors.yellow.withOpacity(.28),
            HighlightColor.green  => Colors.lightGreenAccent.withOpacity(.28),
            HighlightColor.blue   => Colors.lightBlueAccent.withOpacity(.28),
            HighlightColor.red    => Colors.redAccent.withOpacity(.20),
            HighlightColor.purple => Colors.purpleAccent.withOpacity(.20),
            _ => null,
          },
        ),
      ));
      // Unhighlighted spacer between verses keeps the paragraph flowing and
      // prevents “bleed” into the next verse number on the same line.
      spans.add(const TextSpan(text: ' '));
    }

    return RichText(text: TextSpan(children: spans, style: base));
    // If you need selectable text later: use SelectableRegion with a RichText child.
  }
}
