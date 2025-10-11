import 'package:flutter/material.dart';
import '../models/bible_plan.dart';

/// A widget showing a single day's preview card used in plan detail and plan lists.
class DayPreviewCard extends StatelessWidget {
  final int day;
  final List<BiblePassage> readings;

  const DayPreviewCard({
    Key? key,
    required this.day,
    required this.readings,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: const Color.fromRGBO(65, 65, 65, 1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        title: Text(
          'Day $day',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
        subtitle: Text(
          '${readings.length} passage${readings.length != 1 ? 's' : ''}',
          style: const TextStyle(
            color: Color.fromRGBO(180, 180, 180, 1),
            fontSize: 14,
          ),
        ),
        // Match the previous icon color used across the app
        iconColor: const Color.fromRGBO(150, 130, 255, 1),
        collapsedIconColor: const Color.fromRGBO(150, 130, 255, 1),
        children: readings.map((passage) {
          return ListTile(
            dense: true,
            leading: Icon(
              Icons.bookmark_border,
              color: const Color.fromRGBO(150, 130, 255, 1),
              size: 20,
            ),
            title: Text(
              passage.reference,
              style: const TextStyle(
                color: Color.fromRGBO(220, 220, 220, 1),
                fontSize: 14,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
