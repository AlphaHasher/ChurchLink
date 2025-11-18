import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:app/helpers/localization_helper.dart';

class EventMapCard extends StatelessWidget {
  final String? locationInfo;
  final String? locationAddress;

  const EventMapCard({super.key, this.locationInfo, this.locationAddress});

  // ---------------------------------------------------------------------------
  // ENV / CONFIG
  // ---------------------------------------------------------------------------

  String get _mapsApiKey {
    // Mirrors the env pattern you use in BackendHelper:
    // try dotenv, then safe fallback.
    try {
      final key = dotenv.env['GOOGLE_MAP_API'];
      if (key != null && key.isNotEmpty) {
        return key;
      }
    } catch (_) {
      // dotenv not initialized (tests etc.) – fall through
    }
    return 'NO-KEY';
  }

  String? get _query {
    final addr = (locationAddress ?? '').trim();
    final info = (locationInfo ?? '').trim();
    if (addr.isNotEmpty) return addr;
    if (info.isNotEmpty) return info;
    return null;
  }

  String? get _staticMapUrl {
    final apiKey = _mapsApiKey;
    final q = _query;
    if (q == null || q.isEmpty) return null;
    if (apiKey == 'NO-KEY') return null;

    final encodedQuery = Uri.encodeComponent(q);

    // Normalize locale to simple "en", "ru", etc.
    final locale = LocalizationHelper.currentLocale;
    final lang = locale.split(RegExp(r'[-_]')).first.toLowerCase();

    final buffer = StringBuffer(
      'https://maps.googleapis.com/maps/api/staticmap',
    );

    buffer
      ..write('?center=$encodedQuery')
      ..write('&zoom=15')
      ..write('&size=600x300')
      ..write('&scale=2')
      ..write('&maptype=roadmap')
      ..write('&markers=color:red%7C$encodedQuery')
      ..write('&language=${Uri.encodeComponent(lang)}')
      ..write('&key=$apiKey');

    return buffer.toString();
  }

  // ---------------------------------------------------------------------------
  // MAP LAUNCH
  // ---------------------------------------------------------------------------

  Future<void> _openInMaps(BuildContext context) async {
    final q = _query;
    if (q == null || q.isEmpty) return;

    final encoded = Uri.encodeComponent(q);

    // Fallback web URL (works everywhere)
    final googleWeb = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$encoded',
    );

    try {
      if (Platform.isIOS) {
        // Prefer Apple Maps native
        final appleNative = Uri.parse('maps://?q=$encoded');
        if (await canLaunchUrl(appleNative)) {
          await launchUrl(appleNative);
          return;
        }

        // Fallback: Apple Maps web, which bounces to the app anyway
        final appleWeb = Uri.parse('https://maps.apple.com/?q=$encoded');
        if (await canLaunchUrl(appleWeb)) {
          await launchUrl(appleWeb, mode: LaunchMode.externalApplication);
          return;
        }
      } else if (Platform.isAndroid) {
        // Use geo: intent
        final geo = Uri.parse('geo:0,0?q=$encoded');
        if (await canLaunchUrl(geo)) {
          await launchUrl(geo);
          return;
        }
      }
    } catch (_) {
      // fall through to web fallback
    }

    // Web fallback – at least we show something
    await launchUrl(googleWeb, mode: LaunchMode.externalApplication);
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    final staticUrl = _staticMapUrl;
    final hasMap = staticUrl != null;
    final query = _query;

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Map icon + "Location"
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.map_outlined,
                  size: 18,
                  color: theme.iconTheme.color?.withOpacity(0.8),
                ),
                const SizedBox(width: 8),
                Text(
                  localize('Location'),
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Map preview area
            InkWell(
              onTap: query == null ? null : () => _openInMaps(context),
              borderRadius: BorderRadius.circular(12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: theme.colorScheme.outline.withOpacity(0.3),
                    ),
                  ),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child:
                        hasMap
                            ? Stack(
                              fit: StackFit.expand,
                              children: [
                                Image.network(
                                  staticUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder:
                                      (_, __, ___) =>
                                          _buildPlaceholder(context),
                                ),
                                // Overlay "Open in Maps"
                                Align(
                                  alignment: Alignment.bottomCenter,
                                  child: Container(
                                    margin: const EdgeInsets.all(8),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withOpacity(0.6),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(
                                          Icons.navigation_outlined,
                                          size: 14,
                                          color: Colors.white,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          localize('Open in Maps'),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            )
                            : _buildPlaceholder(context),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Pindrop + address + optional description
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.place_outlined,
                  size: 18,
                  color: theme.iconTheme.color?.withOpacity(0.8),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (locationAddress ?? '').isNotEmpty
                            ? locationAddress!
                            : '—',
                        style: theme.textTheme.bodySmall?.copyWith(height: 1.4),
                      ),
                      if ((locationInfo ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          locationInfo!.trim(),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.textTheme.bodySmall?.color
                                ?.withOpacity(0.7),
                            height: 1.4,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    return Container(
      color: theme.colorScheme.surfaceVariant.withOpacity(0.4),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.location_off_outlined,
              size: 28,
              color: theme.iconTheme.color?.withOpacity(0.55),
            ),
            const SizedBox(height: 8),
            Text(
              localize('No Map Provided'),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.textTheme.bodySmall?.color?.withOpacity(0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
