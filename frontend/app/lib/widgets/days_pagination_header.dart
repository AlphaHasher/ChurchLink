import 'package:flutter/material.dart';

/// Reusable header for paging ranges of days (e.g., "Days X - Y").
///
/// Accepts an optional [color] to control icon/text color; defaults to white.
class DaysPaginationHeader extends StatelessWidget {
  final int start;
  final int end;
  final int total;
  final int pageSize;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final String label;
  final Color? color;

  const DaysPaginationHeader({
    Key? key,
    required this.start,
    required this.end,
    required this.total,
    required this.pageSize,
    this.onPrev,
    this.onNext,
    this.label = 'Days',
    this.color,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? Theme.of(context).colorScheme.onSurface;

    return Semantics(
      container: true,
      label: '$label $start to $end',
      hint: 'Use previous and next buttons to page $pageSize days',
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              icon: const Icon(Icons.chevron_left),
              color: effectiveColor,
              tooltip: 'Previous $pageSize days',
              onPressed: onPrev,
            ),
            Text(
              '$label $start - $end',
              style: TextStyle(color: effectiveColor),
            ),
            IconButton(
              icon: const Icon(Icons.chevron_right),
              color: effectiveColor,
              tooltip: 'Next $pageSize days',
              onPressed: onNext,
            ),
          ],
        ),
      ),
    );
  }
}
