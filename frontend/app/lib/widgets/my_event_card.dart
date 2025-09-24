import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/my_events.dart';

class MyEventCard extends StatelessWidget {
  final MyEventRef eventRef;
  final VoidCallback? onTap;
  final VoidCallback? onCancel;

  const MyEventCard({
    super.key,
    required this.eventRef,
    this.onTap,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);

    if (eventRef.event == null) {
      return Card(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: const Padding(
          padding: EdgeInsets.all(10),
          child: Text(
            'Event details unavailable',
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }

    final event = eventRef.event!;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        // Intentionally disable card-wide tap. Only the 'View Details' button
        // should trigger navigation. The button already calls `onTap`.
        onTap: null,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image banner: match the Events page height and overlay the
            // View Details button similarly.
            if (event.imageUrl != null)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(12),
                ),
                child: SizedBox(
                  height: 150,
                  width: double.infinity,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Positioned.fill(
                        child: Image.network(
                          event.imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder:
                              (context, error, stackTrace) => Container(
                                color: Colors.grey[200],
                                child: const Center(
                                  child: Icon(
                                    Icons.image_not_supported,
                                    size: 40,
                                    color: Colors.grey,
                                  ),
                                ),
                              ),
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) return child;
                            return Container(
                              color: Colors.grey[200],
                              child: const Center(
                                child: CircularProgressIndicator(),
                              ),
                            );
                          },
                        ),
                      ),

                      Positioned(
                        bottom: 12,
                        right: 12,
                        child: ElevatedButton(
                          onPressed: onTap,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: ssbcGray,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(6),
                            ),
                            elevation: 6,
                          ),
                          child: const Text(
                            'View Details',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          event.name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Cost / status badge (mirrors EnhancedEventCard behavior)
                      _buildCostBadge(event, ssbcGray),
                    ],
                  ),
                  // Registrants preview (aggregated names) — render as chips
                  if (eventRef.registrants.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Left label: always show when there are registrants
                        Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: ssbcGray.withAlpha((0.08 * 255).round()),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              'RSVPs',
                              style: TextStyle(
                                fontSize: 12,
                                color: ssbcGray,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children:
                                (() {
                                  final List<Widget> chips = [];
                                  final names = eventRef.registrants;
                                  final int showLimit = 3;

                                  final toShow = names.take(showLimit).toList();
                                  // Theme not needed for unified ssbcGray chips
                                  String firstName(String s) {
                                    final trimmed = s.trim();
                                    if (trimmed.isEmpty) {
                                      return s;
                                    }
                                    if (trimmed.toLowerCase() == 'you') {
                                      return 'You';
                                    }
                                    final parts = trimmed.split(RegExp(r'\s+'));
                                    return parts.isNotEmpty
                                        ? parts.first
                                        : trimmed;
                                  }

                                  for (final n in toShow) {
                                    final bool isYou = n.toLowerCase() == 'you';
                                    // 'You' uses white background with ssbcGray text.
                                    // Family members use solid ssbcGray with white text.
                                    final Color bgColor =
                                        isYou ? Colors.white : ssbcGray;
                                    final Color textColor =
                                        isYou ? ssbcGray : Colors.white;
                                    final Color borderColor = ssbcGray
                                        .withAlpha((0.12 * 255).round());

                                    chips.add(
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: bgColor,
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                          border: Border.all(
                                            color: borderColor,
                                          ),
                                        ),
                                        child: Text(
                                          firstName(n),
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: textColor,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    );
                                  }

                                  if (names.length > showLimit) {
                                    chips.add(
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: ssbcGray.withAlpha(
                                            (0.10 * 255).round(),
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                          border: Border.all(
                                            color: ssbcGray.withAlpha(
                                              (0.12 * 255).round(),
                                            ),
                                          ),
                                        ),
                                        child: Text(
                                          '+${names.length - showLimit} more',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.white,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                    );
                                  }

                                  return chips;
                                })(),
                          ),
                        ),
                        // registrant count/debug removed - chips convey registrants
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.schedule, size: 16, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text(
                        _formatDateTime(event.date),
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on,
                        size: 16,
                        color: Colors.grey,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          event.location,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Colors.grey,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  // Ministry removed from My Events cards (kept on Events page)
                  // Price is shown in the top badge; remove inline green price here
                  const SizedBox(height: 12),
                  // Description removed (keeps cards compact and consistent)
                  // Note: preview list intentionally omits the 'Cancel RSVP'
                  // button to keep the list compact. `onCancel` remains
                  // available for use in detail views or other contexts.
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCostBadge(MyEventDetails? event, Color ssbcGray) {
    // Handle null-safety for event wrapper
    final e =
        event ?? (throw ArgumentError('Event must not be null for cost badge'));

    // If event is full (no available spots) show FULL badge
    if (e.spots != null && e.spots! - e.seatsTaken <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.red,
          borderRadius: BorderRadius.circular(15),
        ),
        child: const Text(
          'FULL',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      );
    }

    if (e.price == 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: ssbcGray,
          borderRadius: BorderRadius.circular(15),
        ),
        child: const Text(
          'FREE',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: ssbcGray,
        borderRadius: BorderRadius.circular(15),
      ),
      child: Text(
        '\$${e.price.toStringAsFixed(2)}',
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );
  }

  // Image helper removed; image rendering handled inline in build

  // Family badge removed; registrant chips now communicate membership

  String _formatDateTime(DateTime dateTime) {
    final now = DateTime.now();
    final date = DateFormat.yMMMd().format(dateTime);
    final time = DateFormat.jm().format(dateTime);

    if (DateFormat.yMd().format(dateTime) == DateFormat.yMd().format(now)) {
      return 'Today at $time';
    } else if (DateFormat.yMd().format(dateTime) ==
        DateFormat.yMd().format(now.add(const Duration(days: 1)))) {
      return 'Tomorrow at $time';
    }

    return '$date at $time';
  }

  // _showCancelDialog removed: preview no longer shows the Cancel RSVP action.
}
