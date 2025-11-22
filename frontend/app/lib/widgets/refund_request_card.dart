import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/my_transactions_formatting.dart';
import 'package:app/helpers/time_formatter.dart';
import 'package:app/models/refund_request.dart';

class RefundRequestCard extends StatelessWidget {
  final RefundRequestWithTransaction request;
  final VoidCallback? onTap;

  const RefundRequestCard({super.key, required this.request, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    final tx = request.transaction;

    final String typeLabel =
        tx != null
            ? formatKindWithExtras(tx)
            : request.txnKind == RefundTxnKind.event
            ? localize('Event payment')
            : localize('Form payment');

    final String createdText = formatRefundRequestDate(request.createdOn);
    final String? respondedText =
        (request.respondedTo != null && request.respondedTo!.trim().isNotEmpty)
            ? formatRefundRequestDate(request.respondedTo!)
            : null;

    final StatusDisplay statusDisplay = statusDisplayForRefundRequest(request);

    final String messageFull = request.message.trim();
    final String messageSnippet =
        messageFull.isEmpty
            ? localize('No message provided.')
            : (messageFull.length > 180
                ? '${messageFull.substring(0, 177)}...'
                : messageFull);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
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
                  _iconForKind(request.txnKind),
                  size: 26,
                  color: theme.colorScheme.primary,
                ),
              ),
              // Main content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // First row: type + status pill
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                typeLabel,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                createdText,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  fontSize: 12,
                                  color: theme.colorScheme.onSurface.withValues(
                                    alpha: 0.7,
                                  ),
                                ),
                              ),
                            ],
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
                    const SizedBox(height: 8),
                    // Message snippet
                    Text(
                      messageSnippet,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurface.withValues(
                          alpha: 0.85,
                        ),
                      ),
                    ),
                    if (respondedText != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${localize("Responded")}: $respondedText',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontSize: 12,
                          color: theme.colorScheme.onSurface.withValues(
                            alpha: 0.7,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

IconData _iconForKind(RefundTxnKind kind) {
  switch (kind) {
    case RefundTxnKind.event:
      return Icons.event_repeat_outlined;
    case RefundTxnKind.form:
      return Icons.article_outlined;
  }
}

/// Short date formatter for refund cards (no time-of-day).
String formatRefundRequestDate(String? iso) {
  if (iso == null || iso.trim().isEmpty) return '—';

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

  return '$month $day, $year';
}

/// Map the refund request's responded/resolved flags into a StatusDisplay.
StatusDisplay statusDisplayForRefundRequest(RefundRequest request) {
  if (!request.responded) {
    return StatusDisplay(
      label: 'Pending',
      backgroundColor: const Color(0xFFFFF8E1),
      textColor: const Color(0xFFFFA000),
    );
  }
  if (request.resolved) {
    return StatusDisplay(
      label: 'Resolved',
      backgroundColor: const Color(0xFFE8F5E9),
      textColor: const Color(0xFF2E7D32),
    );
  }
  return StatusDisplay(
    label: 'Unresolved',
    backgroundColor: const Color(0xFFECEFF1),
    textColor: const Color(0xFF455A64),
  );
}
