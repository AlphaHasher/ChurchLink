import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/models/bible_plan.dart';

/// Service for managing notification preferences
class NotificationPreferencesService {
  NotificationPreferencesService({Dio? client}) : _client = client ?? api;

  final Dio _client;
  static const String _baseUrl = '/v1';

  /// Get all available notification preference types
  Future<List<NotificationPreferenceType>> getAvailablePreferences() async {
    try {
      final response = await _client.get('$_baseUrl/bible-plan-notifications/available-preferences');
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        if (data['success'] == true && data['preferences'] != null) {
          final preferences = data['preferences'] as Map<String, dynamic>;
          
          return preferences.entries
              .map((entry) => NotificationPreferenceType.fromJson(entry.key, entry.value))
              .toList();
        }
      }
      
      return [];
    } catch (e) {
      logger.e('Error fetching available notification preferences: $e');
      rethrow;
    }
  }

  /// Get current device's notification preferences
  Future<Map<String, bool>> getDeviceNotificationPreferences() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) {
        logger.w('No FCM token available for fetching preferences');
        return {};
      }

      final response = await _client.get('$_baseUrl/notification/preferences/$token');
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        if (data['success'] == true && data['notification_preferences'] != null) {
          final prefs = data['notification_preferences'] as Map<String, dynamic>;
          return prefs.map((key, value) => MapEntry(key, value as bool? ?? true));
        }
      }
      
      return {};
    } catch (e) {
      logger.e('Error fetching device notification preferences: $e');
      return {};
    }
  }

  /// Update device notification preferences
  Future<bool> updateDeviceNotificationPreferences(Map<String, bool> preferences) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) {
        logger.w('No FCM token available for updating preferences');
        return false;
      }

      final response = await _client.put(
        '$_baseUrl/notification/preferences',
        data: {
          'token': token,
          'preferences': preferences,
        },
      );
      
      return response.statusCode == 200;
    } catch (e) {
      logger.e('Error updating device notification preferences: $e');
      rethrow;
    }
  }

  /// Update a specific notification preference
  Future<bool> updateSpecificPreference(String preferenceKey, bool enabled) async {
    try {
      final currentPrefs = await getDeviceNotificationPreferences();
      currentPrefs[preferenceKey] = enabled;
      
      return await updateDeviceNotificationPreferences(currentPrefs);
    } catch (e) {
      logger.e('Error updating specific notification preference: $e');
      rethrow;
    }
  }

  /// Enable or disable Bible plan notifications specifically
  Future<bool> setBiblePlanNotifications(bool enabled) async {
    return await updateSpecificPreference('Bible Plan Reminders', enabled);
  }

  /// Check if Bible plan notifications are enabled
  Future<bool> areBiblePlanNotificationsEnabled() async {
    try {
      final prefs = await getDeviceNotificationPreferences();
      return prefs['Bible Plan Reminders'] ?? true; // Default to true if not set
    } catch (e) {
      logger.e('Error checking Bible plan notification status: $e');
      return true; // Default to true on error
    }
  }

  /// Get default notification preferences for new devices
  Map<String, bool> getDefaultPreferences() {
    return {
      'Event Notification': true,
      'App Announcements': true,
      'Live Stream Alerts': true,
      'Bible Plan Reminders': true,
    };
  }

  /// Initialize device with default notification preferences
  Future<bool> initializeDevicePreferences() async {
    try {
      final currentPrefs = await getDeviceNotificationPreferences();
      
      // If no preferences are set, use defaults
      if (currentPrefs.isEmpty) {
        return await updateDeviceNotificationPreferences(getDefaultPreferences());
      }
      
      // If preferences exist, fill in any missing ones with defaults
      final defaults = getDefaultPreferences();
      bool needsUpdate = false;
      
      for (final entry in defaults.entries) {
        if (!currentPrefs.containsKey(entry.key)) {
          currentPrefs[entry.key] = entry.value;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        return await updateDeviceNotificationPreferences(currentPrefs);
      }
      
      return true;
    } catch (e) {
      logger.e('Error initializing device preferences: $e');
      return false;
    }
  }
}
