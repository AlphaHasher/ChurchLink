import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/asset_helper.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/models/event_v2.dart';
import 'package:app/models/ministry.dart';

class EventCard extends StatelessWidget {
  final UserFacingEvent event;
  final Map<String, Ministry>? ministriesById;
  final VoidCallback onTap;
  final VoidCallback? onAddToCalendar;
  final ValueChanged<bool>? onFavoriteChanged;

  const EventCard({
    super.key,
    required this.event,
    required this.onTap,
    this.ministriesById,
    this.onAddToCalendar,
    this.onFavoriteChanged,
  });

  // ---- DATA HELPERS ---------------------------------------------------------

  EventLocalization _resolveLocalization(UserFacingEvent e) {
    // Try exact locale, then language-only, then first available, then defaults.
    final locale = LocalizationHelper.currentLocale;
    final langOnly = locale.split('_').first.split('-').first;

    if (e.localizations.containsKey(locale)) {
      return e.localizations[locale]!;
    }
    if (e.localizations.containsKey(langOnly)) {
      return e.localizations[langOnly]!;
    }
    if (e.localizations.isNotEmpty) {
      return e.localizations.values.first;
    }

    return EventLocalization(
      title: e.defaultTitle,
      description: e.defaultDescription,
      locationInfo: e.defaultLocationInfo,
    );
  }

  String _formatDateTimeRange(UserFacingEvent e) {
    final start = safeParseIsoLocal(e.date);
    final end = e.endDate != null ? safeParseIsoLocal(e.endDate!) : null;

    if (start == null) {
      return e.date;
    }

    return formatDateRangeForDisplay(start, end);
  }

  String _formatPrice(UserFacingEvent e) {
    if (e.price <= 0) {
      return LocalizationHelper.localize('Free');
    }

    final base = '\$${e.price.toStringAsFixed(2)}';

    if (e.memberPrice != null && e.memberPrice! > 0) {
      final member = '\$${(e.memberPrice ?? 0).toStringAsFixed(2)}';
      return '$base · ${LocalizationHelper.localize("Members")}: $member';
    }

    return base;
  }

  String? _formatAgeRange(UserFacingEvent e) {
    final minAge = e.minAge;
    final maxAge = e.maxAge;
    if (minAge == null && maxAge == null) {
      return null;
    }
    if (minAge != null && maxAge != null) {
      return '$minAge–$maxAge';
    }
    if (minAge != null) {
      return '${LocalizationHelper.localize("Ages")} $minAge+';
    }
    return '${LocalizationHelper.localize("Up to")} $maxAge';
  }

  String _formatGender(UserFacingEvent e) {
    switch (e.gender) {
      case EventGenderOption.all:
        return LocalizationHelper.localize('All Genders');
      case EventGenderOption.male:
        return LocalizationHelper.localize('Male Only');
      case EventGenderOption.female:
        return LocalizationHelper.localize('Female Only');
    }
  }

  String? _formatCapacity(UserFacingEvent e) {
    if (e.maxSpots == null || e.maxSpots! <= 0) return null;
    final filled = e.seatsFilled;
    final max = e.maxSpots!;
    return '$filled / $max';
  }

  List<Widget> _buildMinistryChips(ThemeData theme) {
    if (event.ministries.isEmpty) return const <Widget>[];
    final map = ministriesById;

    return event.ministries.map((id) {
      final name = map?[id]?.name ?? id;
      return Padding(
        padding: const EdgeInsets.only(right: 4, bottom: 4),
        child: Chip(
          label: Text(
            name,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          visualDensity: VisualDensity.compact,
        ),
      );
    }).toList();
  }

  // ---- UI HELPERS -----------------------------------------------------------

  Widget _buildBadge(String label, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      margin: const EdgeInsets.only(right: 6),
      decoration: BoxDecoration(
        color: color ?? Colors.black.withOpacity(0.7),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final loc = _resolveLocalization(event);

    final dateText = _formatDateTimeRange(event);
    final priceText = _formatPrice(event);
    final ageText = _formatAgeRange(event);
    final genderText = _formatGender(event);
    final capacityText = _formatCapacity(event);
    final location =
        event.locationAddress?.isNotEmpty == true
            ? event.locationAddress!
            : loc.locationInfo;

    final isFavorited = event.isFavorited;
    final isMembersOnly = event.membersOnly;
    final requiresRsvp = event.rsvpRequired;

    return Card(
      elevation: 3,
      margin: const EdgeInsets.symmetric(vertical: 8),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // IMAGE + TOP BADGES
            SizedBox(
              height: 190,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Hero image
                  Hero(
                    tag: 'event-image-${event.id}',
                    child: Image.network(
                      AssetHelper.getPublicUrl(event.imageId),
                      fit: BoxFit.cover,
                      errorBuilder:
                          (_, __, ___) => Container(
                            color: theme.colorScheme.surfaceVariant,
                            alignment: Alignment.center,
                            child: const Icon(Icons.event, size: 40),
                          ),
                    ),
                  ),
                  // Gradient overlay
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            Colors.black.withOpacity(0.55),
                            Colors.black.withOpacity(0.15),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Badges overlay
                  Positioned(
                    left: 12,
                    bottom: 12,
                    right: 12,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: 4,
                            runSpacing: 4,
                            children: [
                              if (isMembersOnly)
                                _buildBadge(
                                  LocalizationHelper.localize('Members Only'),
                                  color: Colors.deepOrangeAccent.withOpacity(
                                    0.9,
                                  ),
                                ),
                              if (requiresRsvp)
                                _buildBadge(
                                  LocalizationHelper.localize(
                                    'Registration Required',
                                  ),
                                  color: Colors.blueAccent.withOpacity(0.9),
                                ),
                              _buildBadge(priceText),
                            ],
                          ),
                        ),
                        if (onFavoriteChanged != null)
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            icon: Icon(
                              isFavorited
                                  ? Icons.favorite
                                  : Icons.favorite_border,
                              color:
                                  isFavorited
                                      ? Colors.redAccent
                                      : Colors.white.withOpacity(0.9),
                            ),
                            onPressed: () => onFavoriteChanged!(!isFavorited),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // BODY
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // TITLE
                  Text(
                    loc.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  // DATE / LOCATION
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.schedule, size: 16),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          dateText,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                  if (location.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.place_outlined, size: 16),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            location,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.textTheme.bodyMedium?.color
                                  ?.withOpacity(0.8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 6),
                  // META: gender / age / capacity
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      if (genderText.isNotEmpty)
                        Chip(
                          visualDensity: VisualDensity.compact,
                          label: Text(
                            genderText,
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                      if (ageText != null)
                        Chip(
                          visualDensity: VisualDensity.compact,
                          label: Text(
                            '${LocalizationHelper.localize("Ages")} $ageText',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                      if (capacityText != null)
                        Chip(
                          visualDensity: VisualDensity.compact,
                          avatar: const Icon(Icons.people, size: 16),
                          label: Text(
                            capacityText,
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                    ],
                  ),
                  // Ministries
                  if (event.ministries.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(children: _buildMinistryChips(theme)),
                  ],
                ],
              ),
            ),
            // FOOTER ACTIONS
            if (onAddToCalendar != null)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                ).copyWith(bottom: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    IconButton(
                      tooltip: LocalizationHelper.localize('Add to Calendar'),
                      icon: const Icon(Icons.calendar_month_outlined),
                      onPressed: onAddToCalendar,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
