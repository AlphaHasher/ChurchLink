import 'package:flutter/material.dart';

class ReaderTopBar extends StatelessWidget {
  const ReaderTopBar({
    super.key,
    required this.displayLabel,
    required this.translation,
    required this.translations,
    required this.isAtFirstChapter,
    required this.isAtLastChapter,
    required this.onPrevChapter,
    required this.onNextChapter,
    required this.onOpenJumpPicker,
    required this.onSelectTranslation,
  });

  final String displayLabel;
  final String translation;
  final List<String> translations;

  final bool isAtFirstChapter;
  final bool isAtLastChapter;

  final VoidCallback? onPrevChapter;
  final VoidCallback? onNextChapter;
  final VoidCallback onOpenJumpPicker;
  final ValueChanged<String> onSelectTranslation;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final onSurface70 = cs.onSurface.withValues(alpha: 0.70);
    final onSurface35 = cs.onSurface.withValues(alpha: 0.35);

    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Previous chapter',
            onPressed: isAtFirstChapter ? null : onPrevChapter,
            icon: Icon(
              Icons.chevron_left,
              color: isAtFirstChapter ? onSurface35 : onSurface70,
            ),
          ),

          // Jump button: "Gen 1"
          Expanded(
            flex: 6,
            child: SizedBox(
              height: 36,
              child: TextButton(
                onPressed: onOpenJumpPicker,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  backgroundColor: cs.surfaceContainerHigh,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: Text(
                  displayLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  softWrap: false,
                ),
              ),
            ),
          ),

          const SizedBox(width: 8),

          // Translation picker (fixed: label is INSIDE the clickable pill)
          PopupMenuButton<String>(
            tooltip: 'Translation',
            initialValue: translation,
            onSelected: onSelectTranslation,
            itemBuilder: (ctx) => translations
                .map((t) => PopupMenuItem(value: t, child: Text(t.toUpperCase())))
                .toList(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Theme.of(context).dividerColor, width: 1),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(translation.toUpperCase()),
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_drop_down, size: 18),
                ],
              ),
            ),
          ),

          const Spacer(),

          IconButton(
            tooltip: 'Search',
            onPressed: null,
            icon: Icon(Icons.search, color: onSurface70),
          ),
          IconButton(
            tooltip: 'Read aloud',
            onPressed: null,
            icon: Icon(Icons.volume_up_outlined, color: onSurface70),
          ),
          IconButton(
            tooltip: 'Next chapter',
            onPressed: isAtLastChapter ? null : onNextChapter,
            icon: Icon(
              Icons.chevron_right,
              color: isAtLastChapter ? onSurface35 : onSurface70,
            ),
          ),
        ],
      ),
    );
  }
}
