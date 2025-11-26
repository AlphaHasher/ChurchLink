import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import 'package:app/pages/events/event_showcase_v2.dart';
import 'package:app/helpers/event_user_helper.dart';
import 'package:app/main.dart';
import 'package:app/pages/my_bible_plans_page.dart';

class DeepLinkingService {
  // Reference to the navigator key
  static GlobalKey<NavigatorState>? _navigatorKey;

  /// Initialize the service with the navigator key from main.dart
  static void initialize(GlobalKey<NavigatorState> navKey) {
    _navigatorKey = navKey;
  }

  // Notification handler for deep linking (route, link, and actionType)
  static Future<void> handleNotificationData(Map<String, dynamic> data) async {
    if (data.isEmpty) return;

    // Handle specific action types first
    if (data['actionType'] != null) {
      await _handleActionType(data);
      return;
    }

    if (data['route'] != null) {
      await _handleRouteNavigation(data['route']);
    }
    if (data['link'] != null) {
      await _handleExternalLink(data['link']);
    }
  }

  /// Handle notification action types
  static Future<void> _handleActionType(Map<String, dynamic> data) async {
    final actionType = data['actionType'];

    switch (actionType) {
      case 'bible_plan':
        await _handleBiblePlanNavigation(data);
        break;
      case 'event':
        if (data['eventId'] != null) {
          await _handleEventNavigation(data['eventId']);
        }
        break;
      default:
        // Fall back to route navigation if available
        if (data['route'] != null) {
          await _handleRouteNavigation(data['route']);
        }
        break;
    }
  }

  /// Handle Bible plan notification navigation
  static Future<void> _handleBiblePlanNavigation(
    Map<String, dynamic> data,
  ) async {
    debugPrint('_handleBiblePlanNavigation called with: $data');
    try {
      final context = navigatorKey.currentContext;
      if (context == null) {
        debugPrint('Navigator context is null');
        return;
      }
      await Future.delayed(const Duration(milliseconds: 300));

      // Now navigate to the Bible plans page
      if (navigatorKey.currentContext != null) {
        Navigator.of(navigatorKey.currentContext!).push(
          MaterialPageRoute(builder: (context) => const MyBiblePlansPage()),
        );
        debugPrint('Navigated to MyBiblePlansPage');
      }
    } catch (e) {
      debugPrint('Error navigating to Bible plans: $e');
      // Fallback to Bible page if direct navigation fails
      try {
        navigatorKey.currentState?.pushNamed('/bible');
      } catch (fallbackError) {
        debugPrint(
          'Fallback navigation to Bible page also failed: $fallbackError',
        );
      }
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
      final details = await EventUserHelper.fetchEventInstanceDetails(eventId);
      final event = details.eventDetails;
      if (event == null) {
        return;
      }
      final context = navKey.currentContext;
      if (context != null && context.mounted) {
        try {
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => EventShowcaseV2(initialEvent: event),
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
