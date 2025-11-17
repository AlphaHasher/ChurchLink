// form.dart

/// Payment options a form can expose in its config.
enum FormPaymentOption { paypal, door }

FormPaymentOption? formPaymentOptionFromJson(String? value) {
  switch (value) {
    case 'paypal':
      return FormPaymentOption.paypal;
    case 'door':
      return FormPaymentOption.door;
    default:
      return null;
  }
}

String? formPaymentOptionToJson(FormPaymentOption? value) {
  if (value == null) return null;
  switch (value) {
    case FormPaymentOption.paypal:
      return 'paypal';
    case FormPaymentOption.door:
      return 'door';
  }
}

/// What a single submission’s payment looks like.
enum FormPaymentType { free, paypal, door }

FormPaymentType? formPaymentTypeFromJson(String? value) {
  switch (value) {
    case 'free':
      return FormPaymentType.free;
    case 'paypal':
      return FormPaymentType.paypal;
    case 'door':
      return FormPaymentType.door;
    default:
      return null;
  }
}

String? formPaymentTypeToJson(FormPaymentType? value) {
  if (value == null) return null;
  switch (value) {
    case FormPaymentType.free:
      return 'free';
    case FormPaymentType.paypal:
      return 'paypal';
    case FormPaymentType.door:
      return 'door';
  }
}

/// Payment details recorded for a single form response.
class FormResponsePaymentDetails {
  final FormPaymentType paymentType;
  final double price;
  final bool paymentComplete;
  final String? transactionId;
  final String? currency; // default "USD" server-side
  final double? capturedAmount;

  FormResponsePaymentDetails({
    required this.paymentType,
    required this.price,
    required this.paymentComplete,
    this.transactionId,
    this.currency,
    this.capturedAmount,
  });

  factory FormResponsePaymentDetails.fromJson(Map<String, dynamic> json) {
    return FormResponsePaymentDetails(
      paymentType:
          formPaymentTypeFromJson(json['payment_type'] as String?) ??
          FormPaymentType.free,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      paymentComplete: json['payment_complete'] as bool? ?? false,
      transactionId: json['transaction_id'] as String?,
      currency: json['currency'] as String?,
      capturedAmount: (json['captured_amount'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'payment_type': formPaymentTypeToJson(paymentType),
      'price': price,
      'payment_complete': paymentComplete,
      'transaction_id': transactionId,
      'currency': currency,
      'captured_amount': capturedAmount,
    };
  }
}

/// Dynamic JSON-based form field definition.
typedef FormSchemaField = Map<String, dynamic>;

/// Minimal localization code (e.g. "en", "en-US").
typedef LocaleCode = String;

/// Public/authoring-facing form.
class FormModel {
  final String id;
  final String title;
  final List<String> ministries;
  final String? description;
  final String userId;
  final bool visible;
  final String? slug;
  final List<FormSchemaField> data;
  final String? expiresAt;
  final String createdAt;
  final String updatedAt;
  final String? formWidth;
  final List<LocaleCode> supportedLocales;

  final double submissionPrice;
  final List<FormPaymentOption> paymentOptions;

  FormModel({
    required this.id,
    required this.title,
    required this.ministries,
    this.description,
    required this.userId,
    required this.visible,
    this.slug,
    required this.data,
    this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
    this.formWidth,
    required this.supportedLocales,
    required this.submissionPrice,
    required this.paymentOptions,
  });

  factory FormModel.fromJson(Map<String, dynamic> json) {
    return FormModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      ministries:
          (json['ministries'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList(),
      description: json['description'] as String?,
      userId: json['user_id'] as String? ?? '',
      visible: json['visible'] as bool? ?? false,
      slug: json['slug'] as String?,
      data:
          (json['data'] as List<dynamic>? ?? [])
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList(),
      expiresAt: json['expires_at'] as String?,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
      formWidth: json['form_width'] as String?,
      supportedLocales:
          (json['supported_locales'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList(),
      submissionPrice: (json['submission_price'] as num?)?.toDouble() ?? 0.0,
      paymentOptions: _paymentOptionsFromJson(json['payment_options']),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'title': title,
      'ministries': ministries,
      'description': description,
      'user_id': userId,
      'visible': visible,
      'slug': slug,
      'data': data,
      'expires_at': expiresAt,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'form_width': formWidth,
      'supported_locales': supportedLocales,
      'submission_price': submissionPrice,
      'payment_options': paymentOptions.map(formPaymentOptionToJson).toList(),
    };
  }

  static List<FormPaymentOption> _paymentOptionsFromJson(dynamic value) {
    if (value == null) return <FormPaymentOption>[];
    final list = value as List<dynamic>;
    return list
        .map((e) => formPaymentOptionFromJson(e as String?))
        .whereType<FormPaymentOption>()
        .toList();
  }
}

/// Client payload for posting a response.
/// Arbitrary answers + a top-level `payment` object.
class FormSubmissionBody {
  final Map<String, dynamic> answers;
  final FormResponsePaymentDetails payment;

  FormSubmissionBody({required this.answers, required this.payment});

  factory FormSubmissionBody.fromJson(Map<String, dynamic> json) {
    final map = Map<String, dynamic>.from(json);
    final paymentJson = Map<String, dynamic>.from(
      (map.remove('payment') as Map?) ?? const {},
    );
    return FormSubmissionBody(
      answers: map,
      payment: FormResponsePaymentDetails.fromJson(paymentJson),
    );
  }

  Map<String, dynamic> toJson() {
    final data = Map<String, dynamic>.from(answers);
    data['payment'] = payment.toJson();
    return data;
  }
}

/// Standard success envelope from the legacy responses endpoint.
class FormSubmissionResult {
  final String message;
  final String responseId;

  FormSubmissionResult({required this.message, required this.responseId});

  factory FormSubmissionResult.fromJson(Map<String, dynamic> json) {
    return FormSubmissionResult(
      message: json['message'] as String? ?? '',
      responseId: json['response_id'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'message': message, 'response_id': responseId};
  }
}

/// Create-order response from /forms/payments/create.
class CreateFormOrderResponse {
  final String orderId;
  final Map<String, dynamic> paypal;
  final double amount;
  final String currency;

  CreateFormOrderResponse({
    required this.orderId,
    required this.paypal,
    required this.amount,
    required this.currency,
  });

  factory CreateFormOrderResponse.fromJson(Map<String, dynamic> json) {
    return CreateFormOrderResponse(
      orderId: json['order_id'] as String? ?? '',
      paypal: Map<String, dynamic>.from((json['paypal'] as Map?) ?? const {}),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'order_id': orderId,
      'paypal': paypal,
      'amount': amount,
      'currency': currency,
    };
  }
}

/// Legacy capture response from /forms/payments/capture.
class CaptureFormOrderResponse {
  final String orderId;
  final String status;
  final String? captureId;
  final double? capturedAmount;
  final Map<String, dynamic> paypal;

  CaptureFormOrderResponse({
    required this.orderId,
    required this.status,
    this.captureId,
    this.capturedAmount,
    required this.paypal,
  });

  factory CaptureFormOrderResponse.fromJson(Map<String, dynamic> json) {
    return CaptureFormOrderResponse(
      orderId: json['order_id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      captureId: json['capture_id'] as String?,
      capturedAmount: (json['captured_amount'] as num?)?.toDouble(),
      paypal: Map<String, dynamic>.from((json['paypal'] as Map?) ?? const {}),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'order_id': orderId,
      'status': status,
      'capture_id': captureId,
      'captured_amount': capturedAmount,
      'paypal': paypal,
    };
  }
}

/// Status for /forms/payments/capture-and-submit.
enum CaptureAndSubmitFormStatus {
  capturedAndSubmitted,
  alreadyCaptured,
  alreadyProcessed,
}

CaptureAndSubmitFormStatus? captureAndSubmitStatusFromJson(String? value) {
  switch (value) {
    case 'captured_and_submitted':
      return CaptureAndSubmitFormStatus.capturedAndSubmitted;
    case 'already_captured':
      return CaptureAndSubmitFormStatus.alreadyCaptured;
    case 'already_processed':
      return CaptureAndSubmitFormStatus.alreadyProcessed;
    default:
      return null;
  }
}

String? captureAndSubmitStatusToJson(CaptureAndSubmitFormStatus? value) {
  if (value == null) return null;
  switch (value) {
    case CaptureAndSubmitFormStatus.capturedAndSubmitted:
      return 'captured_and_submitted';
    case CaptureAndSubmitFormStatus.alreadyCaptured:
      return 'already_captured';
    case CaptureAndSubmitFormStatus.alreadyProcessed:
      return 'already_processed';
  }
}

/// Combined capture + submit response from /forms/payments/capture-and-submit.
class CaptureAndSubmitFormResponse {
  final CaptureAndSubmitFormStatus status;
  final String orderId;
  final String? transactionId;
  final Map<String, dynamic> response;

  CaptureAndSubmitFormResponse({
    required this.status,
    required this.orderId,
    this.transactionId,
    required this.response,
  });

  factory CaptureAndSubmitFormResponse.fromJson(Map<String, dynamic> json) {
    return CaptureAndSubmitFormResponse(
      status:
          captureAndSubmitStatusFromJson(json['status'] as String?) ??
          CaptureAndSubmitFormStatus.capturedAndSubmitted,
      orderId: json['order_id'] as String? ?? '',
      transactionId: json['transaction_id'] as String?,
      response: Map<String, dynamic>.from(
        (json['response'] as Map?) ?? const {},
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'status': captureAndSubmitStatusToJson(status),
      'order_id': orderId,
      'transaction_id': transactionId,
      'response': response,
    };
  }
}
