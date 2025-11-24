import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:app/models/bulletin.dart';
import 'package:app/models/ministry.dart';
import 'package:app/providers/bulletins_provider.dart';
import 'package:app/widgets/bulletin_media_image.dart';
import 'package:app/helpers/localization_helper.dart';

class BulletinDetailSheet extends StatefulWidget {
  const BulletinDetailSheet({
    super.key,
    required this.bulletinId,
    this.ministriesById,
  });

  final String bulletinId;
  final Map<String, Ministry>? ministriesById;

  @override
  State<BulletinDetailSheet> createState() => _BulletinDetailSheetState();
}

class _BulletinDetailSheetState extends State<BulletinDetailSheet> {
  double? _contentHeight;

  void _handleContentSizeChange(Size size) {
    final next = size.height.isFinite ? size.height : null;
    if (next == null) {
      return;
    }

    if (_contentHeight == null || (next - _contentHeight!).abs() > 1) {
      setState(() => _contentHeight = next);
    }
  }

  double _computeExtent(double maxHeight) {
    if (_contentHeight == null || maxHeight <= 0) {
      return 0.6;
    }

    final fraction = _contentHeight! / maxHeight;
    return fraction.clamp(0.3, 0.95);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return Consumer<BulletinsProvider>(
          builder: (context, provider, _) {
            Bulletin? bulletin;
            try {
              bulletin = provider.items.firstWhere(
                (item) => item.id == widget.bulletinId,
              );
            } catch (_) {
              bulletin = provider.selected;
            }

            if (bulletin == null) {
              return const Center(child: CircularProgressIndicator());
            }

            final current = bulletin;
            final mediaQuery = MediaQuery.of(context);
            final bottomPadding = 24.0 + mediaQuery.padding.bottom;
            final imageSources = current.imageSources;

            final maxHeight = constraints.maxHeight;
            final extentFraction = _computeExtent(maxHeight);
            final maxChildFraction = 0.95;
            final clampedExtent = math.min(extentFraction, maxChildFraction);

            return DraggableScrollableSheet(
              key: ValueKey<double>(clampedExtent),
              expand: false,
              initialChildSize: clampedExtent,
              minChildSize: clampedExtent,
              maxChildSize: maxChildFraction,
              builder: (
                BuildContext context,
                ScrollController scrollController,
              ) {
                return Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
                  ),
                  child: _buildSheetBody(
                    context: context,
                    controller: scrollController,
                    bulletin: current,
                    imageSources: imageSources,
                    bottomPadding: bottomPadding,
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Future<void> _openAttachment(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      if (context.mounted) {
        _showError(context, message: 'Invalid attachment link');
      }
      return;
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        _showError(context, message: 'Could not open the attachment.');
      }
    }
  }

  void _showError(BuildContext context, {required String message}) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Widget _buildSheetBody({
    required BuildContext context,
    required ScrollController controller,
    required Bulletin bulletin,
    required List<String> imageSources,
    required double bottomPadding,
  }) {
    return SingleChildScrollView(
      controller: controller,
      child: _MeasureSize(
        onChange: _handleContentSizeChange,
        child: Padding(
          padding: EdgeInsets.fromLTRB(20, 12, 20, bottomPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    width: 60,
                    height: 6,
                    margin: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
              if (imageSources.isNotEmpty) ...[
                BulletinMediaImage(
                  urls: imageSources,
                  borderRadius: BorderRadius.circular(12),
                  aspectRatio: 16 / 9,
                ),
                const SizedBox(height: 16),
              ],
              if (bulletin.isUpcoming)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(
                        context,
                      ).colorScheme.primary.withAlpha(32),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.schedule,
                          size: 16,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Upcoming',
                          style: Theme.of(
                            context,
                          ).textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (bulletin.isUpcoming) const SizedBox(height: 12),
              Text(
                bulletin.headline,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  Chip(
                    label: Text(bulletin.formattedWeek),
                    avatar: const Icon(Icons.calendar_today, size: 16),
                    backgroundColor: Theme.of(
                      context,
                    ).colorScheme.primary.withAlpha(28),
                    side: BorderSide.none,
                  ),
                  ...bulletin.ministries.map((ministryId) {
                    final ministry = widget.ministriesById?[ministryId];
                    final name = ministry?.name ?? ministryId;
                    return Chip(
                      label: Text(LocalizationHelper.localize(name)),
                      backgroundColor: Theme.of(
                        context,
                      ).colorScheme.primary.withAlpha(20),
                      side: BorderSide.none,
                    );
                  }),
                ],
              ),
              const SizedBox(height: 20),
              SelectableText(
                bulletin.body,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (bulletin.attachments.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text(
                  'Attachments',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                ...bulletin.attachments.map(
                  (attachment) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(attachment.title),
                      trailing: IconButton(
                        icon: Icon(
                          Icons.open_in_new,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        onPressed:
                            () => _openAttachment(context, attachment.url),
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _MeasureSize extends StatefulWidget {
  const _MeasureSize({required this.onChange, required this.child});

  final ValueChanged<Size> onChange;
  final Widget child;

  @override
  State<_MeasureSize> createState() => _MeasureSizeState();
}

class _MeasureSizeState extends State<_MeasureSize> {
  Size _oldSize = Size.zero;

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final contextSize = context.size;
      if (contextSize == null) return;
      if (contextSize != _oldSize) {
        _oldSize = contextSize;
        widget.onChange(contextSize);
      }
    });

    return widget.child;
  }
}
