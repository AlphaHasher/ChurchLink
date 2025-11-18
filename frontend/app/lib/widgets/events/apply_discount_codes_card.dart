// THIS IS A CARD THAT ALLOWS A USER TO APPLY DISCOUNT CODES WHEN SIGNING UP FOR EVENTS

import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';

/// Minimal view model for an applied discount, mirroring the TS props:
/// { id, is_percent, discount, uses_left }
class AppliedDiscount {
  final String id;
  final bool isPercent;
  final double discount;
  final int? usesLeft;

  const AppliedDiscount({
    required this.id,
    required this.isPercent,
    required this.discount,
    required this.usesLeft,
  });
}

class ApplyDiscountCodesCard extends StatefulWidget {
  final bool applying;
  final AppliedDiscount? applied;
  final String? error;

  final Future<void> Function(String rawCode) onApply;
  final VoidCallback onClear;

  const ApplyDiscountCodesCard({
    super.key,
    required this.applying,
    required this.applied,
    required this.error,
    required this.onApply,
    required this.onClear,
  });

  @override
  State<ApplyDiscountCodesCard> createState() => _ApplyDiscountCodesCardState();
}

class _ApplyDiscountCodesCardState extends State<ApplyDiscountCodesCard> {
  final TextEditingController _controller = TextEditingController();

  @override
  void didUpdateWidget(covariant ApplyDiscountCodesCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Clear input when a code successfully applies (mirrors useEffect on [applied])
    if (widget.applied != null && widget.applied != oldWidget.applied) {
      _controller.text = '';
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _prettyDiscount(AppliedDiscount applied) {
    final localize = LocalizationHelper.localize;
    final lang = LocalizationHelper.currentLocale;
    final discount = applied.discount;

    if (lang == 'en') {
      if (applied.isPercent) {
        return '${discount.toStringAsFixed(0)}% off';
      } else {
        return '\$${discount.toStringAsFixed(2)} off';
      }
    } else {
      if (applied.isPercent) {
        return '${discount.toStringAsFixed(0)} ${localize("Removed from price")}';
      } else {
        return '${localize("Removed from price")}: \$${discount.toStringAsFixed(2)}';
      }
    }
  }

  String _checkingLabel(AppliedDiscount? applied) {
    final localize = LocalizationHelper.localize;
    final lang = LocalizationHelper.currentLocale;

    if (lang == 'en') {
      return 'Checking…';
    } else {
      return localize('Checking Discount Code…');
    }
  }

  String _usesLeftLabel(AppliedDiscount? applied) {
    if (applied == null) return '';

    final localize = LocalizationHelper.localize;
    final lang = LocalizationHelper.currentLocale;
    final int count = applied.usesLeft ?? 0;

    if (lang == 'en') {
      final suffix = count == 1 ? '' : 's';
      return '$count use$suffix left';
    } else {
      return '${localize("The amount of uses remaining is:")} $count';
    }
  }

  ButtonStyle _applyButtonStyle(ThemeData theme) {
    // Active: primary background, white foreground
    return ButtonStyle(
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return theme.disabledColor.withOpacity(0.12);
        }
        return theme.colorScheme.primary;
      }),
      foregroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return theme.disabledColor.withOpacity(0.38);
        }
        return Colors.white;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final applied = widget.applied;
    final error = widget.error;
    final code = _controller.text.trim();

    final checking = _checkingLabel(applied);
    final usesLeftText = _usesLeftLabel(applied);
    final hasUsesLeft = applied != null && usesLeftText.isNotEmpty;

    final bool canApply = !widget.applying && code.isNotEmpty;

    return Card(
      elevation: 1,
      margin: const EdgeInsets.symmetric(vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localize('Discount Codes'),
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),

            // 1) Input + Apply button in one line
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    enabled: !widget.applying,
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: localize('Enter discount code'),
                      border: const OutlineInputBorder(),
                    ),
                    textInputAction: TextInputAction.done,
                    onChanged: (_) {
                      // Rebuild so [canApply] reflects latest text
                      setState(() {});
                    },
                    onSubmitted: (value) {
                      final trimmed = value.trim();
                      if (trimmed.isNotEmpty && !widget.applying) {
                        widget.onApply(trimmed);
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: canApply ? () => widget.onApply(code) : null,
                  style: _applyButtonStyle(theme),
                  child: Text(
                    widget.applying
                        ? checking
                        : localize('Apply Discount Code'),
                  ),
                ),
              ],
            ),

            // 2) Remove button as its own line
            if (applied != null) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton(
                  onPressed: widget.applying ? null : widget.onClear,
                  child: Text(localize('Remove')),
                ),
              ),
            ],

            // Error
            if (error != null && error.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                localize('This discount code cannot be applied!'),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.red.shade700,
                ),
              ),
            ],

            // 3) Badges + explainer in their own line/section
            if (applied != null && (error == null || error.isEmpty)) ...[
              const SizedBox(height: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Discount + uses-left badges
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      // Discount badge
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE6F4EA), // emerald-50-ish
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: const Color(0xFFBBE5C5), // emerald-200-ish
                          ),
                        ),
                        child: Text(
                          _prettyDiscount(applied),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: const Color(0xFF047857), // emerald-700-ish
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),

                      // Uses-left badge
                      if (hasUsesLeft)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC), // slate-50-ish
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: const Color(0xFFE2E8F0), // slate-200-ish
                            ),
                          ),
                          child: Text(
                            applied.usesLeft == null
                                ? localize('Unlimited uses')
                                : usesLeftText,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: const Color(0xFF334155), // slate-700-ish
                            ),
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 8),

                  Text(
                    localize(
                      'Prices below will reflect the applicable discount across all persons. '
                      'You may only use 1 discount code per transaction.',
                    ),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withOpacity(0.7),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
