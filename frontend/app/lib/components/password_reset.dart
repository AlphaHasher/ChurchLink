import 'package:flutter/material.dart';
import '../firebase/firebase_auth_service.dart';

class PasswordReset extends StatelessWidget {
  PasswordReset({
    super.key,
  });

  final GlobalKey<FormState> forgotPasswordFormKey = GlobalKey<FormState>();
  final TextEditingController forgotPasswordEmailController = TextEditingController();
  final FirebaseAuthService authService = FirebaseAuthService();

  // Show the password reset dialog by calling this static method
  static Future<void> show(BuildContext context, String? email) {
    return showDialog(
      context: context,
      builder: (context) {
        final service = PasswordReset();
        if (email != null) {
          service.forgotPasswordEmailController.text = email;
        }
        return service.build(context);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Forgot Password'),
      content: Form(
        key: forgotPasswordFormKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Enter your email to reset your password',
              style: TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 16),
            TextFormField(
              enabled: authService.getCurrentUser()?.email == null,
              controller: forgotPasswordEmailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter your email';
                } else if (!RegExp(
                  r"^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$",
                ).hasMatch(value)) {
                  return 'Enter a valid email';
                }
                return null;
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => _resetPassword(context),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
          ),
          child: const Text('Reset Password'),
        ),
      ],
    );
  }

  Future<void> _resetPassword(BuildContext context) async {
    if (forgotPasswordFormKey.currentState!.validate()) {
      String email = forgotPasswordEmailController.text.trim();
      try {
        await authService.sendPasswordResetEmail(email);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'If an account exists, a password reset link has been sent to $email',
            ),
          ),
        );
      } catch (e) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('An error occurred. Please try again later.')),
        );
      }
    }
  }
}