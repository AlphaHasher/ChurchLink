// lib/helpers/donation_helper.dart

import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/models/donations.dart';

/// Helper for user-facing donation flows (mobile):
/// - One-time PayPal donations (create + capture)
/// - Recurring donation subscriptions (create + cancel)
///
/// Mirrors DonationHelper.tsx on the web, without admin-only operations.
class DonationHelper {
  DonationHelper._();

  // ---------------------------------------------------------------------------
  // One-time donations
  // ---------------------------------------------------------------------------

  /// Create a one-time PayPal order for a donation.
  ///
  /// Returns a [CreateOneTimeDonationResponse] that includes:
  ///  - [success]: whether the order was created
  ///  - [orderId]: PayPal order id (required on success)
  ///  - [approveUrl]: PayPal approval URL for the webview (may be null)
  static Future<CreateOneTimeDonationResponse> createOneTimeDonation(
    CreateOneTimeDonationRequest payload,
  ) async {
    // Basic client-side validation (parity with TS helper).
    if (payload.amount <= 0) {
      return CreateOneTimeDonationResponse(
        success: false,
        msg: "Invalid amount",
        orderId: null,
        approveUrl: null,
      );
    }

    try {
      final String currency =
          donationCurrencyToJson(payload.currency ?? DonationCurrency.usd) ??
          "USD";

      final res = await api.post(
        "/v1/donations/one-time/create",
        data: <String, dynamic>{
          "amount": payload.amount,
          "currency": currency,
          "message": payload.message,
        },
      );

      final raw = res.data;

      if (raw is! Map) {
        return CreateOneTimeDonationResponse(
          success: false,
          msg: "Invalid response from server",
          orderId: null,
          approveUrl: null,
        );
      }

      final Map<String, dynamic> data = Map<String, dynamic>.from(raw);

      final String? orderId = data["order_id"] as String?;
      if (orderId == null || orderId.isEmpty) {
        return CreateOneTimeDonationResponse(
          success: false,
          msg: "Invalid response from server (missing order id)",
          orderId: null,
          approveUrl: null,
        );
      }

      String? approveUrl;
      final dynamic paypalRaw = data["paypal"];
      if (paypalRaw is Map) {
        final dynamic linksRaw = paypalRaw["links"];
        if (linksRaw is List) {
          for (final link in linksRaw) {
            if (link is Map) {
              final rel = link["rel"]?.toString();
              final href = link["href"]?.toString();
              if (rel == "approve" && href != null && href.isNotEmpty) {
                approveUrl = href;
                break;
              }
            }
          }
        }
      }

      return CreateOneTimeDonationResponse(
        success: true,
        msg: "Order created",
        orderId: orderId,
        approveUrl: approveUrl,
      );
    } catch (e, st) {
      logger.e(
        "[DonationHelper] createOneTimeDonation() -> error",
        error: e,
        stackTrace: st,
      );
      return CreateOneTimeDonationResponse(
        success: false,
        msg: "Failed to create donation order",
        orderId: null,
        approveUrl: null,
      );
    }
  }

  /// Capture a previously approved one-time PayPal donation.
  ///
  /// Returns a [CaptureOneTimeDonationResponse] describing whether the
  /// capture happened now vs was already captured.
  static Future<CaptureOneTimeDonationResponse> captureOneTimeDonation(
    CaptureOneTimeDonationRequest payload,
  ) async {
    if (payload.orderId.trim().isEmpty) {
      return CaptureOneTimeDonationResponse(
        success: false,
        msg: "Missing order_id",
        status: null,
        orderId: null,
        captureId: null,
        capturedAmount: null,
        currency: null,
      );
    }

    try {
      final res = await api.post(
        "/v1/donations/one-time/capture",
        data: <String, dynamic>{"order_id": payload.orderId},
      );

      final raw = res.data;
      if (raw is! Map) {
        return CaptureOneTimeDonationResponse(
          success: false,
          msg: "Invalid response from server",
          status: null,
          orderId: null,
          captureId: null,
          capturedAmount: null,
          currency: null,
        );
      }

      final Map<String, dynamic> data = Map<String, dynamic>.from(raw);

      final String? statusStr = data["status"] as String?;
      final String? orderId = data["order_id"] as String?;
      if (statusStr == null || orderId == null || orderId.isEmpty) {
        return CaptureOneTimeDonationResponse(
          success: false,
          msg: "Invalid response from server",
          status: null,
          orderId: null,
          captureId: null,
          capturedAmount: null,
          currency: null,
        );
      }

      final CaptureOneTimeDonationStatus? status = captureStatusFromJson(
        statusStr,
      );
      final String? captureId = data["capture_id"] as String?;
      final double? capturedAmount =
          (data["captured_amount"] is num)
              ? (data["captured_amount"] as num).toDouble()
              : null;
      final DonationCurrency currency =
          donationCurrencyFromJson(data["currency"] as String?) ??
          DonationCurrency.usd;

      String message;
      switch (status) {
        case CaptureOneTimeDonationStatus.captured:
          message = "Donation captured";
          break;
        case CaptureOneTimeDonationStatus.alreadyCaptured:
          message = "Donation already captured";
          break;
        default:
          message = "Donation processed";
          break;
      }

      return CaptureOneTimeDonationResponse(
        success: true,
        msg: message,
        status: status,
        orderId: orderId,
        captureId: captureId,
        capturedAmount: capturedAmount,
        currency: currency,
      );
    } catch (e, st) {
      logger.e(
        "[DonationHelper] captureOneTimeDonation() -> error",
        error: e,
        stackTrace: st,
      );
      return CaptureOneTimeDonationResponse(
        success: false,
        msg: "Failed to capture donation",
        status: null,
        orderId: null,
        captureId: null,
        capturedAmount: null,
        currency: null,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Recurring donations (subscriptions)
  // ---------------------------------------------------------------------------

  /// Create a recurring donation subscription and return the approval URL.
  ///
  /// The backend validates amount + interval and returns:
  ///  - subscription_id
  ///  - status (APPROVAL_PENDING, ACTIVE, ...)
  ///  - approve_url (for PayPal approval)
  static Future<CreateDonationSubscriptionResponse> createDonationSubscription(
    CreateDonationSubscriptionRequest payload,
  ) async {
    if (payload.amount <= 0) {
      return CreateDonationSubscriptionResponse(
        success: false,
        msg: "Invalid amount",
        subscriptionId: null,
        status: null,
        approveUrl: null,
      );
    }

    if (payload.interval != DonationInterval.week &&
        payload.interval != DonationInterval.month &&
        payload.interval != DonationInterval.year) {
      return CreateDonationSubscriptionResponse(
        success: false,
        msg: "Invalid interval",
        subscriptionId: null,
        status: null,
        approveUrl: null,
      );
    }

    try {
      final String currency =
          donationCurrencyToJson(payload.currency ?? DonationCurrency.usd) ??
          "USD";
      final String interval =
          donationIntervalToJson(payload.interval) ?? "MONTH";

      final res = await api.post(
        "/v1/donations/subscription/create",
        data: <String, dynamic>{
          "amount": payload.amount,
          "currency": currency,
          "interval": interval,
          "message": payload.message,
        },
      );

      final raw = res.data;
      if (raw is! Map) {
        return CreateDonationSubscriptionResponse(
          success: false,
          msg: "Invalid response from server",
          subscriptionId: null,
          status: null,
          approveUrl: null,
        );
      }

      final Map<String, dynamic> data = Map<String, dynamic>.from(raw);

      final String? subscriptionId = data["subscription_id"] as String?;
      if (subscriptionId == null || subscriptionId.isEmpty) {
        return CreateDonationSubscriptionResponse(
          success: false,
          msg: "Invalid response from server (missing subscription id)",
          subscriptionId: null,
          status: null,
          approveUrl: null,
        );
      }

      final String? statusStr = data["status"] as String?;
      final DonationSubscriptionStatus? status =
          donationSubscriptionStatusFromJson(statusStr);
      final String? approveUrl = data["approve_url"] as String?;

      return CreateDonationSubscriptionResponse(
        success: true,
        msg: "Subscription created",
        subscriptionId: subscriptionId,
        status: status,
        approveUrl: approveUrl,
      );
    } catch (e, st) {
      logger.e(
        "[DonationHelper] createDonationSubscription() -> error",
        error: e,
        stackTrace: st,
      );
      return CreateDonationSubscriptionResponse(
        success: false,
        msg: "Failed to create donation subscription",
        subscriptionId: null,
        status: null,
        approveUrl: null,
      );
    }
  }

  /// Cancel a recurring donation subscription owned by the current user.
  static Future<CancelDonationSubscriptionResponse> cancelDonationSubscription(
    CancelDonationSubscriptionRequest payload,
  ) async {
    if (payload.subscriptionId.trim().isEmpty) {
      return CancelDonationSubscriptionResponse(
        success: false,
        msg: "Missing subscription id",
        status: null,
      );
    }

    try {
      final res = await api.post(
        "/v1/donations/subscription/cancel",
        data: payload.toJson(),
      );

      final raw = res.data;
      if (raw is! Map) {
        return CancelDonationSubscriptionResponse(
          success: false,
          msg: "Invalid response from server",
          status: null,
        );
      }

      final Map<String, dynamic> data = Map<String, dynamic>.from(raw);

      final bool success = data["success"] as bool? ?? false;
      final String? msg = data["msg"] as String?;
      final String? statusStr = data["status"] as String?;
      final DonationSubscriptionStatus? status =
          donationSubscriptionStatusFromJson(statusStr);

      if (!success) {
        return CancelDonationSubscriptionResponse(
          success: false,
          msg: msg ?? "Unable to cancel subscription.",
          status: status,
        );
      }

      return CancelDonationSubscriptionResponse(
        success: true,
        msg: msg,
        status: status,
      );
    } catch (e, st) {
      logger.e(
        "[DonationHelper] cancelDonationSubscription() -> error",
        error: e,
        stackTrace: st,
      );
      return CancelDonationSubscriptionResponse(
        success: false,
        msg: "Unexpected error cancelling subscription.",
        status: null,
      );
    }
  }
}
