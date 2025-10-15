import '../helpers/api_client.dart';
import '../models/event_registration_summary.dart';

class EventRegistrationService {
  /// Register user or family member for an event
  /// If familyMemberId is null, registers the current user
  /// If familyMemberId is provided, registers that family member
  /// scope: "series" for recurring registration, "occurrence" for one-time registration
  static Future<bool> registerForEvent({
    required String eventId,
    String? familyMemberId,
    String scope = 'series',
  }) async {
    try {
      final String endpoint;
      if (familyMemberId != null) {
        endpoint =
            '/v1/event-people/register/$eventId/family-member/$familyMemberId';
      } else {
        endpoint = '/v1/event-people/register/$eventId';
      }

      final response = await api.post(
        endpoint,
        queryParameters: {'scope': scope},
      );
      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to register for event: $e');
    }
  }

  /// Unregister user or family member from an event
  /// If familyMemberId is null, unregisters the current user
  /// If familyMemberId is provided, unregisters that family member
  /// scope: Optional - if provided, only removes that specific scope registration
  ///        if null, removes all registrations (both occurrence and series)
  static Future<bool> unregisterFromEvent({
    required String eventId,
    String? familyMemberId,
    String? scope,
  }) async {
    try {
      final String endpoint;
      if (familyMemberId != null) {
        endpoint =
            '/v1/event-people/unregister/$eventId/family-member/$familyMemberId';
      } else {
        endpoint = '/v1/event-people/unregister/$eventId';
      }

      final queryParams = scope != null ? {'scope': scope} : null;
      final response = await api.delete(
        endpoint,
        queryParameters: queryParams,
      );
      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to unregister from event: $e');
    }
  }

  /// Get registration summary for event (user's family registrations + aggregate data only)
  static Future<EventRegistrationSummary> getEventRegistrationSummary(
    String eventId,
  ) async {
    try {
      final response = await api.get(
        '/v1/events/$eventId/registrations/summary',
      );
      if (response.data['success'] == true) {
        return EventRegistrationSummary.fromJson(response.data);
      }
      // Return empty summary if request fails
      return EventRegistrationSummary(
        userRegistrations: [],
        totalRegistrations: 0,
        availableSpots: 0,
        totalSpots: 0,
        canRegister: false,
      );
    } catch (e) {
      throw Exception('Failed to get event registration summary: $e');
    }
  }

  /// Check if current user is registered for event
  static Future<bool> isUserRegistered(String eventId) async {
    try {
      final response = await api.get('/v1/events/$eventId/is-registered');
      return response.data['is_registered'] == true;
    } catch (e) {
      throw Exception('Failed to check registration status: $e');
    }
  }

  /// Check if family member is registered for event
  static Future<bool> isFamilyMemberRegistered({
    required String eventId,
    required String familyMemberId,
  }) async {
    try {
      final response = await api.get(
        '/v1/events/$eventId/is-family-member-registered',
        queryParameters: {'family_member_id': familyMemberId},
      );
      return response.data['is_registered'] == true;
    } catch (e) {
      throw Exception('Failed to check family member registration status: $e');
    }
  }

  /// Check if multiple family members are registered for event (bulk operation)  
  /// Returns a map of family member ID to registration status
  static Future<Map<String, bool>> areFamilyMembersRegistered({
    required String eventId,
    required List<String> familyMemberIds,
  }) async {
    try {
      if (familyMemberIds.isEmpty) return {};

      final response = await api.post(
        '/v1/events/$eventId/are-family-members-registered',
        data: {'family_member_ids': familyMemberIds},
      );

      if (response.data['success'] == true) {
        final registrations =
            response.data['registrations'] as Map<String, dynamic>;
        return registrations.map((key, value) => MapEntry(key, value as bool));
      }

      return {};
    } catch (e) {
      throw Exception('Failed to check family members registration status: $e');
    }
  }

  /// Register multiple people for an event (unified method)
  static Future<bool> registerMultiplePeople({
    required String eventId,
    required List<Map<String, dynamic>> registrations,
    String? paymentOption,
    double donationAmount = 0.0,
  }) async {
    try {
      final data = {
        'registrations': registrations,
        'donation_amount': donationAmount,
      };

      if (paymentOption != null) {
        data['payment_option'] = paymentOption;
      }

      final response = await api.post(
        '/v1/event-people/register-multiple/$eventId',
        data: data,
      );

      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to register multiple people: $e');
    }
  }

  /// Create payment order for multiple registrations (simplified)
  static Future<Map<String, dynamic>> createPaymentOrderForMultiple({
    required String eventId,
    required List<Map<String, dynamic>> registrations,  
    required double totalAmount,
    double donationAmount = 0.0,
  }) async {
    try {
      // Prevent creating PayPal orders with zero or negative amounts
      if (totalAmount <= 0) {
        throw Exception('PayPal orders require a positive amount. Total amount provided: $totalAmount');
      }

      final data = {
        'registrations': registrations,
        'total_amount': totalAmount,
        'donation_amount': donationAmount,
        'payment_option': 'paypal',
      };

      final response = await api.post(
        '/v1/events/$eventId/payment/create-bulk-order',
        data: data,
      );

      if (response.data['success'] == true) {
        return response.data;
      }

      throw Exception(response.data['message'] ?? 'Failed to create payment order');
    } catch (e) {
      throw Exception('Failed to create payment order: $e');
    }
  }

  /// Complete PayPal payment for event registration
  static Future<bool> completePayPalPayment({
    required String eventId,
    required String paymentId,
    required String payerId,
  }) async {
    try {
      final response = await api.post(
        '/v1/events/$eventId/payment/complete-bulk-registration',
        data: {
          'payment_id': paymentId,
          'payer_id': payerId,
        },
      );

      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to complete PayPal payment: $e');
    }
  }
}
