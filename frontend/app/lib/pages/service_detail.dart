import 'package:flutter/material.dart';
import 'package:app/models/service_bulletin.dart';

/// Full-page view displaying detailed information about a service bulletin
class ServiceDetailPage extends StatelessWidget {
  const ServiceDetailPage({super.key, required this.service});

  final ServiceBulletin service;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(service.title),
        centerTitle: true,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header section with gradient background
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    colorScheme.primaryContainer.withValues(alpha: 0.3),
                    colorScheme.surface,
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Service Time
                  Center(
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Icon(
                          Icons.access_time,
                          size: 20,
                          color: colorScheme.primary,
                        ),
                        Text(
                          service.formattedServiceTime,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),

                  // Description (if provided)
                  if (service.description != null &&
                      service.description!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      service.description!,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: colorScheme.onSurface.withValues(alpha: 0.8),
                        height: 1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),

            // Timeline section
            if (service.timelineNotes != null &&
                service.timelineNotes!.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    _buildTimelineContent(context, service.timelineNotes!),
                  ],
                ),
              ),
            ] else ...[
              Padding(
                padding: const EdgeInsets.all(20),
                child: Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.event_note,
                        size: 64,
                        color: colorScheme.onSurface.withValues(alpha: 0.3),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No timeline available for this service',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Build timeline content from markdown-formatted notes
  /// For now, displays as formatted text. Can be enhanced with markdown renderer later.
  Widget _buildTimelineContent(BuildContext context, String timelineNotes) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    // Split by lines and render each line
    final lines = timelineNotes.split('\n');
    final List<Widget> timelineWidgets = [];

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i].trim();
      if (line.isEmpty) {
        timelineWidgets.add(const SizedBox(height: 8));
        continue;
      }

      // Check if line starts with a number (e.g., "1.", "2.", etc.)
      final isNumbered = RegExp(r'^\d+\.').hasMatch(line);

      // Check if line starts with bullet or dash
      final isBulleted =
          line.startsWith('•') || line.startsWith('-') || line.startsWith('*');

      Widget lineWidget;

      if (isNumbered || isBulleted) {
        // Timeline item
        lineWidget = Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6, right: 12),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colorScheme.primary,
                ),
              ),
              Expanded(
                child: Text(
                  line.replaceFirst(RegExp(r'^[\d\.\-\*•]\s*'), ''),
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: colorScheme.onSurface,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
        );
      } else if (line.startsWith('#')) {
        // Header (markdown style)
        final headerText = line.replaceFirst(RegExp(r'^#+\s*'), '');
        lineWidget = Padding(
          padding: const EdgeInsets.only(top: 16, bottom: 8),
          child: Text(
            headerText,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
              color: colorScheme.onSurface,
            ),
            textAlign: TextAlign.left,
          ),
        );
      } else {
        // Regular text
        lineWidget = Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(
            line,
            style: theme.textTheme.titleMedium?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.9),
              height: 1.5,
            ),
          ),
        );
      }

      timelineWidgets.add(lineWidget);

    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: timelineWidgets,
    );
  }
}


