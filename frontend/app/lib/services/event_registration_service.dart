import '../helpers/api_client.dart';
import '../models/event_registration_summary.dart';
import '../models/event.dart';
import '../pages/event_payment_screen.dart';
import 'package:flutter/material.dart';

class EventRegistrationService {
  /// Register user or family member for an event
  /// If familyMemberId is null, registers the current user
  /// If familyMemberId is provided, registers that family member
  static Future<bool> registerForEvent({
    required String eventId,
    String? familyMemberId,
  }) async {
    try {
      final String endpoint;
      if (familyMemberId != null) {
        endpoint =
            '/v1/event-people/register/$eventId/family-member/$familyMemberId';
      } else {
        endpoint = '/v1/event-people/register/$eventId';
      }

      final response = await api.post(endpoint);
      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to register for event: $e');
    }
  }

  /// Unregister user or family member from an event
  /// If familyMemberId is null, unregisters the current user
  /// If familyMemberId is provided, unregisters that family member
  static Future<bool> unregisterFromEvent({
    required String eventId,
    String? familyMemberId,
  }) async {
    try {
      final String endpoint;
      if (familyMemberId != null) {
        endpoint =
            '/v1/event-people/unregister/$eventId/family-member/$familyMemberId';
      } else {
        endpoint = '/v1/event-people/unregister/$eventId';
      }

      final response = await api.delete(endpoint);
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

  /// Register for event and handle payment flow if needed
  static Future<bool> registerForEventWithPayment({
    required BuildContext context,
    required Event event,
    String? familyMemberId,
  }) async {
    try {
      // First, register for the event
      final registrationSuccess = await registerForEvent(
        eventId: event.id,
        familyMemberId: familyMemberId,
      );

      if (!registrationSuccess) {
        return false;
      }

      // If PayPal is enabled for this event, show payment screen
      if (event.hasPayPalOption) {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => EventPaymentScreen(
              event: event,
              registrationData: {
                'eventId': event.id,
                'familyMemberId': familyMemberId,
              },
            ),
          ),
        );
      } else {
        // Show success message for events without payment
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Successfully registered for ${event.name}!'),
            backgroundColor: Colors.green,
          ),
        );
      }

      return true;
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Registration failed: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
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
}
