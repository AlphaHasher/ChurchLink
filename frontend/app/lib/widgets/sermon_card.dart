import 'package:app/models/sermon.dart';
import 'package:flutter/material.dart';

class SermonCard extends StatelessWidget {
  const SermonCard({
    super.key,
    required this.sermon,
    required this.onTap,
    required this.onToggleFavorite,
  });

  final Sermon sermon;
  final VoidCallback onTap;
  final VoidCallback onToggleFavorite;

  static const Color _accentColor = Color.fromARGB(255, 142, 163, 168);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildThumbnail(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              sermon.title,
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(
                                  Icons.person,
                                  size: 16,
                                  color: Colors.grey,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    sermon.speaker,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(color: Colors.grey[700]),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(
                                  Icons.calendar_today,
                                  size: 16,
                                  color: Colors.grey,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  sermon.formattedDate,
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(color: Colors.grey[700]),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip:
                            sermon.isFavorited
                                ? 'Remove from favorites'
                                : 'Add to favorites',
                        onPressed: onToggleFavorite,
                        icon: Icon(
                          sermon.isFavorited ? Icons.star : Icons.star_border,
                          color:
                              sermon.isFavorited ? Colors.amber : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (sermon.summary != null && sermon.summary!.isNotEmpty)
                    Text(
                      sermon.summary!,
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(color: Colors.grey[800]),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    )
                  else
                    Text(
                      sermon.description,
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(color: Colors.grey[800]),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildThumbnail() {
    final resolvedThumbnail = sermon.resolvedThumbnailUrl;
    if (resolvedThumbnail == null) {
      return _buildThumbnailPlaceholder();
    }

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      child: Image.network(
        resolvedThumbnail,
        height: 160,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder:
            (context, error, stackTrace) => _buildThumbnailPlaceholder(),
      ),
    );
  }

  Widget _buildThumbnailPlaceholder() {
    return Container(
      height: 160,
      decoration: BoxDecoration(
        color: _accentColor.withOpacity(0.1),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: const Center(
        child: Icon(Icons.play_circle_outline, size: 56, color: Colors.white70),
      ),
    );
  }
}
