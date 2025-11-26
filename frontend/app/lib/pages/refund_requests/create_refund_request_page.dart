import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/localized_widgets.dart';
import 'package:app/helpers/my_transactions_formatting.dart';
import 'package:app/helpers/refund_request_helper.dart';
import 'package:app/models/transactions.dart';
import 'package:app/models/refund_request.dart';

class CreateRefundRequestPage extends StatefulWidget {
  final TransactionSummary transaction;

  const CreateRefundRequestPage({super.key, required this.transaction});

  @override
  State<CreateRefundRequestPage> createState() =>
      _CreateRefundRequestPageState();
}

class _CreateRefundRequestPageState extends State<CreateRefundRequestPage> {
  final TextEditingController _messageController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  /// Map a TransactionKind (full enum) to the narrower RefundTxnKind.
  ///
  /// Only event + form payments are refundable via this flow.
  RefundTxnKind? _refundTxnKindFor(TransactionKind kind) {
    switch (kind) {
      case TransactionKind.event:
        return RefundTxnKind.event;
      case TransactionKind.form:
        return RefundTxnKind.form;
      case TransactionKind.donationOneTime:
      case TransactionKind.donationSubscription:
      case TransactionKind.donationSubscriptionPayment:
        return null;
    }
  }

  bool get _isRefundableKind {
    final kind = widget.transaction.kind;
    return _refundTxnKindFor(kind) != null;
  }

  Future<void> _submit() async {
    final localize = LocalizationHelper.localize;

    final refundKind = _refundTxnKindFor(widget.transaction.kind);
    if (refundKind == null) {
      setState(() {
        _error = localize(
          'Refunds can only be requested for event and form payments.',
        );
      });
      return;
    }

    final message = _messageController.text.trim();
    if (message.isEmpty) {
      setState(() {
        _error = localize('Please explain why you are requesting a refund.');
      });
      return;
    }

    final txnId = widget.transaction.id;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final payload = CreateRefundRequestPayload(
        txnKind: refundKind, // <-- now RefundTxnKind, not TransactionKind
        txnId: txnId,
        message: message,
      );

      final response = await RefundRequestHelper.createRefundRequest(payload);

      if (!mounted) return;

      if (response.success != true) {
        setState(() {
          _error =
              response.msg ??
              localize(
                'We were not able to submit your refund request. Please try again later.',
              );
        });
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            response.msg ?? localize('Refund request submitted successfully.'),
          ),
        ),
      );

      // Pop with `true` so the caller can refresh.
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = localize(
          'Unexpected error while submitting your refund request.',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Widget _buildTransactionSummary(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);
    final tx = widget.transaction;

    final kindLabel = formatKindWithExtras(tx);
    final statusDisplay = getStatusDisplay(tx.status, tx.kind);
    final net = getUserNet(tx);
    final total = tx.amount;
    final refunded = tx.refundedTotal ?? 0.0;

    final createdAt = tx.createdAt; // adjust to your actual field type/name
    final updatedAt = tx.updatedAt; // may be null

    String formatDate(dynamic value) {
      if (value == null) return '';
      if (value is String) return value;
      if (value is DateTime) {
        return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
      }
      return value.toString();
    }

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Kind + status pill row
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(
                  _iconForKind(tx.kind),
                  size: 24,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    kindLabel,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
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
            Divider(color: theme.dividerColor.withValues(alpha: 0.4)),
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
            Divider(color: theme.dividerColor.withValues(alpha: 0.4)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _SummaryLine(
                    label: localize('Created'),
                    value: formatDate(createdAt),
                  ),
                ),
                const SizedBox(width: 8),
                if (updatedAt != null)
                  Expanded(
                    child: _SummaryLine(
                      label: localize('Updated'),
                      value: formatDate(updatedAt),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            _SummaryLine(label: localize('Transaction ID'), value: tx.id),
          ],
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

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final isRefundable = _isRefundableKind;

    return Scaffold(
      appBar: AppBar(
        title: Text('Request a Refund').localized(),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildTransactionSummary(context),
                    const SizedBox(height: 16),
                    Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              localize('Why are you requesting a refund?'),
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              localize(
                                'Your request will be reviewed by the church or organization that received this payment. '
                                'They may contact you for more information before a refund is issued.',
                              ),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface.withValues(
                                  alpha: 0.7,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _messageController,
                              enabled: isRefundable && !_submitting,
                              maxLines: 5,
                              decoration: InputDecoration(
                                hintText: localize(
                                  'Please describe the situation and why you’re requesting a refund.',
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (!isRefundable)
                              Text(
                                localize(
                                  'Refunds are only available for event and form payments at this time.',
                                ),
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.error,
                                ),
                              ),
                            if (_error != null) ...[
                              const SizedBox(height: 8),
                              Text(
                                _error!,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.error,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed:
                            (!isRefundable || _submitting) ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.black,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child:
                            _submitting
                                ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                                : Text('Submit Refund Request').localized(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
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
