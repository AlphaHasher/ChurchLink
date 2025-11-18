// transactions.dart
// Dart models for unified transactions (non-admin).

import 'package:app/models/donations.dart';

enum TransactionKind {
  donationOneTime,
  donationSubscription,
  donationSubscriptionPayment,
  event,
  form,
}

TransactionKind? transactionKindFromJson(String? value) {
  switch (value) {
    case 'donation_one_time':
      return TransactionKind.donationOneTime;
    case 'donation_subscription':
      return TransactionKind.donationSubscription;
    case 'donation_subscription_payment':
      return TransactionKind.donationSubscriptionPayment;
    case 'event':
      return TransactionKind.event;
    case 'form':
      return TransactionKind.form;
    default:
      return null;
  }
}

String? transactionKindToJson(TransactionKind? value) {
  if (value == null) return null;
  switch (value) {
    case TransactionKind.donationOneTime:
      return 'donation_one_time';
    case TransactionKind.donationSubscription:
      return 'donation_subscription';
    case TransactionKind.donationSubscriptionPayment:
      return 'donation_subscription_payment';
    case TransactionKind.event:
      return 'event';
    case TransactionKind.form:
      return 'form';
  }
}

enum TransactionSortMode { createdDesc, createdAsc }

TransactionSortMode? transactionSortModeFromJson(String? value) {
  switch (value) {
    case 'created_desc':
      return TransactionSortMode.createdDesc;
    case 'created_asc':
      return TransactionSortMode.createdAsc;
    default:
      return null;
  }
}

String? transactionSortModeToJson(TransactionSortMode? value) {
  if (value == null) return null;
  switch (value) {
    case TransactionSortMode.createdDesc:
      return 'created_desc';
    case TransactionSortMode.createdAsc:
      return 'created_asc';
  }
}

// Represented on the wire as simple currency strings (e.g. "USD").
typedef TransactionCurrency = String;

class TransactionRefundEntry {
  final String? refundId;
  final double amount;
  final TransactionCurrency? currency;
  final String? reason;
  final String? createdAt;
  final String? byUid;
  final String? source;
  final String? lineId;
  final String? personId;
  final String? personDisplayName;

  TransactionRefundEntry({
    this.refundId,
    required this.amount,
    this.currency,
    this.reason,
    this.createdAt,
    this.byUid,
    this.source,
    this.lineId,
    this.personId,
    this.personDisplayName,
  });

  factory TransactionRefundEntry.fromJson(Map<String, dynamic> json) {
    return TransactionRefundEntry(
      refundId: json['refund_id'] as String?,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String?,
      reason: json['reason'] as String?,
      createdAt: json['created_at'] as String?,
      byUid: json['by_uid'] as String?,
      source: json['source'] as String?,
      lineId: json['line_id'] as String?,
      personId: json['person_id'] as String?,
      personDisplayName: json['person_display_name'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'refund_id': refundId,
      'amount': amount,
      'currency': currency,
      'reason': reason,
      'created_at': createdAt,
      'by_uid': byUid,
      'source': source,
      'line_id': lineId,
      'person_id': personId,
      'person_display_name': personDisplayName,
    };
  }
}

class TransactionSearchParams {
  // Which kinds of transactions to include; null => "all kinds".
  final List<TransactionKind>? kinds;

  // Underlying ledger statuses ("created", "captured", "failed", etc).
  final List<String>? statuses;

  // PayPal identifiers.
  final String? paypalOrderId;
  final String? paypalCaptureId;
  final String? paypalSubscriptionId;

  // Created_at time range; ISO 8601 strings.
  final String? createdFrom;
  final String? createdTo;

  // Pagination (1-based page index).
  final int? page;
  final int? pageSize;

  // Sorting; defaults to "created_desc" when omitted.
  final TransactionSortMode? sort;

  // If true, backend will include raw DB doc per item.
  final bool? includeRaw;

  TransactionSearchParams({
    this.kinds,
    this.statuses,
    this.paypalOrderId,
    this.paypalCaptureId,
    this.paypalSubscriptionId,
    this.createdFrom,
    this.createdTo,
    this.page,
    this.pageSize,
    this.sort,
    this.includeRaw,
  });

  factory TransactionSearchParams.fromJson(Map<String, dynamic> json) {
    return TransactionSearchParams(
      kinds:
          (json['kinds'] as List<dynamic>?)
              ?.map((e) => transactionKindFromJson(e as String?))
              .whereType<TransactionKind>()
              .toList(),
      statuses:
          (json['statuses'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList(),
      paypalOrderId: json['paypal_order_id'] as String?,
      paypalCaptureId: json['paypal_capture_id'] as String?,
      paypalSubscriptionId: json['paypal_subscription_id'] as String?,
      createdFrom: json['created_from'] as String?,
      createdTo: json['created_to'] as String?,
      page: (json['page'] as num?)?.toInt(),
      pageSize: (json['page_size'] as num?)?.toInt(),
      sort: transactionSortModeFromJson(json['sort'] as String?),
      includeRaw: json['include_raw'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    final data = <String, dynamic>{};
    if (kinds != null) {
      data['kinds'] = kinds!.map(transactionKindToJson).toList();
    }
    if (statuses != null) data['statuses'] = statuses;
    if (paypalOrderId != null) data['paypal_order_id'] = paypalOrderId;
    if (paypalCaptureId != null) data['paypal_capture_id'] = paypalCaptureId;
    if (paypalSubscriptionId != null) {
      data['paypal_subscription_id'] = paypalSubscriptionId;
    }
    if (createdFrom != null) data['created_from'] = createdFrom;
    if (createdTo != null) data['created_to'] = createdTo;
    if (page != null) data['page'] = page;
    if (pageSize != null) data['page_size'] = pageSize;
    final sortStr = transactionSortModeToJson(sort);
    if (sortStr != null) data['sort'] = sortStr;
    if (includeRaw != null) data['include_raw'] = includeRaw;
    return data;
  }
}

// Optional structured views over the `extra` blob for consumers that want them.

class DonationTransactionExtra {
  final String? message;
  final Map<String, dynamic>? meta;

  DonationTransactionExtra({this.message, this.meta});

  factory DonationTransactionExtra.fromJson(Map<String, dynamic> json) {
    return DonationTransactionExtra(
      message: json['message'] as String?,
      meta:
          json['meta'] != null
              ? Map<String, dynamic>.from(json['meta'] as Map)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'message': message, 'meta': meta};
  }
}

class DonationSubscriptionExtra {
  final DonationInterval? interval;
  final String? message;
  final Map<String, dynamic>? meta;

  DonationSubscriptionExtra({this.interval, this.message, this.meta});

  factory DonationSubscriptionExtra.fromJson(Map<String, dynamic> json) {
    return DonationSubscriptionExtra(
      interval: donationIntervalFromJson(json['interval'] as String?),
      message: json['message'] as String?,
      meta:
          json['meta'] != null
              ? Map<String, dynamic>.from(json['meta'] as Map)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'interval': donationIntervalToJson(interval),
      'message': message,
      'meta': meta,
    };
  }
}

class EventTransactionExtra {
  final String? eventId;
  final String? eventInstanceId;
  final int? itemsCount;
  final Map<String, dynamic>? meta;

  EventTransactionExtra({
    this.eventId,
    this.eventInstanceId,
    this.itemsCount,
    this.meta,
  });

  factory EventTransactionExtra.fromJson(Map<String, dynamic> json) {
    return EventTransactionExtra(
      eventId: json['event_id'] as String?,
      eventInstanceId: json['event_instance_id'] as String?,
      itemsCount: (json['items_count'] as num?)?.toInt(),
      meta:
          json['meta'] != null
              ? Map<String, dynamic>.from(json['meta'] as Map)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'event_id': eventId,
      'event_instance_id': eventInstanceId,
      'items_count': itemsCount,
      'meta': meta,
    };
  }
}

class FormTransactionExtra {
  final String? formId;
  final Map<String, dynamic>? meta;

  FormTransactionExtra({this.formId, this.meta});

  factory FormTransactionExtra.fromJson(Map<String, dynamic> json) {
    return FormTransactionExtra(
      formId: json['form_id'] as String?,
      meta:
          json['meta'] != null
              ? Map<String, dynamic>.from(json['meta'] as Map)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'form_id': formId, 'meta': meta};
  }
}

class DonationSubscriptionPaymentExtra {
  final String? subscriptionId;
  final Map<String, dynamic>? meta;

  DonationSubscriptionPaymentExtra({this.subscriptionId, this.meta});

  factory DonationSubscriptionPaymentExtra.fromJson(Map<String, dynamic> json) {
    return DonationSubscriptionPaymentExtra(
      subscriptionId: json['subscription_id'] as String?,
      meta:
          json['meta'] != null
              ? Map<String, dynamic>.from(json['meta'] as Map)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'subscription_id': subscriptionId, 'meta': meta};
  }
}

enum TransactionSourceCollection {
  donationTransactions,
  donationSubscriptions,
  eventTransactions,
  formTransactions,
  donationSubscriptionPayments,
}

TransactionSourceCollection? transactionSourceCollectionFromJson(
  String? value,
) {
  switch (value) {
    case 'donation_transactions':
      return TransactionSourceCollection.donationTransactions;
    case 'donation_subscriptions':
      return TransactionSourceCollection.donationSubscriptions;
    case 'event_transactions':
      return TransactionSourceCollection.eventTransactions;
    case 'form_transactions':
      return TransactionSourceCollection.formTransactions;
    case 'donation_subscription_payments':
      return TransactionSourceCollection.donationSubscriptionPayments;
    default:
      return null;
  }
}

String? transactionSourceCollectionToJson(TransactionSourceCollection? value) {
  if (value == null) return null;
  switch (value) {
    case TransactionSourceCollection.donationTransactions:
      return 'donation_transactions';
    case TransactionSourceCollection.donationSubscriptions:
      return 'donation_subscriptions';
    case TransactionSourceCollection.eventTransactions:
      return 'event_transactions';
    case TransactionSourceCollection.formTransactions:
      return 'form_transactions';
    case TransactionSourceCollection.donationSubscriptionPayments:
      return 'donation_subscription_payments';
  }
}

class TransactionSummary {
  final String id;
  final TransactionKind kind;

  final String? createdAt;
  final String? updatedAt;
  final String? status;

  final double? amount;
  final TransactionCurrency? currency;

  final double? grossAmount;
  final double? feeAmount;
  final double? netAmountBeforeRefunds;

  final double? refundedTotal;
  final double? netAmount;

  final List<TransactionRefundEntry>? refunds;

  final String? userUid;

  final String? paypalOrderId;
  final String? paypalCaptureId;
  final String? paypalSubscriptionId;

  final TransactionSourceCollection sourceCollection;

  final Map<String, dynamic>? extra;
  final Map<String, dynamic>? raw;

  TransactionSummary({
    required this.id,
    required this.kind,
    this.createdAt,
    this.updatedAt,
    this.status,
    this.amount,
    this.currency,
    this.grossAmount,
    this.feeAmount,
    this.netAmountBeforeRefunds,
    this.refundedTotal,
    this.netAmount,
    this.refunds,
    this.userUid,
    this.paypalOrderId,
    this.paypalCaptureId,
    this.paypalSubscriptionId,
    required this.sourceCollection,
    this.extra,
    this.raw,
  });

  factory TransactionSummary.fromJson(Map<String, dynamic> json) {
    return TransactionSummary(
      id: json['id'] as String? ?? '',
      kind:
          transactionKindFromJson(json['kind'] as String?) ??
          TransactionKind.event,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
      status: json['status'] as String?,
      amount: (json['amount'] as num?)?.toDouble(),
      currency: json['currency'] as String?,
      grossAmount: (json['gross_amount'] as num?)?.toDouble(),
      feeAmount: (json['fee_amount'] as num?)?.toDouble(),
      netAmountBeforeRefunds:
          (json['net_amount_before_refunds'] as num?)?.toDouble(),
      refundedTotal: (json['refunded_total'] as num?)?.toDouble(),
      netAmount: (json['net_amount'] as num?)?.toDouble(),
      refunds:
          (json['refunds'] as List<dynamic>?)
              ?.map(
                (e) => TransactionRefundEntry.fromJson(
                  Map<String, dynamic>.from(e as Map),
                ),
              )
              .toList(),
      userUid: json['user_uid'] as String?,
      paypalOrderId: json['paypal_order_id'] as String?,
      paypalCaptureId: json['paypal_capture_id'] as String?,
      paypalSubscriptionId: json['paypal_subscription_id'] as String?,
      sourceCollection:
          transactionSourceCollectionFromJson(
            json['source_collection'] as String?,
          ) ??
          TransactionSourceCollection.donationTransactions,
      extra:
          json['extra'] != null
              ? Map<String, dynamic>.from(json['extra'] as Map)
              : null,
      raw:
          json['raw'] != null
              ? Map<String, dynamic>.from(json['raw'] as Map)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'kind': transactionKindToJson(kind),
      'created_at': createdAt,
      'updated_at': updatedAt,
      'status': status,
      'amount': amount,
      'currency': currency,
      'gross_amount': grossAmount,
      'fee_amount': feeAmount,
      'net_amount_before_refunds': netAmountBeforeRefunds,
      'refunded_total': refundedTotal,
      'net_amount': netAmount,
      'refunds': refunds?.map((e) => e.toJson()).toList(),
      'user_uid': userUid,
      'paypal_order_id': paypalOrderId,
      'paypal_capture_id': paypalCaptureId,
      'paypal_subscription_id': paypalSubscriptionId,
      'source_collection': transactionSourceCollectionToJson(sourceCollection),
      'extra': extra,
      'raw': raw,
    };
  }
}

class TransactionsResults {
  final List<TransactionSummary> items;
  final int page;
  final int pageSize;
  final bool hasMore;
  final int? nextPage;
  final Map<String, dynamic>? counts;

  TransactionsResults({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.hasMore,
    this.nextPage,
    this.counts,
  });

  factory TransactionsResults.fromJson(Map<String, dynamic> json) {
    return TransactionsResults(
      items:
          (json['items'] as List<dynamic>? ?? [])
              .map(
                (e) => TransactionSummary.fromJson(
                  Map<String, dynamic>.from(e as Map),
                ),
              )
              .toList(),
      page: (json['page'] as num?)?.toInt() ?? 0,
      pageSize: (json['page_size'] as num?)?.toInt() ?? 0,
      hasMore: json['has_more'] as bool? ?? false,
      nextPage: (json['next_page'] as num?)?.toInt(),
      counts:
          json['counts'] != null
              ? Map<String, dynamic>.from(json['counts'] as Map)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((e) => e.toJson()).toList(),
      'page': page,
      'page_size': pageSize,
      'has_more': hasMore,
      'next_page': nextPage,
      'counts': counts,
    };
  }
}

// Convenience alias mirroring the TS type for user transactions.
typedef UserTransactionsResults = TransactionsResults;
