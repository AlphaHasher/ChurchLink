import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/tab_provider.dart';
import '../pages/event_showcase.dart';
import '../pages/eventspage.dart'; // Import EventsPage
import '../models/event.dart';
import '../helpers/api_client.dart';
import '../helpers/backend_helper.dart';
import '../main.dart'; // Import to access the main navigatorKey

class DeepLinkingService {
  // Store a reference to the navigator key
  static GlobalKey<NavigatorState>? _navigatorKey;
  
  /// Initialize the service with the navigator key from main.dart
  static void initialize(GlobalKey<NavigatorState> navKey) {
    _navigatorKey = navKey;
  }

  /// Enhanced notification handler for deep linking
  /// Supports:
  /// - tab: 0-4 (home, bible, sermons, events, profile)
  /// - route: specific page routes like "/event/event1"
  /// - eventId: direct event ID for event showcase
  /// - link: external URLs
  static Future<void> handleNotificationData(Map<String, dynamic> data) async {
    if (data.isEmpty) return;

    // Handle tab switching first
    if (data['tab'] != null) {
      await _handleTabSwitch(data['tab']);
    }

    // Handle specific route navigation
    if (data['route'] != null) {
      await _handleRouteNavigation(data['route']);
    }

    // Handle event ID navigation
    if (data['eventId'] != null) {
      await _handleEventNavigation(data['eventId']);
    }

    // Handle external links
    if (data['link'] != null) {
      await _handleExternalLink(data['link']);
    }
  }

  /// Switch to specific tab by index or name
  static Future<void> _handleTabSwitch(dynamic tabValue) async {
    try {
      int? targetTabIndex;
      
      if (tabValue is String) {
        final parsed = int.tryParse(tabValue);
        if (parsed != null) {
          targetTabIndex = parsed;
        } else {
          TabProvider.instance?.setTabByName(tabValue);
          return;
        }
      } else if (tabValue is int) {
        targetTabIndex = tabValue;
      }
      
      if (targetTabIndex != null) {
        final maxTabs = TabProvider.instance?.tabs.length ?? 5;
        if (targetTabIndex >= 0 && targetTabIndex < maxTabs) {
          TabProvider.instance?.setTab(targetTabIndex);
        }
      }
      
      // Add slight delay to ensure tab switch completes
      await Future.delayed(const Duration(milliseconds: 100));
      
    } catch (e) {
      debugPrint('Error switching tab: $e');
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
      // First, ensure we're on the Events tab and clear any navigation stack
      TabProvider.instance?.setTabByName('events');
      
      // Clear the navigation stack to home, then wait for the tab to be ready
      final navKey = _navigatorKey ?? navigatorKey;
      await navKey.currentState?.pushNamedAndRemoveUntil('/', (route) => false);
      
      // Wait for the tab switch and navigation to complete
      await Future.delayed(const Duration(milliseconds: 1000));
      
      // Now we should be on the home page with Events tab selected
      // Try to use the EventsPage callback approach
      if (EventsPage.onNavigateToEvent != null) {
        EventsPage.onNavigateToEvent!(eventId);
        return;
      }
      
      // Fallback to direct navigation approach
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
      // Fallback: at least show the events tab
      try {
        TabProvider.instance?.setTabByName('events');
      } catch (fallbackError) {
        debugPrint('Fallback failed: $fallbackError');
      }
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