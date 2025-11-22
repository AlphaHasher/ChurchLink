import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:app/models/bulletin.dart';
import 'package:app/providers/bulletins_provider.dart';
import 'package:app/widgets/bulletin_media_image.dart';

class BulletinDetailSheet extends StatefulWidget {
  const BulletinDetailSheet({super.key, required this.bulletinId});

  final String bulletinId;

  @override
  State<BulletinDetailSheet> createState() => _BulletinDetailSheetState();
}

class _BulletinDetailSheetState extends State<BulletinDetailSheet> {
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

            return DraggableScrollableSheet(
              initialChildSize: 0.9,
              minChildSize: 0.5,
              maxChildSize: 0.95,
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
    return ListView(
      controller: controller,
      padding: EdgeInsets.fromLTRB(20, 12, 20, bottomPadding),
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
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withAlpha(32),
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
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
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
            ...bulletin.ministries.map(
              (ministry) => Chip(
                label: Text(ministry),
                backgroundColor: Theme.of(
                  context,
                ).colorScheme.primary.withAlpha(20),
                side: BorderSide.none,
              ),
            ),
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
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
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
                  onPressed: () => _openAttachment(context, attachment.url),
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}
