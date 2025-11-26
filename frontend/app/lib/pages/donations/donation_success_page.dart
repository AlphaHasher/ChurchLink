import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/localized_widgets.dart';
import 'package:app/models/donations.dart';

class DonationSuccessPage extends StatelessWidget {
  final String? churchName;
  final double? amount;
  final DonationCurrency? currency;
  final bool isRecurring;
  final DonationInterval? interval;

  const DonationSuccessPage({
    super.key,
    this.churchName,
    this.amount,
    this.currency,
    this.isRecurring = false,
    this.interval,
  });

  String _currencyLabel(DonationCurrency? c) {
    switch (c) {
      case DonationCurrency.usd:
        return 'USD';
      default:
        return 'USD';
    }
  }

  String? _intervalLabel(DonationInterval? i) {
    switch (i) {
      case DonationInterval.week:
        return 'every week';
      case DonationInterval.month:
        return 'every month';
      case DonationInterval.year:
        return 'every year';
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final prettyAmount =
        amount != null && amount! > 0
            ? '\$${amount!.toStringAsFixed(2)} ${_currencyLabel(currency)}'
            : null;

    final prettyInterval = isRecurring ? _intervalLabel(interval) : null;

    final church =
        churchName?.trim().isNotEmpty == true
            ? churchName!.trim()
            : localize('our church');

    final heading =
        isRecurring
            ? 'Thank you for your ongoing support!'
            : 'Thank you for your generosity!';

    final description = () {
      if (isRecurring && prettyAmount != null && prettyInterval != null) {
        return localize(
          'Your recurring gift of $prettyAmount $prettyInterval helps support $church and our mission.',
        );
      }
      if (!isRecurring && prettyAmount != null) {
        return localize(
          'Your one-time gift of $prettyAmount helps support $church and the work we do together.',
        );
      }
      return localize(
        'Your gift helps support $church and the ministry happening here.',
      );
    }();

    return Scaffold(
      appBar: AppBar(
        title: Text('Thank You').localized(),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle, color: Colors.green, size: 80),
                const SizedBox(height: 24),
                Text(
                  heading,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ).localized(),
                const SizedBox(height: 12),
                Text(
                  description,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                  ),
                ),
                const SizedBox(height: 24),
                if (churchName != null && churchName!.trim().isNotEmpty)
                  Text(
                    localize('Supporting $church'),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                    ),
                  ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(context).pop();
                    },
                    icon: const Icon(Icons.arrow_back),
                    label: Text('Back to Giving').localized(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.black,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        vertical: 14,
                        horizontal: 20,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
