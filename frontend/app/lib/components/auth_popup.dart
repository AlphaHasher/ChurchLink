import 'dart:io';
import 'package:app/helpers/auth_controller.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:app/pages/user/use_email.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

class AuthPopup extends StatelessWidget {
  AuthPopup({super.key});

  // Show the popup by calling this static method
  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AuthPopup(),
    );
  }

  final FirebaseAuthService authService = FirebaseAuthService();
  final AuthController authController = AuthController();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDarkMode = theme.brightness == Brightness.dark;

    // Define button colors based on theme
    final buttonBackgroundColor = isDarkMode ? Colors.black : Colors.grey[700]!;
    final buttonTextColor = Colors.white;

    final List<Map<String, dynamic>> authOptions = [
      {
        'title': 'Continue with Email',
        'icon': Icons.email,
        'ontap': _continueWithEmail,
        'backgroundColor': buttonBackgroundColor,
        'foregroundColor': buttonTextColor,
      },
      {
        'title': 'Continue with Google',
        'icon': Icons.g_mobiledata,
        'ontap': _continueWithGoogle,
        'backgroundColor': buttonBackgroundColor,
        'foregroundColor': buttonTextColor,
      },
      // Only show Apple Sign-In on iOS
      if (!kIsWeb && Platform.isIOS)
        {
          'title': 'Continue with Apple',
          'icon': Icons.apple,
          'ontap': _continueWithApple,
          'backgroundColor': buttonBackgroundColor,
          'foregroundColor': buttonTextColor,
        },
    ];

    return Container(
      height: MediaQuery.of(context).size.height * 0.5,
      decoration: BoxDecoration(
        color: isDarkMode ? const Color(0xFF2C2C2C) : Colors.white,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
        boxShadow: [
          BoxShadow(
            color:
                isDarkMode
                    ? Colors.black.withValues(alpha: 0.5)
                    : Colors.grey.withValues(alpha: 0.3),
            spreadRadius: 1,
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Handle bar at the top
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDarkMode ? Colors.grey[600] : Colors.grey[300],
              borderRadius: BorderRadius.circular(4),
            ),
          ),

          const SizedBox(height: 24),

          // Title
          Text(
            'Sign in',
            style: TextStyle(
              color: isDarkMode ? Colors.white : Colors.grey[900],
              fontSize: 28,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),

          const SizedBox(height: 12),

          // Subtitle
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              'Choose how you want to continue',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                fontSize: 15,
                fontWeight: FontWeight.w400,
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Dynamically generate buttons from the list
          ...authOptions.map((option) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: ElevatedButton(
                onPressed: () => option['ontap'](context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: option['backgroundColor'],
                  foregroundColor: option['foregroundColor'],
                  minimumSize: const Size(double.infinity, 56),
                  elevation: 2,
                  shadowColor:
                      isDarkMode
                          ? Colors.black.withValues(alpha: 0.5)
                          : Colors.grey.withValues(alpha: 0.3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      option['icon'],
                      size: 26,
                      color: option['foregroundColor'],
                    ),
                    const SizedBox(width: 12),
                    Text(
                      option['title'],
                      style: TextStyle(
                        color: option['foregroundColor'],
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const Spacer(),

          // Terms text
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Text(
              'By continuing, you agree to our Terms of Service and Privacy Policy',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDarkMode ? Colors.grey[500] : Colors.grey[600],
                fontSize: 11,
                fontWeight: FontWeight.w400,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _continueWithEmail(BuildContext context) {
    Navigator.pop(context);

    // Navigate to ContinueWithEmailPage
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ContinueWithEmailPage()),
    );
  }

  void _continueWithGoogle(BuildContext context) async {
    try {
      final String? token = await authService.signInWithGoogle();

      if (token != null) {
        if (context.mounted) {
          Navigator.pop(context);
        }
      } else {
        // Google Sign-In was cancelled or failed
        debugPrint("Google Sign-In returned null (cancelled or failed)");
      }
    } catch (e) {
      debugPrint("Google Sign-In error: $e");
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sign-in failed. Please try again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _continueWithApple(BuildContext context) async {
    try {
      // Check if Apple Sign In is available (iOS only)
      if (!await SignInWithApple.isAvailable()) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Apple Sign-In is not available on this device.'),
              backgroundColor: Colors.orange,
            ),
          );
        }
        return;
      }

      // Use the AuthController for consistent authentication flow
      final bool success = await authController.loginWithAppleAndSync((errorMessage) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Sign-in failed: $errorMessage'),
              backgroundColor: Colors.red,
            ),
          );
        }
      });

      if (success && context.mounted) {
        Navigator.pop(context);
      } else if (context.mounted) {
        // Sign-in was cancelled or failed without specific error
        debugPrint("Apple Sign-In returned false (cancelled or failed)");
      }
    } catch (e) {
      debugPrint("Apple Sign-In error: $e");
      if (context.mounted) {
        String errorMessage = 'Sign-in failed. Please try again.';
        
        // Provide more specific error messages for common issues
        if (e.toString().contains('1000') || e.toString().contains('unknown')) {
          errorMessage = 'Apple Sign-In is not properly configured. Please contact support.';
        } else if (e.toString().contains('canceled')) {
          errorMessage = 'Sign-in was cancelled.';
        } else if (e.toString().contains('operation-not-allowed')) {
          errorMessage = 'Apple Sign-In is not enabled. Please contact support.';
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
