import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:app/models/bulletin.dart';
import 'package:app/models/service_bulletin.dart';
import 'package:app/providers/bulletins_provider.dart';
import 'package:app/widgets/bulletin_card.dart';
import 'package:app/widgets/bulletin_detail_sheet.dart';
import 'package:app/widgets/bulletin_filter_sheet.dart';
import 'package:app/widgets/service_card.dart';
import 'package:app/pages/service_detail.dart';

class BulletinsPage extends StatefulWidget {
  const BulletinsPage({super.key});

  @override
  State<BulletinsPage> createState() => _BulletinsPageState();
}

class _BulletinsPageState extends State<BulletinsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<BulletinsProvider>();
      if (provider.items.isEmpty) {
        provider.loadInitial();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Weekly Bulletin'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _openFilters,
          ),
        ],
      ),
      body: SafeArea(
        child: Consumer<BulletinsProvider>(
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
                    onDismiss: () {
                      // Clear error
                    },
                  ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: provider.refresh,
                    child: _buildContent(provider),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildContent(BulletinsProvider provider) {
    final hasServices = provider.services.isNotEmpty;
    final hasBulletins = provider.items.isNotEmpty;

    if (!hasServices && !hasBulletins) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 120),
          Icon(Icons.article_outlined, size: 72, color: Colors.grey),
          SizedBox(height: 12),
          Center(
            child: Text(
              'No content available yet. Pull to refresh.',
              style: TextStyle(color: Colors.grey),
            ),
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        // Services section
        if (hasServices) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              provider.serverWeek != null
                  ? provider.serverWeek!.weekLabel
                  : 'Upcoming Services',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          ...provider.services.map(
            (service) => ServiceCard(
              service: service,
              onTap: () => _openServiceDetails(service),
            ),
          ),
        ],

        // Announcements section - BULLETINS ARE THE ANNOUNCEMENTS
        if (hasBulletins) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
            child: Row(
              children: [
                Icon(
                  Icons.campaign_outlined,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
                const SizedBox(width: 8),
                Text(
                  'Announcements',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          ...provider.items.map(
            (bulletin) => BulletinCard(
              bulletin: bulletin,
              onTap: () => _openDetails(bulletin),
            ),
          ),
        ],

        const SizedBox(height: 24),
      ],
    );
  }

  void _openServiceDetails(ServiceBulletin service) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => ServiceDetailPage(service: service),
      ),
    );
  }

  Future<void> _openFilters() async {
    final provider = context.read<BulletinsProvider>();
    final result = await showModalBottomSheet<BulletinFilter>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder:
          (context) =>
              BulletinFilterSheet(initialFilter: provider.activeFilter),
    );

    if (result != null) {
      // Filter already has skip=0 from the filter sheet
      await provider.applyFilter(result);
    }
  }

  void _openDetails(Bulletin bulletin) {
    final provider = context.read<BulletinsProvider>();
    provider.selectBulletin(bulletin);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BulletinDetailSheet(bulletinId: bulletin.id),
    );
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
