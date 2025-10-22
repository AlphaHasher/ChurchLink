import 'package:flutter/material.dart';
import 'package:app/models/service_bulletin.dart';

/// Card widget to display a service bulletin in the feed
class ServiceCard extends StatelessWidget {
  const ServiceCard({super.key, required this.service, this.onTap});

  final ServiceBulletin service;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              colors: [
                colorScheme.primaryContainer.withAlpha(30),
                colorScheme.surface,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row with service indicator
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        service.title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: colorScheme.onSurface,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Service time
                Row(
                  children: [
                    Icon(
                      Icons.access_time,
                      size: 16,
                      color: colorScheme.onSurface.withAlpha(60),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _formatServiceTime(
                          service.dayOfWeek,
                          service.timeOfDay,
                        ),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurface.withAlpha(80),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),

                // Description (if provided)
                if (service.description != null &&
                    service.description!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    service.description!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withAlpha(70),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatServiceTime(String dayOfWeek, String timeOfDay) {
    // Convert 24-hour time to 12-hour format with AM/PM
    final parts = timeOfDay.split(':');
    final hours = int.tryParse(parts[0]) ?? 10;
    final minutes = parts.length > 1 ? parts[1] : '00';
    final period = hours >= 12 ? 'PM' : 'AM';
    final displayHours = hours % 12 == 0 ? 12 : hours % 12;
    return '$dayOfWeek at $displayHours:$minutes $period';
  }
}
