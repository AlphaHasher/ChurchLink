import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/my_transactions_formatting.dart';
import 'package:app/helpers/donation_helper.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/models/transactions.dart';
import 'package:app/models/donations.dart';
import 'package:app/pages/refund_requests/create_refund_request_page.dart';

class ViewTransactionPage extends StatefulWidget {
  final TransactionSummary transaction;

  const ViewTransactionPage({super.key, required this.transaction});

  @override
  State<ViewTransactionPage> createState() => _ViewTransactionPageState();
}

class _ViewTransactionPageState extends State<ViewTransactionPage> {
  bool _cancellingPlan = false;
  String? _localStatusOverride; // we can override status after cancel

  TransactionSummary get _tx => widget.transaction;

  String get _effectiveStatus => _localStatusOverride ?? (_tx.status ?? '');

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;

    final kindLabel = formatKindWithExtras(_tx);
    final statusDisplay = getStatusDisplay(_effectiveStatus, _tx.kind);
    final net = getUserNet(_tx);
    final total = _tx.amount;
    final refunded = _tx.refundedTotal ?? 0.0;

    final canRequestRefund = _canRequestRefund(net);
    final canCancelPlan = _canCancelPlan();

    return Scaffold(
      appBar: AppBar(
        title: Text(localize('Transaction Details', capitalize: true)),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 700),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Summary card
                  _buildSummaryCard(
                    context,
                    kindLabel: kindLabel,
                    statusDisplay: statusDisplay,
                    total: total,
                    refunded: refunded,
                    net: net,
                  ),
                  const SizedBox(height: 16),
                  // Kind-specific section
                  _buildKindSpecificDetails(context),
                  const SizedBox(height: 24),
                  // Actions
                  _buildActionsSection(
                    context,
                    canRequestRefund: canRequestRefund,
                    canCancelPlan: canCancelPlan,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCard(
    BuildContext context, {
    required String kindLabel,
    required StatusDisplay statusDisplay,
    required double? total,
    required double refunded,
    required double? net,
  }) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);
    final tx = _tx;

    final createdAt = tx.createdAt;
    final updatedAt = tx.updatedAt;

    String _formatDate(dynamic value) {
      if (value == null) return '';

      // Normalize to string first.
      final String? raw = value is String ? value : value.toString();

      final dt = safeParseIsoLocal(raw);
      if (dt == null) return raw ?? '';

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      final month = monthNames[dt.month - 1];
      final day = dt.day;
      final year = dt.year;

      var hour = dt.hour;
      final minute = dt.minute;
      final isPm = hour >= 12;
      var hour12 = hour % 12;
      if (hour12 == 0) hour12 = 12;
      final mm = minute.toString().padLeft(2, '0');
      final suffix = isPm ? 'PM' : 'AM';

      // Example: "Nov 18, 2025 · 10:13 AM"
      return '$month $day, $year · $hour12:$mm $suffix';
    }

    return Card(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Kind + status pill
            Row(
              children: [
                Icon(
                  _iconForKind(tx.kind),
                  size: 26,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    kindLabel,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: statusDisplay.backgroundColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    statusDisplay.label,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: statusDisplay.textColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Divider(color: theme.dividerColor.withOpacity(0.4)),
            const SizedBox(height: 8),
            // Amounts
            Row(
              children: [
                Expanded(
                  child: _SummaryLine(
                    label: localize('Total'),
                    value:
                        total != null ? '\$${total.toStringAsFixed(2)}' : '—',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SummaryLine(
                    label: localize('Refunded'),
                    value:
                        refunded > 0
                            ? '-\$${refunded.toStringAsFixed(2)}'
                            : '\$0.00',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _SummaryLine(
              label: localize('Net paid'),
              value: net != null ? '\$${net.toStringAsFixed(2)}' : '—',
            ),
            const SizedBox(height: 12),
            Divider(color: theme.dividerColor.withOpacity(0.4)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _SummaryLine(
                    label: localize('Created'),
                    value: _formatDate(createdAt),
                  ),
                ),
                const SizedBox(width: 8),
                if (updatedAt != null)
                  Expanded(
                    child: _SummaryLine(
                      label: localize('Updated'),
                      value: _formatDate(updatedAt),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            _SummaryLine(label: localize('Transaction ID'), value: tx.id),
            const SizedBox(height: 4),
            if (tx.paypalOrderId != null && tx.paypalOrderId!.trim().isNotEmpty)
              _SummaryLine(
                label: localize('PayPal Order ID'),
                value: tx.paypalOrderId!,
              ),
            if (tx.paypalCaptureId != null &&
                tx.paypalCaptureId!.trim().isNotEmpty)
              _SummaryLine(
                label: localize('PayPal Capture ID'),
                value: tx.paypalCaptureId!,
              ),
            if (tx.paypalSubscriptionId != null &&
                tx.paypalSubscriptionId!.trim().isNotEmpty)
              _SummaryLine(
                label: localize('PayPal Subscription ID'),
                value: tx.paypalSubscriptionId!,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildKindSpecificDetails(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);
    final tx = _tx;
    final extra = tx.extra ?? const <String, dynamic>{};

    final children = <Widget>[];

    switch (tx.kind) {
      case TransactionKind.donationOneTime:
        final message = extra['message'] as String?;
        if (message != null && message.trim().isNotEmpty) {
          children.add(
            _DetailBlock(
              title: localize('Donation Note'),
              content: message.trim(),
            ),
          );
        }
        break;

      case TransactionKind.donationSubscription:
        final meta = extra['meta'] as Map<String, dynamic>? ?? {};
        final interval =
            extra['interval'] as String? ?? meta['interval'] as String?;
        final message = extra['message'] as String?;
        final String? prettyInterval;
        if (interval != null && interval.isNotEmpty) {
          final s = interval.toLowerCase();
          if (s.startsWith('week')) {
            prettyInterval = localize('Weekly');
          } else if (s.startsWith('month')) {
            prettyInterval = localize('Monthly');
          } else if (s.startsWith('year') || s.startsWith('annual')) {
            prettyInterval = localize('Yearly');
          } else if (s == 'day' || s.startsWith('daily')) {
            prettyInterval = localize('Daily');
          } else {
            prettyInterval = interval;
          }
        } else {
          prettyInterval = null;
        }

        children.add(
          _DetailBlock(
            title: localize('Donation Plan'),
            content: [
              if (prettyInterval != null)
                '${localize("Billing interval")}: $prettyInterval',
              if (message != null && message.trim().isNotEmpty)
                '${localize("Note")}: ${message.trim()}',
            ].where((line) => line.isNotEmpty).join('\n'),
          ),
        );
        break;

      case TransactionKind.donationSubscriptionPayment:
        final planId =
            extra['subscription_id'] as String? ?? _tx.paypalSubscriptionId;
        children.add(
          _DetailBlock(
            title: localize('Plan Payment'),
            content:
                planId != null && planId.isNotEmpty
                    ? '${localize("Related subscription ID")}: $planId'
                    : localize('Payment for a recurring donation plan.'),
          ),
        );
        break;

      case TransactionKind.event:
        final eventId = extra['event_id'] ?? extra['eventId'];
        final instanceId =
            extra['event_instance_id'] ?? extra['eventInstanceId'];
        final itemsCount = extra['items_count'] ?? extra['itemsCount'];

        final rawLineItems =
            extra['line_items'] ?? extra['lineItems'] ?? const [];

        final List<Map<String, dynamic>> lineItems =
            rawLineItems is List
                ? rawLineItems
                    .where((e) => e is Map)
                    .map<Map<String, dynamic>>(
                      (e) => Map<String, dynamic>.from(e as Map),
                    )
                    .toList()
                : const [];

        // Top “Additional Info” block
        final headerLines = <String>[];
        if (eventId != null && eventId.toString().trim().isNotEmpty) {
          headerLines.add(
            '${localize("Event ID")}: ${eventId.toString().trim()}',
          );
        }
        if (instanceId != null && instanceId.toString().trim().isNotEmpty) {
          headerLines.add(
            '${localize("Instance ID")}: ${instanceId.toString().trim()}',
          );
        }

        if (itemsCount is num) {
          headerLines.add('${localize("Line Items")}: ${itemsCount.toInt()}');
        } else if (lineItems.isNotEmpty) {
          headerLines.add('${localize("Line Items")}: ${lineItems.length}');
        }

        if (headerLines.isNotEmpty) {
          children.add(
            _DetailBlock(
              title: localize('Event Payment'),
              content: headerLines.join('\n'),
            ),
          );
        }

        // Line item breakdown
        if (lineItems.isNotEmpty) {
          children.add(const SizedBox(height: 12));
          children.add(
            Text(
              localize('Line Item Breakdown'),
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          );
          children.add(const SizedBox(height: 8));

          children.addAll(
            lineItems.map((li) {
              final name =
                  (li['display_name'] ??
                          li['displayName'] ??
                          '${localize("Line")} ${lineItems.indexOf(li) + 1}')
                      .toString();

              final amountNum = (li['unit_price'] ?? li['unitPrice']) as num?;
              final double? amount =
                  amountNum != null ? amountNum.toDouble() : null;

              final rawRefunds = li['refunds'];
              final List refunds = rawRefunds is List ? rawRefunds : const [];

              final double refundedTotal =
                  li['refunded_total'] is num
                      ? (li['refunded_total'] as num).toDouble()
                      : refunds.fold<double>(0.0, (sum, r) {
                        if (r is Map && r['amount'] is num) {
                          return sum + (r['amount'] as num).toDouble();
                        }
                        return sum;
                      });

              final rawStatus = li['status']?.toString();

              // Derive a simple status label + colors.
              late final StatusDisplay itemStatus;
              if (refundedTotal > 0 &&
                  amount != null &&
                  amount > 0 &&
                  refundedTotal >= amount) {
                itemStatus = StatusDisplay(
                  label: localize('Refunded'),
                  backgroundColor: Colors.lightBlue.shade50,
                  textColor: Colors.lightBlue.shade700,
                );
              } else if (refundedTotal > 0 && amount != null && amount > 0) {
                itemStatus = StatusDisplay(
                  label: localize('Partially Refunded'),
                  backgroundColor: Colors.amber.shade50,
                  textColor: Colors.amber.shade700,
                );
              } else if (rawStatus != null && rawStatus.isNotEmpty) {
                itemStatus = getStatusDisplay(rawStatus, TransactionKind.event);
              } else {
                itemStatus = StatusDisplay(
                  label: localize('Paid'),
                  backgroundColor: Colors.green.shade50,
                  textColor: Colors.green.shade700,
                );
              }

              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // name + amount
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (amount != null)
                            Text(
                              'USD ${amount.toStringAsFixed(2)}',
                              style: theme.textTheme.bodySmall,
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: itemStatus.backgroundColor,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              itemStatus.label,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: itemStatus.textColor,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (refundedTotal > 0) ...[
                            const SizedBox(width: 8),
                            Text(
                              '${localize("Refunded")}: USD ${refundedTotal.toStringAsFixed(2)}',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          );
        }
        break;

      case TransactionKind.form:
        final formName = extra['form_name'] as String?;
        final note = extra['note'] as String?;
        final lines = <String>[];
        if (formName != null && formName.trim().isNotEmpty) {
          lines.add('${localize("Form")}: ${formName.trim()}');
        }
        if (note != null && note.trim().isNotEmpty) {
          lines.add('${localize("Note")}: ${note.trim()}');
        }

        if (lines.isNotEmpty) {
          children.add(
            _DetailBlock(
              title: localize('Form Payment'),
              content: lines.join('\n'),
            ),
          );
        }
        break;
    }

    if (children.isEmpty) {
      return Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            localize(
              'No additional details are available for this transaction.',
            ),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        ),
      );
    }

    return Column(children: children);
  }

  Widget _buildActionsSection(
    BuildContext context, {
    required bool canRequestRefund,
    required bool canCancelPlan,
  }) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);
    final kind = _tx.kind;

    final actions = <Widget>[];

    if (kind == TransactionKind.donationSubscription) {
      actions.add(
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed:
                (!canCancelPlan || _cancellingPlan)
                    ? null
                    : _confirmAndCancelPlan,
            icon:
                _cancellingPlan
                    ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : const Icon(Icons.cancel_schedule_send_outlined),
            label: Text(localize('Cancel Donation Plan', capitalize: true)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
      );
    }

    if (kind == TransactionKind.event || kind == TransactionKind.form) {
      if (actions.isNotEmpty) {
        actions.add(const SizedBox(height: 12));
      }
      actions.add(
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: canRequestRefund ? _goToRefundRequest : null,
            icon: const Icon(Icons.reply_all_outlined),
            label: Text(localize('Request a Refund', capitalize: true)),
            style: OutlinedButton.styleFrom(
              backgroundColor: theme.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: BorderSide(color: theme.colorScheme.primary),
            ),
          ),
        ),
      );

      if (!canRequestRefund) {
        actions.add(const SizedBox(height: 8));
        actions.add(
          Text(
            localize(
              'This transaction is fully refunded or otherwise not eligible for a refund request.',
            ),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        );
      }
    }

    if (actions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: actions,
    );
  }

  bool _canRequestRefund(double? net) {
    // Only event + form, and net > 0
    final kind = _tx.kind;
    if (kind != TransactionKind.event && kind != TransactionKind.form) {
      return false;
    }
    if (net == null) return false;
    return net > 0;
  }

  bool _canCancelPlan() {
    if (_tx.kind != TransactionKind.donationSubscription) {
      return false;
    }
    if (_tx.paypalSubscriptionId == null ||
        _tx.paypalSubscriptionId!.trim().isEmpty) {
      return false;
    }

    final status = _effectiveStatus.toUpperCase();
    // Roughly mirror web dialog: only ACTIVE / APPROVAL_PENDING allowed.
    return status == 'ACTIVE' || status == 'APPROVAL_PENDING';
  }

  Future<void> _confirmAndCancelPlan() async {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);
    final subscriptionId = _tx.paypalSubscriptionId;
    if (subscriptionId == null || subscriptionId.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            localize('We could not find a subscription ID for this plan.'),
          ),
        ),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(localize('Cancel Donation Plan', capitalize: true)),
            content: Text(
              localize(
                'Are you sure you want to cancel this recurring donation plan? '
                'You will not be charged again after cancelling.',
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(
                  localize('Keep Plan', capitalize: true),
                  style: TextStyle(color: theme.colorScheme.primary),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(
                  localize('Cancel Plan', capitalize: true),
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            ],
          ),
    );

    if (confirm != true) return;

    setState(() {
      _cancellingPlan = true;
    });

    try {
      final payload = CancelDonationSubscriptionRequest(
        subscriptionId: subscriptionId,
      );

      final res = await DonationHelper.cancelDonationSubscription(payload);

      if (!mounted) return;

      if (!res.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              res.msg ??
                  localize('We were not able to cancel this donation plan.'),
            ),
          ),
        );
        return;
      }

      setState(() {
        _localStatusOverride = 'CANCELLED';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res.msg ?? localize('Your donation plan has been cancelled.'),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _cancellingPlan = false;
        });
      }
    }
  }

  Future<void> _goToRefundRequest() async {
    final localize = LocalizationHelper.localize;

    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateRefundRequestPage(transaction: _tx),
      ),
    );

    if (!mounted) return;

    if (result == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(localize('Your refund request has been submitted.')),
        ),
      );
    }
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

class _SummaryLine extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryLine({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$label: ',
          style: theme.textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        Expanded(child: Text(value, style: theme.textTheme.bodySmall)),
      ],
    );
  }
}

class _DetailBlock extends StatelessWidget {
  final String title;
  final String content;

  const _DetailBlock({required this.title, required this.content});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Text(content, style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
