import 'package:app/models/sermon.dart';
import 'package:app/providers/sermons_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';

class SermonDetailSheet extends StatelessWidget {
  const SermonDetailSheet({super.key, required this.sermonId});

  final String sermonId;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight = constraints.maxHeight * 0.95;

        return Consumer<SermonsProvider>(
          builder: (context, provider, _) {
            Sermon? sermon;
            try {
              sermon = provider.items.firstWhere((item) => item.id == sermonId);
            } catch (_) {
              sermon = provider.selected;
            }

            if (sermon == null) {
              return const Center(child: CircularProgressIndicator());
            }

            final current = sermon;
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
                          if (current.resolvedThumbnailUrl != null)
                            AspectRatio(
                              aspectRatio: 16 / 9,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  current.resolvedThumbnailUrl!,
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                  errorBuilder:
                                      (context, error, stackTrace) => Container(
                                        decoration: BoxDecoration(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurface
                                              .withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                        child: Center(
                                          child: Icon(
                                            Icons.play_circle_outline,
                                            size: 56,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.4),
                                          ),
                                        ),
                                      ),
                                ),
                              ),
                            ),
                          if (current.resolvedThumbnailUrl != null)
                            const SizedBox(height: 16),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  current.title,
                                  style: Theme.of(context).textTheme.titleLarge
                                      ?.copyWith(fontWeight: FontWeight.bold),
                                ),
                              ),
                              IconButton(
                                icon: Icon(
                                  current.isFavorited
                                      ? Icons.star
                                      : Icons.star_border,
                                  color:
                                      current.isFavorited
                                          ? Colors.amber
                                          : Colors.grey,
                                ),
                                tooltip:
                                    current.isFavorited
                                        ? 'Remove from favorites'
                                        : 'Add to favorites',
                                onPressed: () async {
                                  try {
                                    final knownInList = provider.items.any(
                                      (item) => item.id == current.id,
                                    );

                                    if (!current.isFavorited && !knownInList) {
                                      await provider.toggleFavorite(current);
                                    } else if (current.isFavorited &&
                                        !knownInList) {
                                      await provider.removeFavorite(current.id);
                                    } else {
                                      await provider.toggleFavorite(current);
                                    }
                                  } catch (error) {
                                    _showError(
                                      context,
                                      message:
                                          'Could not update favorite: $error',
                                    );
                                  }
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'with ${current.speaker}',
                            style: Theme.of(
                              context,
                            ).textTheme.titleMedium?.copyWith(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withOpacity(0.7),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              Chip(
                                label: Text(current.formattedDate),
                                avatar: const Icon(
                                  Icons.calendar_today,
                                  size: 16,
                                ),
                                backgroundColor: Theme.of(
                                  context,
                                ).colorScheme.primary.withOpacity(0.12),
                                side: BorderSide.none,
                              ),
                              if (current.duration != null)
                                Chip(
                                  label: Text(
                                    '${current.duration!.inMinutes} min',
                                  ),
                                  avatar: const Icon(Icons.schedule, size: 16),
                                  backgroundColor: Theme.of(
                                    context,
                                  ).colorScheme.primary.withOpacity(0.12),
                                  side: BorderSide.none,
                                ),
                              ...current.ministry.map(
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
                          if (current.summary != null &&
                              current.summary!.isNotEmpty)
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Summary',
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  current.summary!,
                                  style: Theme.of(context).textTheme.bodyLarge,
                                ),
                                const SizedBox(height: 20),
                              ],
                            ),
                          Text(
                            current.description,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton.icon(
                            onPressed:
                                () => _openYoutube(context, current.youtubeUrl),
                            icon: const Icon(Icons.play_circle_fill),
                            label: const Text('Watch on YouTube'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  Theme.of(context).colorScheme.primary,
                              foregroundColor:
                                  Theme.of(context).colorScheme.onPrimary,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: () => _shareLink(context, current),
                            icon: const Icon(Icons.content_copy),
                            label: const Text('Copy Link'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor:
                                  Theme.of(context).colorScheme.primary,
                              side: BorderSide(
                                color: Theme.of(context).colorScheme.primary,
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
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

  Future<void> _openYoutube(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      _showError(context, message: 'Invalid video link');
      return;
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      _showError(context, message: 'Could not open the video link.');
    }
  }

  Future<void> _shareLink(BuildContext context, Sermon sermon) async {
    final shareText =
        '${sermon.title}\n\nWatch on YouTube: ${sermon.youtubeUrl}';

    try {
      await Clipboard.setData(ClipboardData(text: shareText));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Link copied to clipboard!'),
            backgroundColor: Theme.of(context).colorScheme.primary,
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.only(
              bottom: MediaQuery.of(context).size.height - 100,
              left: 10,
              right: 10,
            ),
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        _showError(context, message: 'Could not share the link.');
      }
    }
  }

  void _showError(BuildContext context, {required String message}) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}
