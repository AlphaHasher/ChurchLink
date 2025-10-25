import 'package:app/models/sermon.dart';
import 'package:app/models/sermon_filter.dart';
import 'package:app/providers/sermons_provider.dart';
import 'package:app/widgets/sermon_card.dart';
import 'package:app/widgets/sermon_detail_sheet.dart';
import 'package:app/widgets/sermon_filter_sheet.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class SermonsPage extends StatefulWidget {
  const SermonsPage({super.key});

  @override
  State<SermonsPage> createState() => _SermonsPageState();
}

class _SermonsPageState extends State<SermonsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<SermonsProvider>();
      if (provider.items.isEmpty) {
        provider.loadInitial();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('screen-sermons'),
      appBar: AppBar(
        title: const Text('Sermons'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: _openFilters),
        ],
      ),
      body: SafeArea(
        child: Consumer<SermonsProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading && provider.items.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.error != null && provider.items.isEmpty) {
              return _ErrorState(
                message: provider.error!,
                onRetry: provider.loadInitial,
              );
            }

            return Column(
              children: [
                if (provider.error != null && provider.items.isNotEmpty)
                  _ErrorBanner(
                    message: provider.error!,
                    onDismiss: provider.clearError,
                  ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: provider.loadInitial,
                    child:
                        provider.items.isEmpty
                            ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: const [
                                SizedBox(height: 120),
                                Icon(
                                  Icons.menu_book_outlined,
                                  size: 72,
                                  color: Colors.grey,
                                ),
                                SizedBox(height: 12),
                                Center(
                                  child: Text(
                                    'No sermons available yet. Pull to refresh.',
                                    style: TextStyle(color: Colors.grey),
                                  ),
                                ),
                              ],
                            )
                            : ListView.builder(
                              physics: const AlwaysScrollableScrollPhysics(),
                              itemCount: provider.items.length,
                              itemBuilder: (context, index) {
                                final sermon = provider.items[index];
                                return SermonCard(
                                  sermon: sermon,
                                  onTap: () => _openDetails(sermon),
                                  onToggleFavorite:
                                      () => _toggleFavorite(sermon),
                                );
                              },
                            ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _openFilters() async {
    final provider = context.read<SermonsProvider>();
    final result = await showModalBottomSheet<SermonFilter>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder:
          (context) => SermonFilterSheet(initialFilter: provider.activeFilter),
    );

    if (result != null) {
      await provider.applyFilter(result.copyWith(skip: 0));
    }
  }

  void _openDetails(Sermon sermon) {
    final provider = context.read<SermonsProvider>();
    provider.selectSermon(sermon);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SermonDetailSheet(sermonId: sermon.id),
    );
  }

  Future<void> _toggleFavorite(Sermon sermon) async {
    final provider = context.read<SermonsProvider>();

    try {
      await provider.toggleFavorite(sermon);
      if (!mounted) return;
      final updated = provider.items.firstWhere(
        (item) => item.id == sermon.id,
        orElse: () => sermon,
      );
      final message =
          updated.isFavorited
              ? 'Added "${updated.title}" to favorites.'
              : 'Removed "${updated.title}" from favorites.';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to update favorites: $error')),
      );
    }
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onDismiss});

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.error.withValues(alpha: 0.1),
      child: ListTile(
        leading: Icon(Icons.error_outline, color: theme.colorScheme.error),
        title: Text(message, style: TextStyle(color: theme.colorScheme.error)),
        trailing: IconButton(
          icon: Icon(Icons.close, color: theme.colorScheme.error),
          onPressed: onDismiss,
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

