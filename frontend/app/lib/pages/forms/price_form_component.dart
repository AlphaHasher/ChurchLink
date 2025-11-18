import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/models/form.dart';

/// PriceFormComponent represents the *overall payment summary* for the form.
/// It is the Dart analogue of the TS "price" field:
///  - Shows the current total amount
///  - Explains what kind of payment is required (PayPal / in-person)
///  - Optionally lets the user choose a payment method when both are allowed
///
/// It does NOT try to render individual line-items; that is handled separately
/// (see PriceLabelFormComponent for "pricelabel" fields).
class PriceFormComponent extends StatelessWidget {
  final double? total;
  final bool? allowPayPal;
  final bool? allowDoor;

  // Note: RadioListTile<T> expects onChanged to be ValueChanged<T?>?,
  // so we mirror that here.
  final ValueChanged<FormPaymentType?>? onChangedPaymentType;
  final FormPaymentType? selectedPaymentType;

  const PriceFormComponent({
    super.key,
    this.total,
    this.allowPayPal,
    this.allowDoor,
    this.selectedPaymentType,
    this.onChangedPaymentType,
  });

  @override
  Widget build(BuildContext context) {
    final double effectiveTotal = total ?? 0.0;

    // If total is not positive, we hide the block entirely.
    if (effectiveTotal <= 0) {
      return const SizedBox.shrink();
    }

    final bool paypalEnabled = allowPayPal ?? false;
    final bool doorEnabled = allowDoor ?? false;

    // If neither method is allowed, there's nothing helpful to show yet.
    if (!paypalEnabled && !doorEnabled) {
      return const SizedBox.shrink();
    }

    final ThemeData theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    final String amountStr = _formatMoney(effectiveTotal);

    final bool paypalOnly = paypalEnabled && !doorEnabled;
    final bool doorOnly = !paypalEnabled && doorEnabled;
    final bool both = paypalEnabled && doorEnabled;

    Widget inner;

    if (paypalOnly) {
      inner = _buildSingleMethodInfo(
        context: context,
        title: localize('Online payment required'),
        subtitle: localize(
          'You will be redirected to PayPal when you submit this form.',
        ),
        amountStr: amountStr,
        icon: Icons.account_balance_wallet_outlined,
        color: theme.colorScheme.primary,
      );
    } else if (doorOnly) {
      inner = _buildSingleMethodInfo(
        context: context,
        title: localize('In-person payment required'),
        subtitle: localize('You will pay at the event or office location.'),
        amountStr: amountStr,
        icon: Icons.store_mall_directory_outlined,
        color: theme.colorScheme.tertiary,
      );
    } else if (both) {
      inner = _buildDualMethodSelector(context: context, amountStr: amountStr);
    } else {
      // Fallback, should not actually happen, but keep it safe.
      inner = _buildSingleMethodInfo(
        context: context,
        title: localize('Payment'),
        subtitle: localize('Total due for this form.'),
        amountStr: amountStr,
        icon: Icons.payments_outlined,
        color: theme.colorScheme.primary,
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12.0),
      child: inner,
    );
  }

  Widget _buildSingleMethodInfo({
    required BuildContext context,
    required String title,
    required String subtitle,
    required String amountStr,
    required IconData icon,
    required Color color,
  }) {
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(
                        alpha: 0.8,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              amountStr,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDualMethodSelector({
    required BuildContext context,
    required String amountStr,
  }) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    final FormPaymentType? selected = selectedPaymentType;

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          children: [
            Row(
              children: [
                Icon(
                  Icons.payments_outlined,
                  color: theme.colorScheme.primary,
                  size: 24,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    localize('Payment'),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  amountStr,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                localize('Choose how you would like to pay:'),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.textTheme.bodySmall?.color?.withValues(
                    alpha: 0.8,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Column(
              children: [
                RadioListTile<FormPaymentType>(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: FormPaymentType.paypal,
                  groupValue: selected,
                  onChanged: onChangedPaymentType,
                  title: Text(localize('Pay with PayPal')),
                ),
                RadioListTile<FormPaymentType>(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: FormPaymentType.door,
                  groupValue: selected,
                  onChanged: onChangedPaymentType,
                  title: Text(localize('Pay in person')),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatMoney(double amount) {
    return '\$${amount.toStringAsFixed(2)}';
  }
}
