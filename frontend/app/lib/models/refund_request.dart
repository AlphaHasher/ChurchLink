// refund_request.dart
// Dart models for refund requests (user + shared core; no admin).

import 'transactions.dart';

enum RefundTxnKind { event, form }

RefundTxnKind? refundTxnKindFromJson(String? value) {
  switch (value) {
    case 'event':
      return RefundTxnKind.event;
    case 'form':
      return RefundTxnKind.form;
    default:
      return null;
  }
}

String? refundTxnKindToJson(RefundTxnKind? value) {
  if (value == null) return null;
  switch (value) {
    case RefundTxnKind.event:
      return 'event';
    case RefundTxnKind.form:
      return 'form';
  }
}

enum RefundRequestStatus { pending, resolved, unresolved, all }

RefundRequestStatus? refundRequestStatusFromJson(String? value) {
  switch (value) {
    case 'pending':
      return RefundRequestStatus.pending;
    case 'resolved':
      return RefundRequestStatus.resolved;
    case 'unresolved':
      return RefundRequestStatus.unresolved;
    case 'all':
      return RefundRequestStatus.all;
    default:
      return null;
  }
}

String? refundRequestStatusToJson(RefundRequestStatus? value) {
  if (value == null) return null;
  switch (value) {
    case RefundRequestStatus.pending:
      return 'pending';
    case RefundRequestStatus.resolved:
      return 'resolved';
    case RefundRequestStatus.unresolved:
      return 'unresolved';
    case RefundRequestStatus.all:
      return 'all';
  }
}

class RefundRequestHistoryItem {
  final String? message;
  final bool responded;
  final bool resolved;
  final String? reason;
  final String createdOn; // ISO timestamp
  final String? respondedTo; // ISO timestamp

  RefundRequestHistoryItem({
    this.message,
    required this.responded,
    required this.resolved,
    this.reason,
    required this.createdOn,
    this.respondedTo,
  });

  factory RefundRequestHistoryItem.fromJson(Map<String, dynamic> json) {
    return RefundRequestHistoryItem(
      message: json['message'] as String?,
      responded: json['responded'] as bool? ?? false,
      resolved: json['resolved'] as bool? ?? false,
      reason: json['reason'] as String?,
      createdOn: json['created_on'] as String? ?? '',
      respondedTo: json['responded_to'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'message': message,
      'responded': responded,
      'resolved': resolved,
      'reason': reason,
      'created_on': createdOn,
      'responded_to': respondedTo,
    };
  }
}

class RefundRequest {
  final String uid;
  final RefundTxnKind txnKind;
  final String txnId;

  final String message;

  final bool responded;
  final bool resolved;
  final String? reason;

  final String createdOn; // ISO timestamp
  final String? respondedTo; // ISO timestamp

  final List<RefundRequestHistoryItem> history;

  RefundRequest({
    required this.uid,
    required this.txnKind,
    required this.txnId,
    required this.message,
    required this.responded,
    required this.resolved,
    this.reason,
    required this.createdOn,
    this.respondedTo,
    required this.history,
  });

  factory RefundRequest.fromJson(Map<String, dynamic> json) {
    return RefundRequest(
      uid: json['uid'] as String? ?? '',
      txnKind:
          refundTxnKindFromJson(json['txn_kind'] as String?) ??
          RefundTxnKind.event,
      txnId: json['txn_id'] as String? ?? '',
      message: json['message'] as String? ?? '',
      responded: json['responded'] as bool? ?? false,
      resolved: json['resolved'] as bool? ?? false,
      reason: json['reason'] as String?,
      createdOn: json['created_on'] as String? ?? '',
      respondedTo: json['responded_to'] as String?,
      history:
          (json['history'] as List<dynamic>? ?? [])
              .map(
                (e) => RefundRequestHistoryItem.fromJson(
                  Map<String, dynamic>.from(e as Map),
                ),
              )
              .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'uid': uid,
      'txn_kind': refundTxnKindToJson(txnKind),
      'txn_id': txnId,
      'message': message,
      'responded': responded,
      'resolved': resolved,
      'reason': reason,
      'created_on': createdOn,
      'responded_to': respondedTo,
      'history': history.map((e) => e.toJson()).toList(),
    };
  }
}

// RefundRequest with attached transaction summary (as returned by the
// search endpoints).
class RefundRequestWithTransaction extends RefundRequest {
  final String id; // Mongo _id
  final TransactionSummary? transaction; // unified transaction payload

  RefundRequestWithTransaction({
    required this.id,
    required this.transaction,
    required String uid,
    required RefundTxnKind txnKind,
    required String txnId,
    required String message,
    required bool responded,
    required bool resolved,
    String? reason,
    required String createdOn,
    String? respondedTo,
    required List<RefundRequestHistoryItem> history,
  }) : super(
         uid: uid,
         txnKind: txnKind,
         txnId: txnId,
         message: message,
         responded: responded,
         resolved: resolved,
         reason: reason,
         createdOn: createdOn,
         respondedTo: respondedTo,
         history: history,
       );

  factory RefundRequestWithTransaction.fromJson(Map<String, dynamic> json) {
    final base = RefundRequest.fromJson(json);
    return RefundRequestWithTransaction(
      id: json['id'] as String? ?? '',
      transaction:
          json['transaction'] != null
              ? TransactionSummary.fromJson(
                Map<String, dynamic>.from(json['transaction'] as Map),
              )
              : null,
      uid: base.uid,
      txnKind: base.txnKind,
      txnId: base.txnId,
      message: base.message,
      responded: base.responded,
      resolved: base.resolved,
      reason: base.reason,
      createdOn: base.createdOn,
      respondedTo: base.respondedTo,
      history: base.history,
    );
  }

  @override
  Map<String, dynamic> toJson() {
    final data = super.toJson();
    data['id'] = id;
    data['transaction'] = transaction?.toJson();
    return data;
  }
}

// Payload for creating a refund request.
class CreateRefundRequestPayload {
  final RefundTxnKind txnKind;
  final String txnId;
  final String message;

  CreateRefundRequestPayload({
    required this.txnKind,
    required this.txnId,
    required this.message,
  });

  factory CreateRefundRequestPayload.fromJson(Map<String, dynamic> json) {
    return CreateRefundRequestPayload(
      txnKind:
          refundTxnKindFromJson(json['txn_kind'] as String?) ??
          RefundTxnKind.event,
      txnId: json['txn_id'] as String? ?? '',
      message: json['message'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'txn_kind': refundTxnKindToJson(txnKind),
      'txn_id': txnId,
      'message': message,
    };
  }
}

// Simple success envelope for create.
class CreateRefundRequestResponse {
  final bool success;
  final String? msg;

  CreateRefundRequestResponse({required this.success, this.msg});

  factory CreateRefundRequestResponse.fromJson(Map<String, dynamic> json) {
    return CreateRefundRequestResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'success': success, 'msg': msg};
  }
}

// Query params/body for "my refund requests" listing.
class MyRefundRequestSearchParams {
  final int? page; // 0-based
  final int? pageSize;
  final RefundRequestStatus? status;
  final RefundTxnKind? txnKind;

  MyRefundRequestSearchParams({
    this.page,
    this.pageSize,
    this.status,
    this.txnKind,
  });

  factory MyRefundRequestSearchParams.fromJson(Map<String, dynamic> json) {
    return MyRefundRequestSearchParams(
      page: (json['page'] as num?)?.toInt(),
      pageSize: (json['pageSize'] as num?)?.toInt(),
      status: refundRequestStatusFromJson(json['status'] as String?),
      txnKind: refundTxnKindFromJson(json['txn_kind'] as String?),
    );
  }

  Map<String, dynamic> toJson() {
    final data = <String, dynamic>{};
    if (page != null) data['page'] = page;
    if (pageSize != null) data['pageSize'] = pageSize;
    final statusStr = refundRequestStatusToJson(status);
    if (statusStr != null) data['status'] = statusStr;
    final kindStr = refundTxnKindToJson(txnKind);
    if (kindStr != null) data['txn_kind'] = kindStr;
    return data;
  }
}

// Paged results envelope for refund requests.
class RefundRequestPagedResults {
  final List<RefundRequestWithTransaction> items;
  final int total;
  final int page;
  final int pageSize;

  RefundRequestPagedResults({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  factory RefundRequestPagedResults.fromJson(Map<String, dynamic> json) {
    return RefundRequestPagedResults(
      items:
          (json['items'] as List<dynamic>? ?? [])
              .map(
                (e) => RefundRequestWithTransaction.fromJson(
                  Map<String, dynamic>.from(e as Map),
                ),
              )
              .toList(),
      total: (json['total'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 0,
      pageSize: (json['pageSize'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((e) => e.toJson()).toList(),
      'total': total,
      'page': page,
      'pageSize': pageSize,
    };
  }
}
