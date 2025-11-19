import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';

/// PriceLabelFormComponent is the line-item row corresponding to the
/// TS "pricelabel" field type:
///  - Left: label (e.g. "Retreat Registration", "T-Shirt")
///  - Right: formatted amount
///
/// It does not know anything about totals or payment methods.
class PriceLabelFormComponent extends StatelessWidget {
  final String label;
  final double amount;

  const PriceLabelFormComponent({
    super.key,
    required this.label,
    required this.amount,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    final String safeLabel =
        label.isEmpty ? localize('Price Component') : label;
    final String amountStr = _formatMoney(amount);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        children: [
          Expanded(
            child: Text(
              safeLabel,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            amountStr,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: theme.colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }

  String _formatMoney(double amount) {
    return '\$${amount.toStringAsFixed(2)}';
  }
}
