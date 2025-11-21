import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/models/event_v2.dart';

/// Helper for user-facing event registration flows:
/// - Change registration (self + family)
/// - Create paid registration (PayPal)
/// - Capture paid registration after approval
/// - Validate discount codes
///
class EventRegistrationHelper {
  // ---------------------------------------------------------------------------
  // changeRegistration
  // ---------------------------------------------------------------------------

  static Future<RegistrationChangeResponse> changeRegistration(
    ChangeEventRegistration details,
  ) async {
    // Basic client-side validation (parity with TS: event_instance_id required)
    if (details.eventInstanceId.trim().isEmpty) {
      return RegistrationChangeResponse(
        success: false,
        msg: "Missing event_instance_id",
        seatsFilled: null,
        registrationDetails: null,
        changeRequest: null,
        detailsMap: null,
      );
    }

    // In TS they also validate payment_type when "adding" registrations.
    // Here paymentType is non-nullable on ChangeEventRegistration, so that
    // validation is effectively enforced by construction.

    try {
      final res = await api.put(
        "/v1/events-registrations/change-registration",
        data: details.toJson(),
      );

      final raw = res.data;

      if (raw is! Map) {
        return RegistrationChangeResponse(
          success: false,
          msg: "Invalid response from server",
          seatsFilled: null,
          registrationDetails: null,
          changeRequest: null,
          detailsMap: null,
        );
      }

      final map = Map<String, dynamic>.from(raw);

      if (map['success'] is! bool) {
        return RegistrationChangeResponse(
          success: false,
          msg: "Invalid response from server",
          seatsFilled: null,
          registrationDetails: null,
          changeRequest: null,
          detailsMap: null,
        );
      }

      final parsed = RegistrationChangeResponse.fromJson(map);

      // Match TS behavior: default msg if missing.
      final msg = parsed.msg ?? (parsed.success ? "OK" : "Failed");

      return RegistrationChangeResponse(
        success: parsed.success,
        msg: msg,
        seatsFilled: parsed.seatsFilled,
        registrationDetails: parsed.registrationDetails,
        changeRequest: parsed.changeRequest,
        detailsMap: parsed.detailsMap,
      );
    } catch (e, st) {
      logger.e(
        "[EventRegistrationHelper] changeRegistration() -> error",
        error: e,
        stackTrace: st,
      );
      return RegistrationChangeResponse(
        success: false,
        msg: "Registration update failed",
        seatsFilled: null,
        registrationDetails: null,
        changeRequest: null,
        detailsMap: null,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // createPaidRegistration
  // ---------------------------------------------------------------------------

  static Future<CreatePaidRegistrationResponse> createPaidRegistration(
    ChangeEventRegistration details,
  ) async {
    if (details.eventInstanceId.trim().isEmpty) {
      return CreatePaidRegistrationResponse(
        success: false,
        msg: "Missing event_instance_id",
        orderId: null,
        approveUrl: null,
      );
    }

    final bool isAdding =
        details.selfRegistered == true ||
        details.familyMembersRegistering.isNotEmpty;

    if (!isAdding) {
      return CreatePaidRegistrationResponse(
        success: false,
        msg: "Cannot create a paid order without new registrants",
        orderId: null,
        approveUrl: null,
      );
    }

    if (details.paymentType != EventPaymentType.paypal) {
      return CreatePaidRegistrationResponse(
        success: false,
        msg: "payment_type must be 'paypal' to create a paid order",
        orderId: null,
        approveUrl: null,
      );
    }

    try {
      final res = await api.put(
        "/v1/events-registrations/change-registration",
        data: details.toJson(),
      );

      final raw = res.data;

      if (raw is! Map) {
        return CreatePaidRegistrationResponse(
          success: false,
          msg: "Invalid response from server",
          orderId: null,
          approveUrl: null,
        );
      }

      final map = Map<String, dynamic>.from(raw);

      if (map['success'] is! bool) {
        return CreatePaidRegistrationResponse(
          success: false,
          msg: "Invalid response from server",
          orderId: null,
          approveUrl: null,
        );
      }

      final parsed = CreatePaidRegistrationResponse.fromJson(map);

      if (!parsed.success) {
        return CreatePaidRegistrationResponse(
          success: false,
          msg: parsed.msg ?? "Failed to create payment order",
          orderId: null,
          approveUrl: null,
        );
      }

      final hasOrderId =
          parsed.orderId != null && parsed.orderId!.trim().isNotEmpty;
      final hasApproveUrl =
          parsed.approveUrl != null && parsed.approveUrl!.trim().isNotEmpty;

      if (!hasOrderId || !hasApproveUrl) {
        return CreatePaidRegistrationResponse(
          success: false,
          msg: "Missing approval link or order id",
          orderId: null,
          approveUrl: null,
        );
      }

      return parsed;
    } catch (e, st) {
      logger.e(
        "[EventRegistrationHelper] createPaidRegistration() -> error",
        error: e,
        stackTrace: st,
      );
      return CreatePaidRegistrationResponse(
        success: false,
        msg: "Could not create payment order",
        orderId: null,
        approveUrl: null,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // capturePaidRegistration
  // ---------------------------------------------------------------------------

  static Future<RegistrationChangeResponse> capturePaidRegistration(
    String orderId,
    String eventInstanceId,
    RegistrationDetails finalDetails,
  ) async {
    if (orderId.trim().isEmpty || eventInstanceId.trim().isEmpty) {
      return RegistrationChangeResponse(
        success: false,
        msg: "Missing orderId or event_instance_id",
        seatsFilled: null,
        registrationDetails: null,
        changeRequest: null,
        detailsMap: null,
      );
    }

    try {
      final res = await api.put(
        "/v1/events-registrations/capture-paid-reg",
        data: <String, dynamic>{
          'order_id': orderId,
          'event_instance_id': eventInstanceId,
          'final_details': finalDetails.toJson(),
        },
      );

      final raw = res.data;

      if (raw is! Map) {
        return RegistrationChangeResponse(
          success: false,
          msg: "Invalid response from server",
          seatsFilled: null,
          registrationDetails: null,
          changeRequest: null,
          detailsMap: null,
        );
      }

      final map = Map<String, dynamic>.from(raw);

      if (map['success'] is! bool) {
        return RegistrationChangeResponse(
          success: false,
          msg: "Invalid response from server",
          seatsFilled: null,
          registrationDetails: null,
          changeRequest: null,
          detailsMap: null,
        );
      }

      return RegistrationChangeResponse.fromJson(map);
    } catch (e, st) {
      logger.e(
        "[EventRegistrationHelper] capturePaidRegistration() -> error",
        error: e,
        stackTrace: st,
      );
      return RegistrationChangeResponse(
        success: false,
        msg: "Payment capture failed",
        seatsFilled: null,
        registrationDetails: null,
        changeRequest: null,
        detailsMap: null,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // validateDiscountCodeForEvent
  // ---------------------------------------------------------------------------

  static Future<DiscountCodeCheckResponse> validateDiscountCodeForEvent(
    DiscountCodeCheckRequest payload,
  ) async {
    if (payload.eventId.trim().isEmpty || payload.discountCode.trim().isEmpty) {
      return DiscountCodeCheckResponse(
        success: false,
        msg: "Missing event_id or code",
        id: null,
        isPercent: null,
        discount: null,
        usesLeft: null,
      );
    }

    try {
      final res = await api.post(
        "/v1/events-registrations/validate-discount-code",
        data: payload.toJson(),
      );

      final raw = res.data;

      if (raw is! Map) {
        return DiscountCodeCheckResponse(
          success: false,
          msg: "Invalid response from server",
          id: null,
          isPercent: null,
          discount: null,
          usesLeft: null,
        );
      }

      final map = Map<String, dynamic>.from(raw);

      if (map['success'] is! bool) {
        return DiscountCodeCheckResponse(
          success: false,
          msg: "Invalid response from server",
          id: null,
          isPercent: null,
          discount: null,
          usesLeft: null,
        );
      }

      return DiscountCodeCheckResponse.fromJson(map);
    } catch (e, st) {
      logger.e(
        "[EventRegistrationHelper] validateDiscountCodeForEvent() -> error",
        error: e,
        stackTrace: st,
      );
      return DiscountCodeCheckResponse(
        success: false,
        msg: "Could not validate discount code",
        id: null,
        isPercent: null,
        discount: null,
        usesLeft: null,
      );
    }
  }
}
