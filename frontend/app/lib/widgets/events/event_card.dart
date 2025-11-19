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
    final locale = LocalizationHelper.currentLocale;

    if (e.defaultLocalization == locale) {
      return e.localizations[locale]!;
    }

    return EventLocalization(
      title: LocalizationHelper.localize(e.defaultTitle),
      description: LocalizationHelper.localize(e.defaultDescription),
      locationInfo: LocalizationHelper.localize(e.defaultLocationInfo),
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

  String _formatPriceLabel(UserFacingEvent e) {
    final price = e.price;
    final member = e.memberPrice;

    final lang = LocalizationHelper.currentLocale;
    final String freeLabel =
        (lang == 'en') ? 'FREE' : LocalizationHelper.localize('NO COST');

    final hasPaymentOptions = e.paymentOptions.isNotEmpty;
    final paid =
        (price > 0 || (member != null && member > 0)) && hasPaymentOptions;

    if (!paid) {
      return LocalizationHelper.localize(freeLabel);
    }

    final String priceStr = '\$${price.toStringAsFixed(2)}';

    if (member != null) {
      final String memberStr =
          member == 0
              ? LocalizationHelper.localize(freeLabel)
              : '\$${member.toStringAsFixed(2)}';
      return '$priceStr ${LocalizationHelper.localize("Standard Price")}  ·  '
          '$memberStr ${LocalizationHelper.localize("Member Price")}';
    }

    return '$priceStr ${LocalizationHelper.localize("Standard Price")}';
  }

  String? _formatAgeRange(UserFacingEvent e) {
    final minAge = e.minAge;
    final maxAge = e.maxAge;
    if (minAge == null && maxAge == null) {
      return null;
    }

    if (minAge != null && maxAge != null) {
      return '$minAge–$maxAge ${LocalizationHelper.localize("Years Old")}';
    }
    if (minAge != null) {
      return '$minAge ${LocalizationHelper.localize("Years Old and Over")}';
    }
    return '$maxAge ${LocalizationHelper.localize("Years Old and Under")}';
  }

  String? _formatMinistriesText() {
    if (event.ministries.isEmpty) return null;
    final map = ministriesById;

    final names =
        event.ministries
            .map((id) {
              final m = map?[id];
              if (m == null) return id;
              final name = (m.name).toString().trim();
              if (name.isEmpty) return id;
              return LocalizationHelper.localize(name);
            })
            .where((s) => s.trim().isNotEmpty)
            .toList();

    if (names.isEmpty) return null;
    return names.join(' • ');
  }

  String _formatGender(UserFacingEvent e) {
    switch (e.gender) {
      case EventGenderOption.male:
        return LocalizationHelper.localize('Men Only');
      case EventGenderOption.female:
        return LocalizationHelper.localize('Women Only');
      case EventGenderOption.all:
        return '';
    }
  }

  String? _formatCapacity(UserFacingEvent e) {
    if (e.maxSpots == null || e.maxSpots! <= 0) return null;
    final filled = e.seatsFilled;
    final max = e.maxSpots!;
    return '$filled / $max';
  }

  // ---- BADGE HELPERS --------------------------------------------------------

  Widget _overlayBadge({
    required String label,
    required Color background,
    required Color textColor,
    IconData? icon,
    bool fillHeart = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fillHeart ? Colors.white : textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaBadge({
    required String label,
    Color background = const Color(0xFFF1F5F9), // slate-50-ish
    Color textColor = const Color(0xFF0F172A), // slate-900-ish
    Color borderColor = const Color(0xFFE2E8F0), // slate-200-ish
    IconData? icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _priceBadge() {
    final label = _formatPriceLabel(event);

    final lang = LocalizationHelper.currentLocale;
    final price = event.price;
    final member = event.memberPrice;
    final hasPaymentOptions = event.paymentOptions.isNotEmpty;
    final bool paid =
        (price > 0 || (member != null && member > 0)) && hasPaymentOptions;

    final String freeBase =
        (lang == 'en') ? 'FREE' : LocalizationHelper.localize('NO COST');
    final bool isFree = !paid;

    if (isFree) {
      return _metaBadge(
        label: LocalizationHelper.localize(freeBase),
        background: const Color(0xFFECFDF5), // emerald-50
        textColor: const Color(0xFF047857), // emerald-700
        borderColor: const Color(0xFFA7F3D0), // emerald-200
      );
    }

    return _metaBadge(
      label: label,
      background: const Color(0xFFFFFBEB), // amber-50
      textColor: const Color(0xFF92400E), // amber-700
      borderColor: const Color(0xFFFDE68A), // amber-200
      icon: Icons.attach_money,
    );
  }

  Widget? _genderBadge() {
    final genderText = _formatGender(event);
    if (genderText.isEmpty) return null;

    if (event.gender == EventGenderOption.male) {
      return _metaBadge(
        label: genderText,
        background: const Color(0xFFE0F2FE), // blue-50
        textColor: const Color(0xFF1D4ED8), // blue-700
        borderColor: const Color(0xFFBFDBFE), // blue-200
        icon: Icons.male,
      );
    }
    if (event.gender == EventGenderOption.female) {
      return _metaBadge(
        label: genderText,
        background: const Color(0xFFFDF2F8), // pink-50
        textColor: const Color(0xFFBE185D), // pink-700
        borderColor: const Color(0xFFFBCFE8), // pink-200
        icon: Icons.female,
      );
    }
    return null;
  }

  Widget? _ageBadge() {
    final ageText = _formatAgeRange(event);
    if (ageText == null) return null;

    return _metaBadge(
      label: ageText,
      background: const Color(0xFFF8FAFC), // slate-50
      textColor: const Color(0xFF334155), // slate-700
      borderColor: const Color(0xFFE2E8F0), // slate-200
    );
  }

  Widget? _membersOnlyBadge() {
    if (!event.membersOnly) return null;

    return _metaBadge(
      label: LocalizationHelper.localize('Members Only'),
      background: const Color(0xFFF5F3FF), // purple-50
      textColor: const Color(0xFF6D28D9), // purple-700
      borderColor: const Color(0xFFE9D5FF), // purple-200
      icon: Icons.badge_outlined,
    );
  }

  Widget _rsvpBadge() {
    if (event.rsvpRequired) {
      return _metaBadge(
        label: LocalizationHelper.localize('Registration Required'),
        background: const Color(0xFFE0F2FE), // blue-50
        textColor: const Color(0xFF1D4ED8), // blue-700
        borderColor: const Color(0xFFBFDBFE), // blue-200
      );
    }

    return _metaBadge(
      label: LocalizationHelper.localize('No Registration Required'),
      background: const Color(0xFFECFDF5), // emerald-50
      textColor: const Color(0xFF047857), // emerald-700
      borderColor: const Color(0xFFA7F3D0), // emerald-200
    );
  }

  // ---- UI BUILD -------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final loc = _resolveLocalization(event);

    final dateText = _formatDateTimeRange(event);
    final capacityText = _formatCapacity(event);
    final ministriesText = _formatMinistriesText();
    final location =
        event.locationAddress?.isNotEmpty == true
            ? event.locationAddress!
            : loc.locationInfo;

    final isFavorited = event.isFavorited;
    final isRecurring = event.recurring != EventRecurrence.never;

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
            // IMAGE + TOP BADGES (Favorited + Recurrence/One-time)
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
                          (_, _, _) => Container(
                            color: theme.colorScheme.surfaceContainerHighest,
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
                            Colors.black.withValues(alpha: 0.55),
                            Colors.black.withValues(alpha: 0.15),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Top-right badges
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (isFavorited)
                          _overlayBadge(
                            label: LocalizationHelper.localize('Favorited'),
                            background: const Color(0xFFBE123C), // rose-600
                            textColor: Colors.white,
                            icon: Icons.favorite,
                            fillHeart: true,
                          ),
                        const SizedBox(height: 6),
                        _overlayBadge(
                          label:
                              isRecurring
                                  ? LocalizationHelper.localize(
                                    'Repeats ${event.recurring.name}',
                                  )
                                  : LocalizationHelper.localize('One-time'),
                          background:
                              isRecurring
                                  ? const Color(0xFF4F46E5) // indigo-600
                                  : Colors.white.withValues(alpha: 0.9),
                          textColor:
                              isRecurring
                                  ? Colors.white
                                  : const Color(0xFF334155), // slate-700
                          icon:
                              isRecurring
                                  ? Icons.repeat
                                  : Icons.event_available_outlined,
                        ),
                      ],
                    ),
                  ),
                  // Optional favorite icon button (if handler provided)
                  if (onFavoriteChanged != null)
                    Positioned(
                      bottom: 8,
                      right: 8,
                      child: IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        icon: Icon(
                          isFavorited ? Icons.favorite : Icons.favorite_border,
                          color:
                              isFavorited
                                  ? Colors.redAccent
                                  : Colors.white.withValues(alpha: 0.9),
                        ),
                        onPressed: () => onFavoriteChanged!(!isFavorited),
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
                    loc.title.isNotEmpty
                        ? loc.title
                        : LocalizationHelper.localize('(Untitled Event)'),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  // DATE
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.calendar_today, size: 16),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          dateText,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                  // LOCATION
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
                                  ?.withValues(alpha: 0.8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  // MINISTRIES (single line, church icon, localized names)
                  if (ministriesText != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.church_outlined, size: 16),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            ministriesText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.textTheme.bodyMedium?.color
                                  ?.withValues(alpha: 0.85),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  // DESCRIPTION snippet (optional)
                  if (loc.description.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      loc.description,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.85,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  // META BADGES ROW (RSVP, Price, Gender, Age, Members-only, Capacity)
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _rsvpBadge(),
                      _priceBadge(),
                      if (_genderBadge() != null) _genderBadge()!,
                      if (_ageBadge() != null) _ageBadge()!,
                      if (_membersOnlyBadge() != null) _membersOnlyBadge()!,
                      if (capacityText != null)
                        _metaBadge(
                          label:
                              '${LocalizationHelper.localize("Capacity")}: $capacityText',
                          background: const Color(0xFFF8FAFC), // slate-50
                          textColor: const Color(0xFF334155), // slate-700
                          borderColor: const Color(0xFFE2E8F0), // slate-200
                          icon: Icons.people_outline,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            // FOOTER ACTIONS: Add to My Calendar
            if (onAddToCalendar != null)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                ).copyWith(bottom: 8),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: onAddToCalendar,
                    icon: const Icon(Icons.calendar_month_outlined),
                    label: Text(
                      LocalizationHelper.localize('Add to My Calendar'),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      textStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
