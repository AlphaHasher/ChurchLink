import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../data/bible_repo_elisha.dart';
import 'bible_reader_body.dart' show HighlightColor;

/// Renders a whole chapter as a flowing paragraph.
/// Each verse is tappable and can show a highlight background.
class FlowingChapterText extends StatefulWidget {
  const FlowingChapterText({
    super.key,
    required this.verses,      // List<(VerseRef, String)>
    required this.highlights,  // Map<VerseRef, HighlightColor?>
    required this.onTapVerse,  // void Function((VerseRef, String))
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

class _FlowingChapterTextState extends State<FlowingChapterText> {
  // One recognizer per verse to avoid leaks.
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
    final base = (widget.baseStyle ??
            Theme.of(context).textTheme.bodyLarge ??
            const TextStyle(fontSize: 16))
        .copyWith(height: widget.lineHeight);

    final numberStyle = base.copyWith(
      fontSize: (base.fontSize ?? 16) * 0.70,
      color: Theme.of(context).colorScheme.secondary.withOpacity(.9),
    );

    // Build spans: [num][space][verse text][space] repeating…
    final spans = <InlineSpan>[];
    for (final v in widget.verses) {
      final ref = v.$1; // VerseRef
      final txt = v.$2; // String

      // Ensure a recognizer for this verse.
      final recognizer = _taps.putIfAbsent(ref, () => TapGestureRecognizer());
      recognizer.onTap = () => widget.onTapVerse(v);

      final highlight = widget.highlights[ref];

      // (a) verse number (small)
      spans.add(TextSpan(text: '${ref.verse} ', style: numberStyle));

      // (b) verse text (with optional highlight background)
      spans.add(TextSpan(
        text: txt.trim() + ' ',
        recognizer: recognizer,
        style: base.copyWith(
          backgroundColor: switch (highlight) {
            HighlightColor.yellow => Colors.yellow.withOpacity(.28),
            HighlightColor.green  => Colors.lightGreenAccent.withOpacity(.28),
            HighlightColor.blue   => Colors.lightBlueAccent.withOpacity(.28),
            HighlightColor.pink   => Colors.pinkAccent.withOpacity(.20),
            HighlightColor.purple => Colors.purpleAccent.withOpacity(.20),
            HighlightColor.teal   => Colors.tealAccent.withOpacity(.22),
            _ => null,
          },
        ),
      ));
    }

    return RichText(text: TextSpan(children: spans, style: base));
    // If you need selectable text later: use SelectableRegion with a RichText child.
  }
}
