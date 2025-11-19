import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/my_transactions_formatting.dart';
import 'package:app/helpers/refund_request_helper.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/models/refund_request.dart';
import 'package:app/models/transactions.dart';
import 'package:app/pages/my_transactions/view_transaction_page.dart';

class ViewRefundRequestResponsePage extends StatefulWidget {
  final RefundRequestWithTransaction request;

  const ViewRefundRequestResponsePage({super.key, required this.request});

  @override
  State<ViewRefundRequestResponsePage> createState() =>
      _ViewRefundRequestResponsePageState();
}

class _ViewRefundRequestResponsePageState
    extends State<ViewRefundRequestResponsePage> {
  late RefundRequestWithTransaction _request;

  final TextEditingController _newMessageController = TextEditingController();
  bool _submittingNew = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _request = widget.request;
  }

  @override
  void dispose() {
    _newMessageController.dispose();
    super.dispose();
  }

  TransactionSummary? get _tx => _request.transaction;

  bool get _hasAdminResponse => _request.responded;

  bool get _isRefundableKind {
    final tx = _tx;
    if (tx == null) return false;
    return tx.kind == TransactionKind.event || tx.kind == TransactionKind.form;
  }

  StatusDisplay _deriveRequestStatusDisplay() {
    if (!_request.responded) {
      return const StatusDisplay(
        label: 'Pending',
        backgroundColor: Color(0xFFFFF8E1), // amber.shade50-ish
        textColor: Color(0xFFFFA000), // amber.shade700-ish
      );
    }
    if (_request.resolved) {
      return const StatusDisplay(
        label: 'Resolved',
        backgroundColor: Color(0xFFE8F5E9), // green.shade50-ish
        textColor: Color(0xFF2E7D32), // green.shade700-ish
      );
    }
    return const StatusDisplay(
      label: 'Unresolved',
      backgroundColor: Color(0xFFECEFF1), // grey/silver
      textColor: Color(0xFF455A64),
    );
  }

  StatusDisplay _deriveHistoryStatusDisplay(RefundRequestHistoryItem item) {
    if (!item.responded) {
      return const StatusDisplay(
        label: 'Pending',
        backgroundColor: Color(0xFFFFF8E1),
        textColor: Color(0xFFFFA000),
      );
    }
    if (item.resolved) {
      return const StatusDisplay(
        label: 'Resolved',
        backgroundColor: Color(0xFFE8F5E9),
        textColor: Color(0xFF2E7D32),
      );
    }
    return const StatusDisplay(
      label: 'Unresolved',
      backgroundColor: Color(0xFFECEFF1),
      textColor: Color(0xFF455A64),
    );
  }

  String _formatTimestamp(String? iso) {
    if (iso == null || iso.trim().isEmpty) {
      return '—';
    }

    final dt = safeParseIsoLocal(iso);
    if (dt == null) return iso;

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

    // e.g. "Nov 18, 2025 · 10:13 AM"
    return '$month $day, $year · $hour12:$mm $suffix';
  }

  RefundTxnKind? _refundKindFromTransaction(TransactionKind kind) {
    switch (kind) {
      case TransactionKind.event:
        return RefundTxnKind.event;
      case TransactionKind.form:
        return RefundTxnKind.form;
      default:
        return null;
    }
  }

  Future<void> _handleSubmitNewRequest() async {
    final localize = LocalizationHelper.localize;
    final tx = _tx;

    final trimmed = _newMessageController.text.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _submitError = localize(
          'Please describe what you are asking for in this new request.',
        );
      });
      return;
    }

    if (tx == null || !_isRefundableKind) {
      setState(() {
        _submitError = localize(
          'This transaction is not eligible for a refund request from this screen.',
        );
      });
      return;
    }

    final refundKind = _refundKindFromTransaction(tx.kind);
    if (refundKind == null) {
      setState(() {
        _submitError = localize(
          'This transaction is not eligible for a refund request from this screen.',
        );
      });
      return;
    }

    try {
      setState(() {
        _submittingNew = true;
        _submitError = null;
      });

      final payload = CreateRefundRequestPayload(
        txnKind: refundKind,
        txnId: tx.id,
        message: trimmed,
      );

      final result = await RefundRequestHelper.createRefundRequest(payload);
      if (!mounted) return;

      if (!result.success) {
        setState(() {
          _submitError =
              result.msg ??
              localize(
                'Failed to submit a new refund request. Please try again.',
              );
        });
        return;
      }

      // SUCCESS BEHAVIOR:
      // 1) show toast
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.msg ?? localize('Refund request submitted successfully.'),
          ),
        ),
      );

      // 2) pop back to list
      // 3) list will refresh because we pop with `true`
      Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitError = localize(
          'Something went wrong while submitting your new request.',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _submittingNew = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final tx = _tx;

    final statusDisplay = _deriveRequestStatusDisplay();
    final createdText = _formatTimestamp(_request.createdOn);
    final respondedText =
        _request.respondedTo != null && _request.respondedTo!.trim().isNotEmpty
            ? _formatTimestamp(_request.respondedTo)
            : null;

    final typeLabel =
        tx != null
            ? formatKindWithExtras(tx)
            : _request.txnKind == RefundTxnKind.event
            ? localize('Event Payment')
            : _request.txnKind == RefundTxnKind.form
            ? localize('Form Payment')
            : localize('Payment');

    final hasAdminResponse = _hasAdminResponse;
    final responseText =
        (_request.reason != null && _request.reason!.trim().isNotEmpty)
            ? _request.reason!.trim()
            : hasAdminResponse
            ? localize('No specific reason was recorded by the admin.')
            : localize('This refund request has not yet been responded to.');

    return Scaffold(
      appBar: AppBar(
        title: Text(localize('Refund Request Details', capitalize: true)),
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
                  _buildHeaderCard(
                    context: context,
                    statusDisplay: statusDisplay,
                    typeLabel: typeLabel,
                    createdText: createdText,
                    respondedText: respondedText,
                    responseText: responseText,
                    hasAdminResponse: hasAdminResponse,
                  ),
                  const SizedBox(height: 16),
                  if (tx != null) _buildTransactionSnapshot(context, tx),
                  const SizedBox(height: 16),
                  if (_request.history.isNotEmpty)
                    _buildHistorySection(context),
                  const SizedBox(height: 16),
                  if (_isRefundableKind) _buildNewRequestSection(context),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderCard({
    required BuildContext context,
    required StatusDisplay statusDisplay,
    required String typeLabel,
    required String createdText,
    required String? respondedText,
    required String responseText,
    required bool hasAdminResponse,
  }) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final userMessage =
        _request.message.trim().isNotEmpty
            ? _request.message.trim()
            : localize('No message was provided for this request.');

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title + status + created/responded
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        localize('Refund request'),
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        typeLabel,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.textTheme.bodySmall?.color?.withOpacity(
                            0.75,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
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
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${localize("Submitted")}: $createdText',
                                  style: theme.textTheme.bodySmall,
                                ),
                                if (respondedText != null)
                                  Text(
                                    '${localize("Responded")}: $respondedText',
                                    style: theme.textTheme.bodySmall,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // User message
            Text(
              '${localize("Your message")}:',
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              userMessage,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.textTheme.bodySmall?.color?.withOpacity(0.85),
              ),
            ),
            const SizedBox(height: 16),
            // Admin response
            Text(
              '${localize("Admin response")}:',
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 16, color: theme.hintColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    responseText,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withOpacity(
                        0.85,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (!hasAdminResponse) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Text(
                  localize(
                    'Once an admin responds to this request, their decision and any notes will appear here.',
                  ),
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 12,
                    color: Colors.black,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionSnapshot(
    BuildContext context,
    TransactionSummary tx,
  ) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final currency = tx.currency ?? 'USD';
    final gross = tx.grossAmount ?? tx.amount ?? 0.0;
    final refunded = tx.refundedTotal ?? 0.0;
    final net =
        tx.netAmount ??
        (gross > 0 ? (gross - refunded).clamp(0, double.infinity) : null);
    final created = _formatTimestamp(tx.createdAt);
    final statusDisplay =
        tx.status != null ? getStatusDisplay(tx.status, tx.kind) : null;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localize('Transaction'),
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _SummaryRow(
                    label: localize('Amount'),
                    value: '$currency ${gross.toStringAsFixed(2)}',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SummaryRow(
                    label: localize('Refunded'),
                    value:
                        refunded > 0
                            ? '-$currency ${refunded.toStringAsFixed(2)}'
                            : '—',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _SummaryRow(
              label: localize('Net paid'),
              value: net != null ? '$currency ${net.toStringAsFixed(2)}' : '—',
            ),
            const SizedBox(height: 8),
            if (statusDisplay != null)
              Row(
                children: [
                  Text(
                    '${localize("Status")}: ',
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
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
                      localize(statusDisplay.label),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: statusDisplay.textColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 8),
            _SummaryRow(label: localize('Created'), value: created),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ViewTransactionPage(transaction: tx),
                    ),
                  );
                },
                icon: const Icon(Icons.remove_red_eye_outlined, size: 18),
                label: Text(localize('View transaction')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistorySection(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final history = _request.history.toList().reversed.toList();

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        childrenPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 8,
        ),
        title: Text(
          '${localize("Previous versions")} (${history.length})',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        children: [
          Column(
            children:
                history.map((item) {
                  final statusDisplay = _deriveHistoryStatusDisplay(item);
                  final createdText = _formatTimestamp(item.createdOn);
                  final respondedText =
                      item.respondedTo != null &&
                              item.respondedTo!.trim().isNotEmpty
                          ? _formatTimestamp(item.respondedTo)
                          : null;

                  final userMessage =
                      (item.message != null && item.message!.trim().isNotEmpty)
                          ? item.message!.trim()
                          : localize('No message was recorded at this time.');

                  final adminResponse =
                      (item.reason != null && item.reason!.trim().isNotEmpty)
                          ? item.reason!.trim()
                          : localize('No response was recorded at this time.');

                  return Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: theme.colorScheme.surfaceVariant.withOpacity(0.3),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Top row: created + status + responded?
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                createdText,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
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
                        if (respondedText != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            '${localize("Responded")}: $respondedText',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.textTheme.bodySmall?.color
                                  ?.withOpacity(0.8),
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          '${localize("Your message")}:',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          userMessage,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.textTheme.bodySmall?.color
                                ?.withOpacity(0.85),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${localize("Admin response")}:',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(adminResponse, style: theme.textTheme.bodySmall),
                      ],
                    ),
                  );
                }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildNewRequestSection(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.message_outlined, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    localize('Need more help with this payment?'),
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              localize(
                'If you still need help with this payment, you can send a new refund request describing what you are asking for. This will not change the status of the current request.',
              ),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.textTheme.bodySmall?.color?.withOpacity(0.85),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _newMessageController,
              maxLines: 5,
              minLines: 3,
              decoration: InputDecoration(
                labelText: localize('New refund request message'),
                alignLabelWithHint: true,
                border: const OutlineInputBorder(),
              ),
            ),
            if (_submitError != null) ...[
              const SizedBox(height: 8),
              Text(
                _submitError!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ],
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                style: ButtonStyle(
                  backgroundColor: WidgetStatePropertyAll(theme.primaryColor),
                  foregroundColor: WidgetStatePropertyAll(Colors.white),
                ),
                onPressed: _submittingNew ? null : _handleSubmitNewRequest,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_submittingNew) ...[
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Text(localize('Submit New Refund Request')),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryRow({required this.label, required this.value});

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
