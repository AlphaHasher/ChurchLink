import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:app/models/bulletin.dart';
import 'package:app/models/service_bulletin.dart';
import 'package:app/models/ministry.dart';
import 'package:app/providers/bulletins_provider.dart';
import 'package:app/widgets/bulletin_card.dart';
import 'package:app/widgets/bulletin_detail_sheet.dart';
import 'package:app/widgets/bulletin_filter_sheet.dart';
import 'package:app/widgets/service_filter_sheet.dart';
import 'package:app/widgets/service_card.dart';
import 'package:app/pages/service_detail.dart';
import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/ministries_helper.dart';

class BulletinsPage extends StatefulWidget {
  const BulletinsPage({super.key});

  @override
  State<BulletinsPage> createState() => _BulletinsPageState();
}

class _BulletinsPageState extends State<BulletinsPage> {
  Map<String, Ministry> _ministriesById = <String, Ministry>{};

  @override
  void initState() {
    super.initState();
    _loadMinistries();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<BulletinsProvider>();
      if (provider.items.isEmpty) {
        provider.loadInitial();
      }
    });
  }

  Future<void> _loadMinistries() async {
    try {
      final list = await MinistriesHelper.fetchMinistries();
      if (!mounted) return;
      setState(() {
        _ministriesById = {for (final m in list) m.id: m};
      });
    } catch (e) {
      debugPrint('Failed to load ministries: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          LocalizationHelper.localize('Weekly Bulletin', capitalize: true),
        ),
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

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        // Services section - Always show header and filter
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  provider.serverWeek != null
                      ? provider.serverWeek!.weekLabel
                      : LocalizationHelper.localize(
                        'Upcoming Services',
                        capitalize: true,
                      ),
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.search),
                onPressed: _openServicesFilter,
                tooltip: 'Filter Services',
              ),
            ],
          ),
        ),
        // Show services or empty state message
        if (hasServices) ...[
          ...provider.services.map(
            (service) => ServiceCard(
              service: service,
              onTap: () => _openServiceDetails(service),
            ),
          ),
        ] else ...[
          // Show empty state when no services found
          Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              children: [
                Text(
                  LocalizationHelper.localize(
                    'No services found',
                    capitalize: true,
                  ),
                  style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  LocalizationHelper.localize(
                    'Try adjusting your filters',
                    capitalize: true,
                  ),
                  style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],

        // Announcements section - BULLETINS ARE THE ANNOUNCEMENTS
        // Always show header and filter button, even when no results
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                LocalizationHelper.localize('Announcements', capitalize: true),
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.search),
                onPressed: _openAnnouncementsFilter,
                tooltip: 'Filter Announcements',
              ),
            ],
          ),
        ),
        // Show bulletins or empty state message
        if (hasBulletins) ...[
          ...provider.items.map(
            (bulletin) => BulletinCard(
              bulletin: bulletin,
              ministriesById: _ministriesById,
              onTap: () => _showBulletinDetail(bulletin),
            ),
          ),
        ] else ...[
          // Show empty state when no announcements found
          Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              children: [
                Text(
                  LocalizationHelper.localize(
                    'No announcements found',
                    capitalize: true,
                  ),
                  style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  LocalizationHelper.localize(
                    'Try adjusting your filters',
                    capitalize: true,
                  ),
                  style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                  textAlign: TextAlign.center,
                ),
              ],
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

  Future<void> _openServicesFilter() async {
    final provider = context.read<BulletinsProvider>();
    final result = await showModalBottomSheet<ServiceFilterOptions>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder:
          (context) =>
              ServiceFilterSheet(initialFilter: provider.activeServiceFilter),
    );

    if (result != null) {
      await provider.applyServiceFilter(result);
    }
  }

  Future<void> _openAnnouncementsFilter() async {
    final provider = context.read<BulletinsProvider>();
    final result = await showModalBottomSheet<BulletinFilter>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder:
          (context) => BulletinFilterSheet(
            initialFilter: provider.activeAnnouncementFilter,
          ),
    );

    if (result != null) {
      await provider.applyAnnouncementFilter(result);
    }
  }

  void _showBulletinDetail(Bulletin bulletin) {
    final provider = context.read<BulletinsProvider>();
    provider.selectBulletin(bulletin);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder:
          (_) => BulletinDetailSheet(
            bulletinId: bulletin.id,
            ministriesById: _ministriesById,
          ),
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
        title: Text(LocalizationHelper.localize(message, capitalize: true)),
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
            ElevatedButton(
              onPressed: onRetry,
              child: Text(
                LocalizationHelper.localize('Try again', capitalize: true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
