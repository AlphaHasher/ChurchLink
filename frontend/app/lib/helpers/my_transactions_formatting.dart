import 'package:flutter/material.dart';

import 'package:app/models/transactions.dart';

/// Display info for a status pill.
class StatusDisplay {
  final String label;
  final Color backgroundColor;
  final Color textColor;

  const StatusDisplay({
    required this.label,
    required this.backgroundColor,
    required this.textColor,
  });
}

/// Status filter option – mirrors the TS StatusFilterOption:
/// - [id]: stable identifier for UI (e.g. "all", "paid", "active")
/// - [label]: human-readable label (pass through localization in the UI)
/// - [statuses]: raw backend status values to send to the API
class StatusFilterOption {
  final String id;
  final String label;
  final List<String> statuses;

  const StatusFilterOption({
    required this.id,
    required this.label,
    required this.statuses,
  });
}

/// Format a transaction "kind" into a user-facing label, using information
/// from [TransactionSummary.extra] when available.
///
/// Mirrors MyTransactionsFormatting.formatKindWithExtras on web.
String formatKindWithExtras(TransactionSummary? row) {
  if (row == null) return '';
  final kind = row.kind;
  final extra = row.extra ?? const <String, dynamic>{};

  if (kind == TransactionKind.donationSubscription) {
    // Interval can live directly in extra.interval or under extra.meta.interval /
    // extra.meta.billing_cycle depending on backend shape.
    String? rawInterval = extra['interval'] as String?;
    final meta = extra['meta'];
    if (rawInterval == null && meta is Map<String, dynamic>) {
      rawInterval =
          (meta['interval'] as String?) ?? (meta['billing_cycle'] as String?);
    }

    if (rawInterval == null || rawInterval.trim().isEmpty) {
      return 'Donation Plan';
    }

    final s = rawInterval.toLowerCase();
    String pretty;
    if (s.startsWith('week')) {
      pretty = 'Weekly';
    } else if (s.startsWith('month')) {
      pretty = 'Monthly';
    } else if (s.startsWith('year') || s.startsWith('annual')) {
      pretty = 'Yearly';
    } else if (s == 'day' || s.startsWith('daily')) {
      pretty = 'Daily';
    } else if (s.isNotEmpty) {
      pretty = s[0].toUpperCase() + s.substring(1);
    } else {
      pretty = 'Custom';
    }

    return 'Donation Plan ($pretty)';
  }

  if (kind == TransactionKind.donationSubscriptionPayment) {
    return 'Donation Plan Payment';
  }

  switch (kind) {
    case TransactionKind.donationOneTime:
      return 'Donation';
    case TransactionKind.event:
      return 'Event Payment';
    case TransactionKind.form:
      return 'Form Payment';
    case TransactionKind.donationSubscription:
    case TransactionKind.donationSubscriptionPayment:
      // Handled above – this is just to keep the switch exhaustive.
      return 'Donation';
  }
}

/// Unified status → label + colors for status pill.
///
/// Mirrors MyTransactionsFormatting.getStatusDisplay.
/// Labels are plain English; let the UI run them through localization.
StatusDisplay getStatusDisplay(String? statusRaw, TransactionKind? kind) {
  if (statusRaw == null || statusRaw.isEmpty) {
    return StatusDisplay(
      label: 'Unknown',
      backgroundColor: Colors.grey.shade100,
      textColor: Colors.grey.shade700,
    );
  }

  final s = statusRaw.toUpperCase();

  // Subscription "plan" statuses (the recurring donation itself)
  if (kind == TransactionKind.donationSubscription) {
    switch (s) {
      case 'APPROVAL_PENDING':
        return StatusDisplay(
          label: 'Awaiting Approval',
          backgroundColor: Colors.amber.shade50,
          textColor: Colors.amber.shade700,
        );
      case 'ACTIVE':
        return StatusDisplay(
          label: 'Active',
          backgroundColor: Colors.green.shade50,
          textColor: Colors.green.shade700,
        );
      case 'SUSPENDED':
        return StatusDisplay(
          label: 'Suspended',
          backgroundColor: Colors.amber.shade50,
          textColor: Colors.amber.shade700,
        );
      case 'CANCELLED':
      case 'CANCELED':
        return StatusDisplay(
          label: 'Cancelled',
          backgroundColor: Colors.grey.shade100,
          textColor: Colors.grey.shade700,
        );
      case 'EXPIRED':
        return StatusDisplay(
          label: 'Expired',
          backgroundColor: Colors.grey.shade100,
          textColor: Colors.grey.shade700,
        );
      default:
        // Fall through to generic one-off mapping below if we don't recognize it.
        break;
    }
  }

  // One-off payments (including donation_subscription_payment)
  switch (s) {
    case 'CAPTURED':
    case 'COMPLETED': // PayPal subscription charge statuses too
      return StatusDisplay(
        label: 'Paid',
        backgroundColor: Colors.green.shade50,
        textColor: Colors.green.shade700,
      );
    case 'FULLY_REFUNDED':
    case 'REFUNDED':
      return StatusDisplay(
        label: 'Refunded',
        backgroundColor: Colors.lightBlue.shade50,
        textColor: Colors.lightBlue.shade700,
      );
    case 'PARTIALLY_REFUNDED':
      return StatusDisplay(
        label: 'Partially Refunded',
        backgroundColor: Colors.amber.shade50,
        textColor: Colors.amber.shade700,
      );
    case 'FAILED':
    case 'DENIED':
      return StatusDisplay(
        label: 'Failed',
        backgroundColor: Colors.red.shade50,
        textColor: Colors.red.shade700,
      );
    case 'PENDING':
    case 'CREATED':
      return StatusDisplay(
        label: 'Pending',
        backgroundColor: Colors.amber.shade50,
        textColor: Colors.amber.shade700,
      );
    default:
      return StatusDisplay(
        label: statusRaw,
        backgroundColor: Colors.grey.shade50,
        textColor: Colors.grey.shade700,
      );
  }
}

/// Status filter options for payments.
///
/// `statuses` are raw backend status values sent to the API.
const List<StatusFilterOption> paymentStatusOptions = [
  StatusFilterOption(id: 'all', label: 'All statuses', statuses: []),

  // Funds successfully captured / completed
  StatusFilterOption(
    id: 'paid',
    label: 'Paid',
    statuses: [
      'captured', // donations/forms/events
      'completed', // PayPal sale state, lowercase
      'COMPLETED', // PayPal sale state, uppercase
    ],
  ),

  // Created / approved / still in flight
  StatusFilterOption(
    id: 'pending',
    label: 'Pending',
    statuses: ['created', 'approved', 'pending', 'PENDING', 'APPROVAL_PENDING'],
  ),

  // Failed / denied / voided
  StatusFilterOption(
    id: 'failed',
    label: 'Failed',
    statuses: ['failed', 'denied', 'DENIED', 'voided', 'VOIDED'],
  ),

  // Fully refunded (or “refunded” in simple ledgers)
  StatusFilterOption(
    id: 'refunded',
    label: 'Refunded',
    statuses: [
      'refunded', // donation/form future flow
      'fully_refunded', // event ledger
      'FULLY_REFUNDED',
      'REFUNDED',
    ],
  ),

  // Partially refunded
  StatusFilterOption(
    id: 'partially_refunded',
    label: 'Partially Refunded',
    statuses: [
      'partially_refunded', // event ledger
      'PARTIALLY_REFUNDED',
    ],
  ),
];

/// Status filter options for donation "plans" (recurring subscriptions).
const List<StatusFilterOption> planStatusOptions = [
  StatusFilterOption(id: 'all', label: 'All statuses', statuses: []),
  StatusFilterOption(
    id: 'approval_pending',
    label: 'Awaiting Approval',
    statuses: ['APPROVAL_PENDING'],
  ),
  StatusFilterOption(id: 'active', label: 'Active', statuses: ['ACTIVE']),
  StatusFilterOption(
    id: 'suspended',
    label: 'Suspended',
    statuses: ['SUSPENDED'],
  ),
  StatusFilterOption(
    id: 'cancelled',
    label: 'Cancelled',
    statuses: ['CANCELLED', 'CANCELED'],
  ),
  StatusFilterOption(id: 'expired', label: 'Expired', statuses: ['EXPIRED']),
];

/// Get status filter options based on the primary kind.
///
/// - When [kind] is [TransactionKind.donationSubscription], returns
///   the plan-specific options.
/// - When [kind] is any one-off kind (donations, events, forms),
///   returns payment options.
/// - When [kind] is null, returns a union of both families,
///   with a single "All statuses" entry.
List<StatusFilterOption> getStatusFilterOptionsForKind(TransactionKind? kind) {
  if (kind == TransactionKind.donationSubscription) {
    return planStatusOptions;
  }

  if (kind == TransactionKind.donationOneTime ||
      kind == TransactionKind.donationSubscriptionPayment ||
      kind == TransactionKind.event ||
      kind == TransactionKind.form) {
    return paymentStatusOptions;
  }

  // "all" kinds → union of both families, but keep a single "All statuses" entry
  return <StatusFilterOption>[
    paymentStatusOptions.first,
    ...paymentStatusOptions.skip(1),
    ...planStatusOptions.skip(1),
  ];
}

/// Convenience: compute the "net" amount the user effectively paid.
/// Mirrors getUserNet() from the web table:
///   net = amount - refunded_total
/// clamped to >= 0, or null if invalid.
double? getUserNet(TransactionSummary? row) {
  if (row == null) return null;
  final gross = row.amount;
  if (gross == null) return null;
  final refunded = row.refundedTotal ?? 0.0;
  final net = gross - refunded;
  if (!net.isFinite) return null;
  return net > 0 ? net : 0.0;
}
