import 'package:flutter/material.dart';
import 'package:app/models/bible_plan.dart';

/// A widget showing a single day's preview card used in plan detail and plan lists.
class DayPreviewCard extends StatelessWidget {
  final int day;
  final List<BiblePassage> readings;

  const DayPreviewCard({super.key, required this.day, required this.readings});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        title: Text(
          'Day $day',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        subtitle: Text(
          '${readings.length} passage${readings.length != 1 ? 's' : ''}',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 14,
          ),
        ),
        // Match the previous icon color used across the app
        iconColor: Theme.of(context).colorScheme.primary,
        collapsedIconColor: Theme.of(context).colorScheme.primary,
        children:
            readings.map((passage) {
              return ListTile(
                dense: true,
                leading: Icon(
                  Icons.bookmark_border,
                  color: Theme.of(context).colorScheme.primary,
                  size: 20,
                ),
                title: Text(
                  passage.reference,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 14,
                  ),
                ),
              );
            }).toList(),
      ),
    );
  }
}
