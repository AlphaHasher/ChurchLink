import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:app/models/event.dart';
import 'package:app/models/my_events.dart';
import 'package:app/models/event_registration_summary.dart';
import 'package:app/helpers/asset_helper.dart';

class EventCard extends StatelessWidget {
  final Event? event;
  final MyEventRef? eventRef;

  // Optional registration summary
  final EventRegistrationSummary? registrationSummary;

  // Callbacks
  final VoidCallback onViewPressed;
  final VoidCallback? onCancel;

  const EventCard({
    super.key,
    this.event,
    this.eventRef,
    this.registrationSummary,
    required this.onViewPressed,
    this.onCancel,
  }) : assert(
         (event != null && eventRef == null) ||
             (event == null && eventRef != null),
         'Either event or eventRef must be provided, but not both',
       );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Handle null event data
    final myEventDetails = eventRef?.event;
    if (eventRef != null && myEventDetails == null) {
      return Card(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Event details unavailable',
            style: TextStyle(color: theme.colorScheme.onSurface.withAlpha(60)),
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: onViewPressed,
      child: Card(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image Banner
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(16),
              ),
              child: _buildEventImage(context),
            ),

            // Event Details Section
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Event Name and Cost Label Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          _getEventName(),
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      _buildCostBadge(context),
                    ],
                  ),

                  if ((eventRef != null && eventRef!.registrants.isNotEmpty) ||
                      (event != null && event!.attendees.isNotEmpty)) ...[
                    const SizedBox(height: 12),
                    _buildRegistrantsList(context),
                  ],

                  const SizedBox(height: 12),

                  // Date and Time
                  Row(
                    children: [
                      Icon(
                        Icons.schedule,
                        size: 16,
                        color: theme.colorScheme.onSurface.withAlpha(60),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _getFormattedDateTime(),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withAlpha(70),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 6),

                  // Location
                  Row(
                    children: [
                      Icon(
                        Icons.location_on,
                        size: 16,
                        color: theme.colorScheme.onSurface.withAlpha(60),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _getLocation(),
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurface.withAlpha(70),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 60),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEventImage(BuildContext context) {
    final theme = Theme.of(context);
    final imageUrl = event?.imageUrl ?? eventRef?.event?.imageUrl;

    return SizedBox(
      height: 150,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageUrl != null && imageUrl.isNotEmpty)
            Image.network(
              AssetHelper.getPublicUrl(imageUrl),
              fit: BoxFit.cover,
              errorBuilder:
                  (context, error, stackTrace) => _buildPlaceholderImage(theme),
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return _buildPlaceholderImage(theme);
              },
            )
          else
            _buildPlaceholderImage(theme),
        ],
      ),
    );
  }

  Widget _buildPlaceholderImage(ThemeData theme) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      color: theme.colorScheme.surfaceContainerHighest,
      child: Center(
        child: Icon(
          Icons.event,
          size: 50,
          color: theme.colorScheme.onSurface.withAlpha(40),
        ),
      ),
    );
  }

  Widget _buildCostBadge(BuildContext context) {
    final theme = Theme.of(context);

    if (event != null) {
      // For Event objects
      if (event!.price > 0 && !event!.isFree) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color:
                event!.hasPayPalOption
                    ? const Color(0xFF0070BA)
                    : const Color.fromARGB(255, 142, 163, 168),
            borderRadius: BorderRadius.circular(15),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '\$${event!.price.toStringAsFixed(2)}',
                style: TextStyle(
                  color: theme.colorScheme.onPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              if (event!.hasPayPalOption) ...[
                const SizedBox(width: 4),
                Icon(
                  Icons.payment,
                  color: theme.colorScheme.onPrimary,
                  size: 12,
                ),
              ],
            ],
          ),
        );
      } else if (event!.isFree || event!.price == 0) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color:
                event!.hasPayPalOption
                    ? const Color.fromARGB(255, 46, 125, 50)
                    : const Color.fromARGB(255, 142, 163, 168),
            borderRadius: BorderRadius.circular(15),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'FREE',
                style: TextStyle(
                  color: theme.colorScheme.onPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              if (event!.hasPayPalOption) ...[
                const SizedBox(width: 4),
                Icon(
                  Icons.volunteer_activism,
                  color: theme.colorScheme.onPrimary,
                  size: 12,
                ),
              ],
            ],
          ),
        );
      }
    } else if (eventRef != null) {
      // For MyEventRef objects
      final e = eventRef!.event!;

      // Check if full
      if (e.spots != null && e.spots! > 0 && e.spots! - e.seatsTaken <= 0) {
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

    return const SizedBox.shrink();
  }

  Widget _buildRegistrantsList(BuildContext context) {
    final theme = Theme.of(context);
    List<String> registrants = [];

    if (eventRef != null) {
      registrants = eventRef!.registrants;
    } else if (event != null && event!.attendees.isNotEmpty) {
      registrants =
          event!.attendees.map((attendee) {
            if (attendee is Map<String, dynamic>) {
              return attendee['name']?.toString() ?? 'Unknown';
            }
            return attendee.toString();
          }).toList();
    }

    if (registrants.isEmpty) {
      return const SizedBox.shrink();
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 8.0),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withAlpha(12),
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
            children: _buildRegistrantChips(context, registrants),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildRegistrantChips(
    BuildContext context,
    List<String> registrants,
  ) {
    final theme = Theme.of(context);
    final List<Widget> chips = [];
    final int showLimit = 3;

    String firstName(String s) {
      final trimmed = s.trim();
      if (trimmed.isEmpty) return s;
      if (trimmed.toLowerCase() == 'you') return 'You';
      final parts = trimmed.split(RegExp(r'\s+'));
      return parts.isNotEmpty ? parts.first : trimmed;
    }

    for (final n in registrants.take(showLimit)) {
      final bool isYou = n.toLowerCase() == 'you';
      final Color bgColor =
          isYou ? theme.colorScheme.surface : theme.colorScheme.primary;
      final Color textColor =
          isYou ? theme.colorScheme.primary : theme.colorScheme.onPrimary;
      final Color borderColor = theme.colorScheme.primary.withAlpha(30);

      chips.add(
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor, width: 1.5),
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

    if (registrants.length > showLimit) {
      chips.add(
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withAlpha(15),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: theme.colorScheme.primary.withAlpha(30),
              width: 1.5,
            ),
          ),
          child: Text(
            '+${registrants.length - showLimit} more',
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
  }

  String _getEventName() {
    return event?.name ?? eventRef?.event?.name ?? '';
  }

  String _getLocation() {
    return event?.location ?? eventRef?.event?.location ?? '';
  }

  String _getFormattedDateTime() {
    final date = event?.date ?? eventRef?.event?.date;
    if (date == null) return '';

    // For Event objects, use formattedDateTime
    if (event != null) {
      return event!.formattedDateTime;
    }

    // For MyEventRef, format manually
    final now = DateTime.now();
    final dateStr = DateFormat.yMMMd().format(date);
    final timeStr = DateFormat.jm().format(date);

    if (DateFormat.yMd().format(date) == DateFormat.yMd().format(now)) {
      return 'Today at $timeStr';
    } else if (DateFormat.yMd().format(date) ==
        DateFormat.yMd().format(now.add(const Duration(days: 1)))) {
      return 'Tomorrow at $timeStr';
    }

    return '$dateStr at $timeStr';
  }
}
