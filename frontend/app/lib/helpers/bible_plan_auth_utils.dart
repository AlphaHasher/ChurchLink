import 'package:flutter/material.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:app/components/auth_popup.dart';
import 'package:app/pages/my_bible_plans_page.dart';

/// Authentication utilities for Bible plan features
class BiblePlanAuthUtils {
  static final FirebaseAuthService _authService = FirebaseAuthService();

  /// Check if user is logged in
  static bool isUserLoggedIn() {
    return _authService.getCurrentUser() != null;
  }

  /// Navigate to Bible plans with authentication check
  /// Shows login popup if user is not authenticated (unless allowPageAccess is true)
  /// Returns true if navigation occurred, false if login is required
  static Future<bool> navigateToMyBiblePlans(
    BuildContext context, {
    bool showLoginReminder = true,
    bool allowPageAccess = false,
  }) async {
    if (isUserLoggedIn()) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => const MyBiblePlansPage(),
        ),
      );
      return true;
    } else if (allowPageAccess) {
      // Allow navigation to page even when not logged in
      // The page itself will show the login reminder
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => const MyBiblePlansPage(),
        ),
      );
      return true;
    } else if (showLoginReminder) {
      await _showLoginReminder(context);
      return false;
    }
    return false;
  }

  /// Show a compact login reminder dialog
  static Future<void> _showLoginReminder(BuildContext context) async {
    return showDialog<void>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: const Color.fromRGBO(65, 65, 65, 1),
          title: Row(
            children: [
              const Icon(
                Icons.lock_outline,
                color: Color.fromRGBO(150, 130, 255, 1),
              ),
              const SizedBox(width: 12),
              const Text(
                'Sign In Required',
                style: TextStyle(color: Colors.white),
              ),
            ],
          ),
          content: const Text(
            'Please sign in to access your Bible reading plans and track your progress.',
            style: TextStyle(color: Color.fromRGBO(200, 200, 200, 1)),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Cancel'),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromRGBO(150, 130, 255, 1),
                foregroundColor: Colors.white,
              ),
              child: const Text('Sign In'),
              onPressed: () async {
                Navigator.of(context).pop();
                await AuthPopup.show(context);
                
                // After login attempt, check if successful and navigate
                await Future.delayed(const Duration(milliseconds: 500));
                if (context.mounted && isUserLoggedIn()) {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const MyBiblePlansPage(),
                    ),
                  );
                }
              },
            ),
          ],
        );
      },
    );
  }

  /// Show a SnackBar login reminder (for quick notifications)
  static void showLoginSnackBar(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(
          children: [
            Icon(Icons.lock_outline, color: Colors.white),
            SizedBox(width: 12),
            Expanded(
              child: Text('Sign in to access Bible plans'),
            ),
          ],
        ),
        backgroundColor: const Color.fromRGBO(150, 130, 255, 1),
        action: SnackBarAction(
          label: 'Sign In',
          textColor: Colors.white,
          onPressed: () {
            AuthPopup.show(context);
          },
        ),
      ),
    );
  }
}
