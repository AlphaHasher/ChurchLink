import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../pages/event_showcase.dart';
import '../models/event.dart';
import '../helpers/api_client.dart';
import '../helpers/backend_helper.dart';
import '../main.dart';

class DeepLinkingService {
  // Reference to the navigator key
  static GlobalKey<NavigatorState>? _navigatorKey;
  
  /// Initialize the service with the navigator key from main.dart
  static void initialize(GlobalKey<NavigatorState> navKey) {
  _navigatorKey = navKey;
  }

  // Notification handler for deep linking (route and link only)
  static Future<void> handleNotificationData(Map<String, dynamic> data) async {
    if (data.isEmpty) return;
    if (data['route'] != null) {
      await _handleRouteNavigation(data['route']);
    }
    if (data['link'] != null) {
      await _handleExternalLink(data['link']);
    }
  }


  /// Handle route navigation (like /event/event1)
  static Future<void> _handleRouteNavigation(String route) async {
    try {
      final context = navigatorKey.currentContext;
      if (context == null) return;

      // Handle event routes specifically
      if (route.startsWith('/event/')) {
        final eventId = route.split('/').last;
        await _handleEventNavigation(eventId);
        return;
      }

      // Handle other standard routes
      await Future.delayed(const Duration(milliseconds: 200));
      navigatorKey.currentState?.pushNamed(route);
    } catch (e) {
      debugPrint('Error navigating to route $route: $e');
    }
  }

  /// Handle event navigation by event ID
  static Future<void> _handleEventNavigation(String eventId) async {
    try {
      final navKey = _navigatorKey ?? navigatorKey;
      final event = await _fetchEventById(eventId);
      if (event == null) {
        return;
      }
      final context = navKey.currentContext;
      if (context != null && context.mounted) {
        try {
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => EventShowcase(event: event),
            ),
          );
        } catch (navError) {
          debugPrint('Error in direct navigation: $navError');
        }
      }
    } catch (e) {
      debugPrint('Error navigating to event detail: $e');
    }
  }

  /// Handle external link opening
  static Future<void> _handleExternalLink(String link) async {
    try {
      final uri = Uri.parse(link);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        debugPrint('Could not launch URL: $link');
      }
    } catch (e) {
      debugPrint('Error launching link $link: $e');
    }
  }

  /// Fetch event by ID from the API
  static Future<Event?> _fetchEventById(String eventId) async {
    try {
      final api = ApiClient(
        baseUrl: BackendHelper.apiBase,
      );
      final response = await api.dio.get('/v1/events/$eventId');
      
      if (response.statusCode == 200) {
        return Event.fromJson(response.data);
      } else {
        return null;
      }
    } catch (e) {
      debugPrint('Error fetching event $eventId: $e');
      return null;
    }
  }

  /// Enhanced notification payload builder for backend
  /// Creates properly formatted notification data
  static Map<String, String> buildNotificationData({
    String? actionType,
    String? link,
    String? route,
    int? tab,
    String? eventId,
    Map<String, dynamic>? customData,
  }) {
    final data = <String, String>{};

    if (actionType != null) data['actionType'] = actionType;
    if (link != null) data['link'] = link;
    if (route != null) data['route'] = route;
    if (tab != null) data['tab'] = tab.toString();
    if (eventId != null) data['eventId'] = eventId;

    // Add any custom data
    if (customData != null) {
      for (final entry in customData.entries) {
        data[entry.key] = entry.value.toString();
      }
    }

    return data;
  }
}