// event_attendees_card.dart
//
// Card for choosing attendees (self + family) for an event registration.
// Dart port of EventAttendeesCard.tsx.

import 'package:flutter/material.dart';
import 'package:app/models/event_v2.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/registration_payment_modal_helper.dart'
    show AttendeeRow, AttendeePaymentInfo;

/// Small pill-style label used throughout this card.
class _ChipLabel extends StatelessWidget {
  final Widget child;
  final Color? background;
  final Color? foreground;
  final Color? borderColor;
  final String? tooltip;

  const _ChipLabel({
    required this.child,
    this.background,
    this.foreground,
    this.borderColor,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Default = same as EventCard._metaBadge base style
    final Color bg = background ?? const Color(0xFFF1F5F9); // slate-50-ish
    final Color fg = foreground ?? const Color(0xFF0F172A); // slate-900-ish
    final Color border =
        borderColor ?? const Color(0xFFE2E8F0); // slate-200-ish

    final content = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: DefaultTextStyle(
        style: theme.textTheme.bodySmall!.copyWith(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: fg,
        ),
        child: IconTheme(
          data: IconThemeData(size: 14, color: fg),
          child: child,
        ),
      ),
    );

    if (tooltip == null || tooltip!.isEmpty) {
      return content;
    }

    return Tooltip(message: tooltip!, child: content);
  }
}

/// Gender chip: icon + label; blue for Male, pink for Female.
class _GenderBadge extends StatelessWidget {
  final String? gender; // "M" | "F" | null

  const _GenderBadge({required this.gender});

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;

    if (gender == 'M') {
      return _ChipLabel(
        background: const Color(0xFFE0F2FE), // blue-50
        foreground: const Color(0xFF1D4ED8), // blue-700
        borderColor: const Color(0xFFBFDBFE), // blue-200
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.male, size: 14),
            const SizedBox(width: 4),
            Text(localize('Male')),
          ],
        ),
      );
    }

    if (gender == 'F') {
      return _ChipLabel(
        background: const Color(0xFFFDF2F8), // pink-50
        foreground: const Color(0xFFBE185D), // pink-700
        borderColor: const Color(0xFFFBCFE8), // pink-200
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.female, size: 14),
            const SizedBox(width: 4),
            Text(localize('Female')),
          ],
        ),
      );
    }

    // Unknown -> neutral chip (this now matches the base meta badge style)
    return const _ChipLabel(child: Text('—'));
  }
}

/// Payment chips: method/price stay muted; status is green/red with icons.
/// For PayPal lines, show refund details:
///  - "$X.XX partially refunded" when some money has come back
///  - "$Y.YY refundable" for the remaining auto-refund allowance
class _PaymentBadges extends StatelessWidget {
  final AttendeePaymentInfo? info;

  const _PaymentBadges({required this.info});

  @override
  Widget build(BuildContext context) {
    if (info == null) return const SizedBox.shrink();

    final localize = LocalizationHelper.localize;
    final lang = LocalizationHelper.currentLocale;

    final EventPaymentType? option = info!.option;
    final double? price = info!.price;
    final bool? complete = info!.complete;
    final double refundableRemaining = info!.refundableRemaining;
    final double totalRefunded = info!.totalRefunded;

    final String freeLabel = lang == 'en' ? 'Free' : localize('Free of cost');

    // Base chip colors derived from theme
    // Base badge palette to mirror EventCard’s badges
    const neutralBg = Color(0xFFF1F5F9); // slate-50-ish
    const neutralFg = Color(0xFF0F172A); // slate-900-ish
    const neutralBorder = Color(0xFFE2E8F0); // slate-200-ish

    const successBg = Color(0xFFECFDF5); // emerald-50
    const successFg = Color(0xFF047857); // emerald-700
    const successBorder = Color(0xFFA7F3D0); // emerald-200

    const warningBg = Color(0xFFFFFBEB); // amber-50
    const warningFg = Color(0xFF92400E); // amber-700
    const warningBorder = Color(0xFFFDE68A); // amber-200

    const errorBg = Color(0xFFFDF2F2); // red-50
    const errorFg = Color(0xFFB91C1C); // red-700
    const errorBorder = Color(0xFFFECACA); // red-200

    final bool isPayPal = option == EventPaymentType.paypal;

    final double refunded =
        (totalRefunded.isFinite && totalRefunded > 0) ? totalRefunded : 0.0;
    final bool hasRefunds = isPayPal && refunded > 0;

    final double? refundableValue =
        (refundableRemaining.isFinite && refundableRemaining >= 0)
            ? refundableRemaining
            : null;
    final bool showRefundable = isPayPal && refundableValue != null;

    final chips = <Widget>[];

    // Method
    if (option != null) {
      late String methodText;
      switch (option) {
        case EventPaymentType.free:
          methodText = freeLabel;
          break;
        case EventPaymentType.door:
          methodText = localize('Pay at door');
          break;
        case EventPaymentType.paypal:
          methodText = localize('Paid online');
          break;
      }

      chips.add(
        _ChipLabel(
          background: neutralBg,
          foreground: neutralFg,
          borderColor: neutralBorder,
          tooltip: localize('Chosen payment method'),
          child: Text(methodText),
        ),
      );
    }

    // Price
    if (price != null && price.isFinite) {
      chips.add(
        _ChipLabel(
          background: neutralBg,
          foreground: neutralFg,
          borderColor: neutralBorder,
          tooltip: localize('Unit price at registration'),
          child: Text('\$${price.toStringAsFixed(2)}'),
        ),
      );
    }

    // Refunded
    if (hasRefunds) {
      chips.add(
        _ChipLabel(
          background: warningBg,
          foreground: warningFg,
          borderColor: warningBorder,
          tooltip: localize('Refunded amount'),
          child: Text(
            '\$${refunded.toStringAsFixed(2)} '
            '${(showRefundable && refundableValue > 0) ? localize("partially refunded") : localize("refunded")}',
          ),
        ),
      );
    }

    // Refundable remaining
    if (showRefundable) {
      final value = refundableValue.clamp(0.0, double.infinity);
      chips.add(
        _ChipLabel(
          background: successBg,
          foreground: successFg,
          borderColor: successBorder,
          tooltip: localize('Still automatically refundable'),
          child: Text(
            '\$${value.toStringAsFixed(2)} ${localize("refundable")}',
          ),
        ),
      );
    }

    // Completion status
    if (complete != null) {
      final isComplete = complete;
      chips.add(
        _ChipLabel(
          background: isComplete ? successBg : errorBg,
          foreground: isComplete ? successFg : errorFg,
          borderColor: isComplete ? successBorder : errorBorder,
          tooltip: localize('Payment status'),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(isComplete ? Icons.check_circle : Icons.cancel, size: 14),
              const SizedBox(width: 4),
              Text(isComplete ? localize('Complete') : localize('Not Paid')),
            ],
          ),
        ),
      );
    }

    if (chips.isEmpty) return const SizedBox.shrink();

    return Wrap(spacing: 6, runSpacing: 4, children: chips);
  }
}

class EventAttendeesCard extends StatelessWidget {
  final String? title;

  final List<AttendeeRow> rows;

  /// Snapshot at modal open
  final bool initialSelfRegistered;
  final Set<String> initialFamilyRegistered;

  /// Controlled selection for "self"
  final bool selfSelected;
  final ValueChanged<bool> onToggleSelf;

  /// Controlled selection for family members
  final List<String> selectedFamilyIds;
  final ValueChanged<List<String>> onChangeFamily;

  final String? Function(AttendeeRow row)? disabledReasonFor;
  final List<String>? Function(AttendeeRow row)? personReasonsFor;

  /// Optional integration hook: open "add family member" flow
  final VoidCallback? onAddFamilyMember;

  /// Per-row payment info for currently registered people
  final AttendeePaymentInfo? Function(AttendeeRow row)? paymentInfoFor;

  const EventAttendeesCard({
    super.key,
    this.title,
    required this.rows,
    required this.initialSelfRegistered,
    required this.initialFamilyRegistered,
    required this.selfSelected,
    required this.onToggleSelf,
    required this.selectedFamilyIds,
    required this.onChangeFamily,
    this.disabledReasonFor,
    this.personReasonsFor,
    this.onAddFamilyMember,
    this.paymentInfoFor,
  });

  bool _isRowSelected(AttendeeRow r) {
    return r.isSelf ? selfSelected : selectedFamilyIds.contains(r.id);
  }

  void _toggleRow(AttendeeRow r) {
    final reason = disabledReasonFor?.call(r);
    if (reason != null && reason.isNotEmpty) {
      return;
    }

    if (r.isSelf) {
      onToggleSelf(!selfSelected);
      return;
    }

    final current = List<String>.from(selectedFamilyIds);
    if (current.contains(r.id)) {
      current.remove(r.id);
    } else {
      current.add(r.id);
    }
    onChangeFamily(current);
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final neutralChipBg = Color(0xFFF1F5F9);
    final neutralChipFg = Color(0xFF0F172A);
    final neutralChipBorder = Color(0xFFE2E8F0);

    final errorChipBg = Color(0xFFFDF2F2);
    final errorChipFg = Color(0xFFB91C1C);
    final errorChipBorder = Color(0xFFFECACA);

    // Split into "registered" and "unregistered" based on snapshot
    final registered = <AttendeeRow>[];
    final unregistered = <AttendeeRow>[];

    for (final r in rows) {
      final wasRegistered =
          r.isSelf
              ? initialSelfRegistered
              : initialFamilyRegistered.contains(r.id);
      (wasRegistered ? registered : unregistered).add(r);
    }

    Widget buildRow(AttendeeRow r, bool currentlyRegistered) {
      final disabledReason = disabledReasonFor?.call(r);
      final extraReasons = personReasonsFor?.call(r) ?? const <String>[];
      final selected = _isRowSelected(r);

      final bool isDisabled =
          disabledReason != null && disabledReason.isNotEmpty;

      final borderColor = theme.dividerColor.withValues(alpha: 0.6);
      final backgroundColor =
          isDisabled
              ? theme.colorScheme.surfaceContainerHighest.withValues(
                alpha: theme.brightness == Brightness.dark ? 0.4 : 0.6,
              )
              : theme.cardColor;

      return InkWell(
        key: ValueKey(r.id),
        borderRadius: BorderRadius.circular(10),
        onTap: isDisabled ? null : () => _toggleRow(r),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Selection "radio" (visual only; tap handled by outer InkWell)
              Tooltip(
                message: disabledReason ?? '',
                child: Container(
                  height: 22,
                  width: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color:
                        selected
                            ? const Color(0xFF2563EB) // blue-600-ish
                            : Colors.white,
                    border: Border.all(
                      color:
                          selected
                              ? const Color(0xFF2563EB)
                              : const Color(0xFFD1D5DB), // gray-300
                      width: 2,
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      selected ? Icons.check_circle : Icons.circle_outlined,
                      size: 14,
                      color: selected ? Colors.white : Colors.grey.shade600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),

              // Main column
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name on its own row
                    Text(
                      r.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),

                    const SizedBox(height: 6),

                    // Payment chips block (only when currently registered)
                    if (currentlyRegistered) ...[
                      _PaymentBadges(info: paymentInfoFor?.call(r)),
                      const SizedBox(height: 6),
                    ],

                    // Gender + DOB + ineligible hint, as their own chip section
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _GenderBadge(gender: r.gender),

                        // DOB chip
                        _ChipLabel(
                          background: neutralChipBg,
                          foreground: neutralChipFg,
                          borderColor: neutralChipBorder,
                          child: Text(
                            '${localize("Day of Birth:")} '
                            '${r.dateOfBirthIso != null && r.dateOfBirthIso!.isNotEmpty ? _formatDob(r.dateOfBirthIso!) : "—"}',
                          ),
                        ),

                        // Ineligible hint
                        if (isDisabled)
                          _ChipLabel(
                            background: errorChipBg,
                            foreground: errorChipFg,
                            borderColor: errorChipBorder,
                            tooltip: disabledReason,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.info_outline, size: 12),
                                const SizedBox(width: 4),
                                Text(localize('Not Eligible')),
                              ],
                            ),
                          ),
                      ],
                    ),

                    // Extra reasons
                    if (extraReasons.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children:
                              extraReasons
                                  .map(
                                    (m) => Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          '• ',
                                          style: TextStyle(fontSize: 11),
                                        ),
                                        Flexible(
                                          fit: FlexFit.loose,
                                          child: Text(
                                            // Reasons may already be localized; keep
                                            // this to match TS behavior.
                                            LocalizationHelper.localize(m),
                                            style: theme.textTheme.bodySmall
                                                ?.copyWith(fontSize: 11),
                                          ),
                                        ),
                                      ],
                                    ),
                                  )
                                  .toList(),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    final actualTitle = title ?? localize('Choose Attendees');

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.dividerColor.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            Text(
              actualTitle,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),

            // Registered group
            if (registered.isNotEmpty) ...[
              Text(
                localize('Registered Attendees'),
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: theme.textTheme.bodySmall?.color?.withValues(
                    alpha: 0.8,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Column(
                children: registered.map((r) => buildRow(r, true)).toList(),
              ),
              const SizedBox(height: 12),
            ],

            // Unregistered group
            Text(
              localize('Not Registered'),
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.8),
              ),
            ),
            const SizedBox(height: 4),
            if (unregistered.isNotEmpty)
              Column(
                children: unregistered.map((r) => buildRow(r, false)).toList(),
              )
            else
              Text(
                localize('No unregistered family members found.'),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.textTheme.bodySmall?.color?.withValues(
                    alpha: 0.6,
                  ),
                ),
              ),

            // Add family member button
            if (onAddFamilyMember != null) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  onPressed: onAddFamilyMember,
                  icon: const Icon(Icons.person_add_alt_1_outlined, size: 18),
                  label: Text(localize('Add Family Member')),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _formatDob(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.month}/${dt.day}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}
