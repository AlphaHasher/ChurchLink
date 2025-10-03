import 'package:dio/dio.dart';
import '../helpers/api_client.dart';
import '../models/bible_plan.dart';
import '../helpers/logger.dart';

/// Service for managing Bible Plan operations
class BiblePlanService {
  BiblePlanService({Dio? client}) : _client = client ?? api;

  final Dio _client;
  static const String _baseUrl = '/v1';

  /// Fetch all published Bible plans available to users
  Future<List<BiblePlan>> getPublishedPlans() async {
    try {
      final response = await _client.get('$_baseUrl/bible-plans/published');
      
      if (response.statusCode == 200 && response.data is List) {
        return (response.data as List)
            .map((json) => BiblePlan.fromJson(json as Map<String, dynamic>))
            .toList();
      }
      
      return [];
    } catch (e) {
      logger.e('Error fetching published Bible plans: $e');
      rethrow;
    }
  }

  /// Get a specific Bible plan by ID
  Future<BiblePlan?> getPlanById(String planId) async {
    try {
      final response = await _client.get('$_baseUrl/bible-plans/$planId');
      
      if (response.statusCode == 200 && response.data != null) {
        return BiblePlan.fromJson(response.data as Map<String, dynamic>);
      }
      
      return null;
    } catch (e) {
      logger.e('Error fetching Bible plan: $e');
      return null;
    }
  }

  /// Get all Bible plans the current user is subscribed to
  Future<List<UserBiblePlanSubscription>> getMyBiblePlans() async {
    try {
      final response = await _client.get('$_baseUrl/my-bible-plans/');
      
      if (response.statusCode == 200 && response.data is List) {
        return (response.data as List)
            .map((json) => UserBiblePlanSubscription.fromJson(json as Map<String, dynamic>))
            .toList();
      }
      
      return [];
    } catch (e) {
      logger.e('Error fetching my Bible plans: $e');
      rethrow;
    }
  }

  /// Subscribe the current user to a Bible plan
  Future<bool> subscribeToPlan({
    required String planId,
    required DateTime startDate,
    String? notificationTime,
    bool notificationEnabled = true,
  }) async {
    try {
      final response = await _client.post(
        '$_baseUrl/my-bible-plans/subscribe',
        data: {
          'plan_id': planId,
          'start_date': startDate.toIso8601String(),
          'notification_time': notificationTime,
          'notification_enabled': notificationEnabled,
        },
      );
      
      return response.statusCode == 200;
    } catch (e) {
      logger.e('Error subscribing to Bible plan: $e');
      rethrow;
    }
  }

  /// Unsubscribe from a Bible plan
  Future<bool> unsubscribeFromPlan(String planId) async {
    try {
      final response = await _client.delete('$_baseUrl/my-bible-plans/unsubscribe/$planId');
      
      return response.statusCode == 200;
    } catch (e) {
      logger.e('Error unsubscribing from Bible plan: $e');
      rethrow;
    }
  }

  /// Update progress for a specific day in a Bible plan
  Future<bool> updatePlanProgress({
    required String planId,
    required int day,
    required List<String> completedPassages,
    required bool isCompleted,
  }) async {
    try {
      final response = await _client.put(
        '$_baseUrl/my-bible-plans/progress/$planId',
        data: {
          'day': day,
          'completed_passages': completedPassages,
          'is_completed': isCompleted,
        },
      );
      
      return response.statusCode == 200;
    } catch (e) {
      logger.e('Error updating Bible plan progress: $e');
      rethrow;
    }
  }

  /// Update notification settings for a Bible plan
  Future<bool> updateNotificationSettings({
    required String planId,
    String? notificationTime,
    required bool notificationEnabled,
  }) async {
    try {
      final response = await _client.put(
        '$_baseUrl/my-bible-plans/notification-settings/$planId',
        data: {
          'notification_time': notificationTime,
          'notification_enabled': notificationEnabled,
        },
      );
      
      return response.statusCode == 200;
    } catch (e) {
      logger.e('Error updating notification settings: $e');
      rethrow;
    }
  }

  /// Get combined data of user's subscribed plans with full plan details
  Future<List<UserBiblePlanWithDetails>> getMyPlansWithDetails() async {
    try {
      // First, get all subscriptions
      final subscriptions = await getMyBiblePlans();
      
      // Then, fetch the full plan details for each subscription
      final plansWithDetails = <UserBiblePlanWithDetails>[];
      
      for (final subscription in subscriptions) {
        final plan = await getPlanById(subscription.planId);
        if (plan != null) {
          plansWithDetails.add(
            UserBiblePlanWithDetails(
              plan: plan,
              subscription: subscription,
            ),
          );
        }
      }
      
      return plansWithDetails;
    } catch (e) {
      logger.e('Error fetching plans with details: $e');
      rethrow;
    }
  }

  /// Toggle a passage as completed/uncompleted
  Future<bool> togglePassageCompletion({
    required String planId,
    required int day,
    required String passageId,
    required List<String> currentCompletedPassages,
    required int totalPassagesForDay,
  }) async {
    try {
      // Toggle the passage
      final updatedPassages = List<String>.from(currentCompletedPassages);
      if (updatedPassages.contains(passageId)) {
        updatedPassages.remove(passageId);
      } else {
        updatedPassages.add(passageId);
      }
      
      // Check if all passages for this day are completed
      final isCompleted = updatedPassages.length == totalPassagesForDay;
      
      // Update the progress
      return await updatePlanProgress(
        planId: planId,
        day: day,
        completedPassages: updatedPassages,
        isCompleted: isCompleted,
      );
    } catch (e) {
      logger.e('Error toggling passage completion: $e');
      rethrow;
    }
  }
}
