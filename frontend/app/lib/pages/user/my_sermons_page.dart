import 'package:app/models/sermon.dart';
import 'package:app/providers/sermons_provider.dart';
import 'package:app/widgets/sermon_card.dart';
import 'package:app/widgets/sermon_detail_sheet.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../helpers/localization_helper.dart';

class MySermonsPage extends StatefulWidget {
  const MySermonsPage({super.key});

  @override
  State<MySermonsPage> createState() => _MySermonsPageState();
}

class _MySermonsPageState extends State<MySermonsPage> {
  @override
  void initState() {
    super.initState();
    // Delay refresh to allow widget to mount fully.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SermonsProvider>().refreshFavorites();
    });
  }

  Future<void> _refresh() {
    return context.read<SermonsProvider>().refreshFavorites();
  }

  void _openDetail(Sermon sermon) {
    final provider = context.read<SermonsProvider>();
    provider.selectSermon(sermon);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SermonDetailSheet(sermonId: sermon.id),
    );
  }

  Future<void> _removeFavorite(SermonsProvider provider, Sermon sermon) async {
    try {
      await provider.removeFavorite(sermon.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(LocalizationHelper.localize('Removed "${sermon.title}" from favorites.'))),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(LocalizationHelper.localize('Unable to update favorites: $error'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: ssbcGray,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          LocalizationHelper.localize('My Sermons', capitalize: true),
        ),
        centerTitle: true,
      ),
      backgroundColor: const Color.fromARGB(255, 245, 245, 245),
      body: Consumer<SermonsProvider>(
        builder: (context, provider, _) {
          final favorites = provider.favorites;
          final isLoading = provider.isFavoritesLoading && favorites.isEmpty;
          final error = provider.error;

          if (isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (error != null && favorites.isEmpty) {
            return _ErrorState(message: error, onRetry: _refresh);
          }

          return RefreshIndicator(
            onRefresh: _refresh,
            child:
                favorites.isEmpty
                    ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(height: 120),
                        Icon(Icons.star_border, size: 72, color: Colors.grey),
                        SizedBox(height: 12),
                        Center(
                          child: Text(
                            LocalizationHelper.localize('You have no favorite sermons yet.'),
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      ],
                    )
                    : ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      itemCount: favorites.length,
                      itemBuilder: (context, index) {
                        final favorite = favorites[index];
                        final sermon = favorite.sermon;

                        if (sermon == null) {
                          return ListTile(
                            leading: const Icon(Icons.menu_book_outlined),
                            title: Text(LocalizationHelper.localize('Sermon ${favorite.sermonId}')),
                            subtitle: Text(
                              LocalizationHelper.localize('Details unavailable. Tap to refresh.'),
                            ),
                            onTap: () => provider.refreshFavorites(),
                          );
                        }

                        return SermonCard(
                          sermon: sermon,
                          onTap: () => _openDetail(sermon),
                          onToggleFavorite:
                              () => _removeFavorite(provider, sermon),
                        );
                      },
                    ),
          );
        },
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
              LocalizationHelper.localize('Error: $message'),
              style: const TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: Text(LocalizationHelper.localize('Try again', capitalize: true))),
          ],
        ),
      ),
    );
  }
}
