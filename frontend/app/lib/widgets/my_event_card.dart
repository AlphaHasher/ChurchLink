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
    final theme = Theme.of(context);

    if (eventRef.event == null) {
      return Card(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Event details unavailable',
            style: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.6),
            ),
          ),
        ),
      );
    }

    final event = eventRef.event!;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        // Intentionally disable card-wide tap. Only the 'View Details' button
        // should trigger navigation. The button already calls `onTap`.
        onTap: null,
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image banner: match the Events page height and overlay the
            // View Details button similarly.
            if (event.imageUrl != null)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
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
                                color:
                                    theme.colorScheme.surfaceContainerHighest,
                                child: Center(
                                  child: Icon(
                                    Icons.image_not_supported,
                                    size: 40,
                                    color: theme.colorScheme.onSurface
                                        .withOpacity(0.4),
                                  ),
                                ),
                              ),
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) return child;
                            return Container(
                              color: theme.colorScheme.surfaceContainerHighest,
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
                            backgroundColor: theme.colorScheme.primary,
                            foregroundColor: theme.colorScheme.onPrimary,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
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
              padding: const EdgeInsets.all(16),
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
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Cost / status badge (mirrors EnhancedEventCard behavior)
                      _buildCostBadge(context, event),
                    ],
                  ),
                  // Registrants preview (aggregated names) — render as chips
                  if (eventRef.registrants.isNotEmpty) ...[
                    const SizedBox(height: 12),
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
                              color: theme.colorScheme.primary.withOpacity(
                                0.12,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              'RSVPs',
                              style: TextStyle(
                                fontSize: 12,
                                color: theme.colorScheme.primary,
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
                                    // 'You' uses surface with primary text.
                                    // Family members use primary with onPrimary text.
                                    final Color bgColor =
                                        isYou
                                            ? theme.colorScheme.surface
                                            : theme.colorScheme.primary;
                                    final Color textColor =
                                        isYou
                                            ? theme.colorScheme.primary
                                            : theme.colorScheme.onPrimary;
                                    final Color borderColor = theme
                                        .colorScheme
                                        .primary
                                        .withOpacity(0.3);

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
                                            width: 1.5,
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
                                          color: theme.colorScheme.primary
                                              .withOpacity(0.15),
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                          border: Border.all(
                                            color: theme.colorScheme.primary
                                                .withOpacity(0.3),
                                            width: 1.5,
                                          ),
                                        ),
                                        child: Text(
                                          '+${names.length - showLimit} more',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: theme.colorScheme.primary,
                                            fontWeight: FontWeight.w600,
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
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.schedule,
                        size: 16,
                        color: theme.colorScheme.onSurface.withOpacity(0.6),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _formatDateTime(event.date),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on,
                        size: 16,
                        color: theme.colorScheme.onSurface.withOpacity(0.6),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          event.location,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurface.withOpacity(0.7),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 60), // restrict event name display length
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

  Widget _buildCostBadge(BuildContext context, MyEventDetails? event) {
    final theme = Theme.of(context);
    // Handle null-safety for event wrapper
    final e = event!;

    // If event is full (no available spots) show FULL badge
    if (e.spots != null && e.spots! - e.seatsTaken <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: theme.colorScheme.error,
          borderRadius: BorderRadius.circular(15),
        ),
        child: Text(
          'FULL',
          style: TextStyle(
            color: theme.colorScheme.onError,
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
          color: theme.colorScheme.primary,
          borderRadius: BorderRadius.circular(15),
        ),
        child: Text(
          'FREE',
          style: TextStyle(
            color: theme.colorScheme.onPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary,
        borderRadius: BorderRadius.circular(15),
      ),
      child: Text(
        '\$${e.price.toStringAsFixed(2)}',
        style: TextStyle(
          color: theme.colorScheme.onPrimary,
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
