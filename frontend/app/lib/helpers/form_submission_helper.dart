// lib/helpers/form_submission_helper.dart

import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/models/form.dart';

/// Helper for user-facing form submission & payment flows:
/// - Normalize payment details for any form (free / door / PayPal)
/// - Submit free / door forms via /v1/forms/slug/{slug}/responses
/// - Create PayPal orders for forms
/// - Capture + submit PayPal-backed form in a single call
///
/// This mirrors the semantics of FormSubmissionHelper.tsx,
/// minus admin-only endpoints and the legacy captureFormPaymentOrder.

class FormSubmissionHelper {
  FormSubmissionHelper._();

  // ---------------------------------------------------------------------------
  // Convenience helpers
  // ---------------------------------------------------------------------------

  /// Returns true if the given submission price represents a "free" form.
  /// A null or <= 0 price is treated as free.
  static bool isFreeFormPrice(double? submissionPrice) {
    return (submissionPrice ?? 0) <= 0;
  }

  /// Convenience: which payment methods are allowed?
  /// If the list is null, treat as no methods configured.
  static List<FormPaymentOption> allowedPaymentOptions(
    List<FormPaymentOption>? paymentOptions,
  ) {
    return paymentOptions ?? const <FormPaymentOption>[];
  }

  /// Build the normalized payment details the server expects on ALL submissions.
  ///
  /// This is the Dart port of normalizePaymentDetails() from TS:
  /// - If the effective price is <= 0, payment_type is forced to "free".
  /// - For paid forms, chosenType must be allowed; otherwise we fall back to:
  ///   - "paypal" if allowed
  ///   - otherwise "door"
  static FormResponsePaymentDetails normalizePaymentDetails({
    required double submissionPrice,
    required List<FormPaymentOption> paymentOptions,
    FormPaymentType? chosenType,
    String? transactionId,
    double? capturedAmount,
    String? currency,
    double? overridePrice,
  }) {
    final double price = overridePrice ?? submissionPrice;

    // Free forms: force payment_type "free" and mark complete
    if (isFreeFormPrice(price)) {
      return FormResponsePaymentDetails(
        paymentType: FormPaymentType.free,
        price: 0.0,
        paymentComplete: true,
        transactionId: null,
        currency: currency ?? 'USD',
        capturedAmount: 0.0,
      );
    }

    // Paid forms: must honor the form’s allowed options
    final allowed = allowedPaymentOptions(paymentOptions).toSet();

    FormPaymentType type;

    bool isAllowed(FormPaymentType t) {
      switch (t) {
        case FormPaymentType.paypal:
          return allowed.contains(FormPaymentOption.paypal);
        case FormPaymentType.door:
          return allowed.contains(FormPaymentOption.door);
        case FormPaymentType.free:
          // For paid forms we never intentionally use "free" here.
          return false;
      }
    }

    if (chosenType != null && isAllowed(chosenType)) {
      type = chosenType;
    } else if (allowed.contains(FormPaymentOption.paypal)) {
      type = FormPaymentType.paypal;
    } else {
      // Fallback: door payment
      type = FormPaymentType.door;
    }

    return FormResponsePaymentDetails(
      paymentType: type,
      price: price,
      paymentComplete: false,
      transactionId: transactionId,
      currency: currency ?? 'USD',
      capturedAmount: capturedAmount,
    );
  }

  // ---------------------------------------------------------------------------
  // Core network helpers
  // ---------------------------------------------------------------------------

  /// Step 1 (paid, PayPal): create a PayPal order for a form.
  ///
  /// Server validates slug, computes price from answers, checks that PayPal
  /// is allowed, and returns:
  ///  - order_id
  ///  - raw PayPal "order" blob in `paypal`
  ///  - amount / currency
  static Future<CreateFormOrderResponse> createFormPaymentOrder(
    String slug,
    Map<String, dynamic> answers,
  ) async {
    try {
      final res = await api.post(
        "/v1/forms/payments/create",
        data: <String, dynamic>{'slug': slug, 'answers': answers},
      );

      final raw = res.data;
      if (raw is! Map) {
        throw StateError(
          "Invalid response for createFormPaymentOrder: expected Map, got ${raw.runtimeType}",
        );
      }

      final map = Map<String, dynamic>.from(raw);
      return CreateFormOrderResponse.fromJson(map);
    } catch (e, st) {
      logger.e(
        "[FormSubmissionHelper] createFormPaymentOrder() -> error",
        error: e,
        stackTrace: st,
      );
      rethrow;
    }
  }

  /// Step 2 NEW (preferred): capture AND submit in one idempotent call.
  ///
  /// - Backend performs PayPal capture (or short-circuits if already captured)
  /// - Backend writes/returns the single saved response (or returns existing)
  /// - Response includes:
  ///   - status: captured_and_submitted | already_captured | already_processed
  ///   - order_id, transaction_id, response (saved response JSON)
  static Future<CaptureAndSubmitFormResponse> captureAndSubmitFormPayment(
    String slug,
    String orderId,
    Map<String, dynamic> answers,
  ) async {
    try {
      final res = await api.post(
        "/v1/forms/payments/capture-and-submit",
        data: <String, dynamic>{
          'slug': slug,
          'order_id': orderId,
          'answers': answers,
        },
      );

      final raw = res.data;
      if (raw is! Map) {
        throw StateError(
          "Invalid response for captureAndSubmitFormPayment: expected Map, got ${raw.runtimeType}",
        );
      }

      final map = Map<String, dynamic>.from(raw);
      return CaptureAndSubmitFormResponse.fromJson(map);
    } catch (e, st) {
      logger.e(
        "[FormSubmissionHelper] captureAndSubmitFormPayment() -> error",
        error: e,
        stackTrace: st,
      );
      rethrow;
    }
  }

  /// Legacy step (door/free): submit the filled form via the responses endpoint.
  ///
  /// Always includes a top-level `payment` object, even for free forms.
  static Future<FormSubmissionResult> submitFormResponse(
    String slug,
    Map<String, dynamic> answers,
    FormResponsePaymentDetails payment,
  ) async {
    try {
      final body = FormSubmissionBody(answers: answers, payment: payment);

      final safeSlug = Uri.encodeComponent(slug);
      final res = await api.post(
        "/v1/forms/slug/$safeSlug/responses",
        data: body.toJson(),
      );

      final raw = res.data;
      if (raw is! Map) {
        throw StateError(
          "Invalid response for submitFormResponse: expected Map, got ${raw.runtimeType}",
        );
      }

      final map = Map<String, dynamic>.from(raw);
      return FormSubmissionResult.fromJson(map);
    } catch (e, st) {
      logger.e(
        "[FormSubmissionHelper] submitFormResponse() -> error",
        error: e,
        stackTrace: st,
      );
      rethrow;
    }
  }

  // ---------------------------------------------------------------------------
  // Convenience shortcuts mirroring TS helper
  // ---------------------------------------------------------------------------

  /// Free-form shortcut.
  ///
  /// `submissionPrice` and `paymentOptions` normally come from a small
  /// meta-object (like the TS `buildPaymentForm(total)`), not necessarily
  /// the original FormModel.
  static Future<FormSubmissionResult> submitFreeForm({
    required String slug,
    required Map<String, dynamic> answers,
    required double submissionPrice,
    required List<FormPaymentOption> paymentOptions,
  }) async {
    final payment = normalizePaymentDetails(
      submissionPrice: submissionPrice,
      paymentOptions: paymentOptions,
      chosenType: FormPaymentType.free,
    );
    return submitFormResponse(slug, answers, payment);
  }

  /// “Pay at the door” shortcut (unpaid). Uses the legacy responses endpoint.
  ///
  /// Note: door payments are intentionally *not* marked complete on submission.
  static Future<FormSubmissionResult> submitDoorPaymentForm({
    required String slug,
    required Map<String, dynamic> answers,
    required double submissionPrice,
    required List<FormPaymentOption> paymentOptions,
  }) async {
    final payment = normalizePaymentDetails(
      submissionPrice: submissionPrice,
      paymentOptions: paymentOptions,
      chosenType: FormPaymentType.door,
    );

    // door payments are intentionally not complete on submission
    final adjustedPayment = FormResponsePaymentDetails(
      paymentType: payment.paymentType,
      price: payment.price,
      paymentComplete: false,
      transactionId: payment.transactionId,
      currency: payment.currency,
      capturedAmount: payment.capturedAmount,
    );

    return submitFormResponse(slug, answers, adjustedPayment);
  }
}
