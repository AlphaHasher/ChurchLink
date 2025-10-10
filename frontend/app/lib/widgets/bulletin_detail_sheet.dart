import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/bulletin.dart';
import '../providers/bulletins_provider.dart';

class BulletinDetailSheet extends StatelessWidget {
  const BulletinDetailSheet({super.key, required this.bulletinId});

  final String bulletinId;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight = constraints.maxHeight * 0.95;

        return Consumer<BulletinsProvider>(
          builder: (context, provider, _) {
            Bulletin? bulletin;
            try {
              bulletin = provider.items.firstWhere(
                (item) => item.id == bulletinId,
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

            return Align(
              alignment: Alignment.bottomCenter,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: maxHeight,
                  maxWidth: constraints.maxWidth,
                ),
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
                  ),
                  child: SafeArea(
                    top: false,
                    bottom: false,
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(20, 12, 20, bottomPadding),
                      physics: const BouncingScrollPhysics(),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Align(
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
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        if (current.isUpcoming)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.blue.shade100,
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(
                                                  Icons.schedule,
                                                  size: 14,
                                                  color: Colors.blue.shade900,
                                                ),
                                                const SizedBox(width: 4),
                                                Text(
                                                  'UPCOMING',
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.blue.shade900,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      current.headline,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleLarge?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              Chip(
                                label: Text(current.formattedWeek),
                                avatar: const Icon(
                                  Icons.calendar_today,
                                  size: 16,
                                ),
                                backgroundColor: Theme.of(
                                  context,
                                ).colorScheme.primary.withOpacity(0.12),
                                side: BorderSide.none,
                              ),
                              ...current.ministries.map(
                                (ministry) => Chip(
                                  label: Text(ministry),
                                  backgroundColor: Theme.of(
                                    context,
                                  ).colorScheme.primary.withOpacity(0.15),
                                  side: BorderSide.none,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          Text(
                            current.body,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          if (current.attachments.isNotEmpty) ...[
                            const SizedBox(height: 24),
                            Text(
                              'Attachments',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 12),
                            ...current.attachments.map(
                              (attachment) => Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ListTile(
                                  title: Text(attachment.title),
                                  trailing: IconButton(
                                    icon: Icon(
                                      Icons.open_in_new,
                                      color:
                                          Theme.of(context).colorScheme.primary,
                                    ),
                                    onPressed:
                                        () => _openAttachment(
                                          context,
                                          attachment.url,
                                        ),
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
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _openAttachment(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      _showError(context, message: 'Invalid attachment link');
      return;
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      _showError(context, message: 'Could not open the attachment.');
    }
  }

  void _showError(BuildContext context, {required String message}) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}
