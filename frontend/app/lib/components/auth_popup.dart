import 'package:app/helpers/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../firebase/firebase_auth_service.dart';
import '../pages/user/use_email.dart';

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
    final List<Map<String, dynamic>> authOptions = [
      {
        'title': 'Continue with Email',
        'icon': Icons.email,
        'ontap': _continueWithEmail,
        'backgroundColor': Colors.black,
        'foregroundColor': Colors.white,
      },
      {
        'title': 'Continue with Google',
        'icon': Icons.g_mobiledata,
        'ontap': _continueWithGoogle,
        'backgroundColor': Colors.black,
        'foregroundColor': Colors.white,
      },
    ];

    return Container(
      height: MediaQuery.of(context).size.height * 0.5,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      child: Column(
        children: [
          // Handle bar at the top
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(4),
            ),
          ),

          const SizedBox(height: 24),

          // Title
          const Text(
            'Sign in',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),

          const SizedBox(height: 8),

          // Subtitle
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              'Choose how you want to continue',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
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
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(option['icon'], size: 24),
                    const SizedBox(width: 12),
                    Text(option['title'], style: const TextStyle(fontSize: 16)),
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
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
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
}
