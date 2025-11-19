import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/my_transactions_formatting.dart';
import 'package:app/models/transactions.dart';

class MyTransactionsCard extends StatelessWidget {
  final TransactionSummary transaction;
  final VoidCallback? onTap;

  const MyTransactionsCard({super.key, required this.transaction, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    final kindLabel = formatKindWithExtras(transaction);
    final statusDisplay = getStatusDisplay(
      transaction.status,
      transaction.kind,
    );
    final net = getUserNet(transaction);
    final total = transaction.amount;
    final refunded = transaction.refundedTotal ?? 0.0;

    final createdAt = transaction.createdAt;

    String formatDate(String? value) {
      if (value == null || value.isEmpty) return '';
      // If ISO-like "2024-01-02T...", show just date.
      final tIndex = value.indexOf('T');
      if (tIndex > 0) {
        return value.substring(0, tIndex);
      }
      return value;
    }

    String formatAmount(double? amount, TransactionCurrency? currency) {
      if (amount == null) return '—';
      final String prefix;
      // Most flows are USD; special-case it (and treat unknown like USD).
      if (currency == null || currency.toUpperCase() == 'USD') {
        prefix = '\$';
      } else {
        prefix = '';
      }
      final base = amount.toStringAsFixed(2);
      return prefix.isNotEmpty ? '$prefix$base' : '$base $currency';
    }

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Padding(
                padding: const EdgeInsets.only(right: 12, top: 4),
                child: Icon(
                  _iconForKind(transaction.kind),
                  size: 26,
                  color: theme.colorScheme.primary,
                ),
              ),
              // Main content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Kind + status pill
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            localize(kindLabel),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: statusDisplay.backgroundColor,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            localize(statusDisplay.label),
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: statusDisplay.textColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Amount row
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${localize("Total")}: ${formatAmount(total, transaction.currency)}',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                        if (net != null)
                          Text(
                            '${localize("Net")}: ${formatAmount(net, transaction.currency)}',
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    if (refunded > 0)
                      Text(
                        '${localize("Refunded")}: -${formatAmount(refunded, transaction.currency)}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.secondary,
                        ),
                      ),
                    const SizedBox(height: 6),

                    // Date + id
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            createdAt != null && createdAt.isNotEmpty
                                ? formatDate(createdAt)
                                : '',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface.withOpacity(
                                0.6,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            '#${transaction.id}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.right,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurface.withOpacity(
                                0.5,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _iconForKind(TransactionKind kind) {
    switch (kind) {
      case TransactionKind.donationOneTime:
        return Icons.volunteer_activism_outlined;
      case TransactionKind.donationSubscription:
        return Icons.compare_arrows_outlined;
      case TransactionKind.donationSubscriptionPayment:
        return Icons.autorenew_outlined;
      case TransactionKind.event:
        return Icons.event;
      case TransactionKind.form:
        return Icons.article_outlined;
    }
  }
}
