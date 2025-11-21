// donations.dart

/// Supported donation currencies.
enum DonationCurrency { usd }

DonationCurrency? donationCurrencyFromJson(String? value) {
  switch (value) {
    case 'USD':
      return DonationCurrency.usd;
    default:
      return null;
  }
}

String? donationCurrencyToJson(DonationCurrency? value) {
  if (value == null) return null;
  switch (value) {
    case DonationCurrency.usd:
      return 'USD';
  }
}

/// Interval for recurring donations.
enum DonationInterval { week, month, year }

DonationInterval? donationIntervalFromJson(String? value) {
  switch (value) {
    case 'WEEK':
      return DonationInterval.week;
    case 'MONTH':
      return DonationInterval.month;
    case 'YEAR':
      return DonationInterval.year;
    default:
      return null;
  }
}

String? donationIntervalToJson(DonationInterval? value) {
  if (value == null) return null;
  switch (value) {
    case DonationInterval.week:
      return 'WEEK';
    case DonationInterval.month:
      return 'MONTH';
    case DonationInterval.year:
      return 'YEAR';
  }
}

/// Status for capturing a one-time donation.
enum CaptureOneTimeDonationStatus { captured, alreadyCaptured }

CaptureOneTimeDonationStatus? captureStatusFromJson(String? value) {
  switch (value) {
    case 'captured':
      return CaptureOneTimeDonationStatus.captured;
    case 'already_captured':
      return CaptureOneTimeDonationStatus.alreadyCaptured;
    default:
      return null;
  }
}

String? captureStatusToJson(CaptureOneTimeDonationStatus? value) {
  if (value == null) return null;
  switch (value) {
    case CaptureOneTimeDonationStatus.captured:
      return 'captured';
    case CaptureOneTimeDonationStatus.alreadyCaptured:
      return 'already_captured';
  }
}

/// Status for a recurring donation subscription.
enum DonationSubscriptionStatus {
  approvalPending,
  active,
  suspended,
  cancelled,
  expired,
}

DonationSubscriptionStatus? donationSubscriptionStatusFromJson(String? value) {
  switch (value) {
    case 'APPROVAL_PENDING':
      return DonationSubscriptionStatus.approvalPending;
    case 'ACTIVE':
      return DonationSubscriptionStatus.active;
    case 'SUSPENDED':
      return DonationSubscriptionStatus.suspended;
    case 'CANCELLED':
      return DonationSubscriptionStatus.cancelled;
    case 'EXPIRED':
      return DonationSubscriptionStatus.expired;
    default:
      return null;
  }
}

String? donationSubscriptionStatusToJson(DonationSubscriptionStatus? value) {
  if (value == null) return null;
  switch (value) {
    case DonationSubscriptionStatus.approvalPending:
      return 'APPROVAL_PENDING';
    case DonationSubscriptionStatus.active:
      return 'ACTIVE';
    case DonationSubscriptionStatus.suspended:
      return 'SUSPENDED';
    case DonationSubscriptionStatus.cancelled:
      return 'CANCELLED';
    case DonationSubscriptionStatus.expired:
      return 'EXPIRED';
  }
}

// ----------------------------------------------------------
// User-facing one-time donations
// ----------------------------------------------------------

class CreateOneTimeDonationRequest {
  final double amount;
  final DonationCurrency? currency;
  final String? message;

  CreateOneTimeDonationRequest({
    required this.amount,
    this.currency,
    this.message,
  });

  factory CreateOneTimeDonationRequest.fromJson(Map<String, dynamic> json) {
    return CreateOneTimeDonationRequest(
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: donationCurrencyFromJson(json['currency'] as String?),
      message: json['message'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'amount': amount,
      'currency': donationCurrencyToJson(currency),
      'message': message,
    };
  }
}

class CreateOneTimeDonationResponse {
  final bool success;
  final String? msg;
  final String? orderId;
  final String? approveUrl;

  CreateOneTimeDonationResponse({
    required this.success,
    this.msg,
    this.orderId,
    this.approveUrl,
  });

  factory CreateOneTimeDonationResponse.fromJson(Map<String, dynamic> json) {
    return CreateOneTimeDonationResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
      orderId: json['order_id'] as String?,
      approveUrl: json['approve_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'order_id': orderId,
      'approve_url': approveUrl,
    };
  }
}

class CaptureOneTimeDonationRequest {
  final String orderId;

  CaptureOneTimeDonationRequest({required this.orderId});

  factory CaptureOneTimeDonationRequest.fromJson(Map<String, dynamic> json) {
    return CaptureOneTimeDonationRequest(
      orderId: json['order_id'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'order_id': orderId};
  }
}

class CaptureOneTimeDonationResponse {
  final bool success;
  final String? msg;
  final CaptureOneTimeDonationStatus? status;
  final String? orderId;
  final String? captureId;
  final double? capturedAmount;
  final DonationCurrency? currency;

  CaptureOneTimeDonationResponse({
    required this.success,
    this.msg,
    this.status,
    this.orderId,
    this.captureId,
    this.capturedAmount,
    this.currency,
  });

  factory CaptureOneTimeDonationResponse.fromJson(Map<String, dynamic> json) {
    return CaptureOneTimeDonationResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
      status: captureStatusFromJson(json['status'] as String?),
      orderId: json['order_id'] as String?,
      captureId: json['capture_id'] as String?,
      capturedAmount: (json['captured_amount'] as num?)?.toDouble(),
      currency: donationCurrencyFromJson(json['currency'] as String?),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'status': captureStatusToJson(status),
      'order_id': orderId,
      'capture_id': captureId,
      'captured_amount': capturedAmount,
      'currency': donationCurrencyToJson(currency),
    };
  }
}

// ----------------------------------------------------------
// User-facing recurring donations
// ----------------------------------------------------------

class CreateDonationSubscriptionRequest {
  final double amount;
  final DonationCurrency? currency;
  final DonationInterval interval;
  final String? message;

  CreateDonationSubscriptionRequest({
    required this.amount,
    this.currency,
    required this.interval,
    this.message,
  });

  factory CreateDonationSubscriptionRequest.fromJson(
    Map<String, dynamic> json,
  ) {
    return CreateDonationSubscriptionRequest(
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: donationCurrencyFromJson(json['currency'] as String?),
      interval:
          donationIntervalFromJson(json['interval'] as String?) ??
          DonationInterval.month,
      message: json['message'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'amount': amount,
      'currency': donationCurrencyToJson(currency),
      'interval': donationIntervalToJson(interval),
      'message': message,
    };
  }
}

class CreateDonationSubscriptionResponse {
  final bool success;
  final String? msg;
  final String? subscriptionId;
  final DonationSubscriptionStatus? status;
  final String? approveUrl;

  CreateDonationSubscriptionResponse({
    required this.success,
    this.msg,
    this.subscriptionId,
    this.status,
    this.approveUrl,
  });

  factory CreateDonationSubscriptionResponse.fromJson(
    Map<String, dynamic> json,
  ) {
    return CreateDonationSubscriptionResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
      subscriptionId: json['subscription_id'] as String?,
      status: donationSubscriptionStatusFromJson(json['status'] as String?),
      approveUrl: json['approve_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'subscription_id': subscriptionId,
      'status': donationSubscriptionStatusToJson(status),
      'approve_url': approveUrl,
    };
  }
}

class CancelDonationSubscriptionRequest {
  final String subscriptionId;

  CancelDonationSubscriptionRequest({required this.subscriptionId});

  factory CancelDonationSubscriptionRequest.fromJson(
    Map<String, dynamic> json,
  ) {
    return CancelDonationSubscriptionRequest(
      subscriptionId: json['subscription_id'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'subscription_id': subscriptionId};
  }
}

class CancelDonationSubscriptionResponse {
  final bool success;
  final String? msg;
  final DonationSubscriptionStatus? status;

  CancelDonationSubscriptionResponse({
    required this.success,
    this.msg,
    this.status,
  });

  factory CancelDonationSubscriptionResponse.fromJson(
    Map<String, dynamic> json,
  ) {
    return CancelDonationSubscriptionResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
      status: donationSubscriptionStatusFromJson(json['status'] as String?),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'status': donationSubscriptionStatusToJson(status),
    };
  }
}
