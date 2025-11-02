import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/firebase/firebase_auth_service.dart';

class ChangeEmailSheet extends StatefulWidget {
  const ChangeEmailSheet({super.key});

  static Future<T?> show<T>(BuildContext context) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const ChangeEmailSheet(),
    );
  }

  @override
  State<ChangeEmailSheet> createState() => _ChangeEmailSheetState();
}

class _ChangeEmailSheetState extends State<ChangeEmailSheet> {
  final _form = GlobalKey<FormState>();
  final _newEmail = TextEditingController();
  final _currentPassword = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _newEmail.dispose();
    _currentPassword.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final isEmailPasswordUser =
        user?.providerData.any((p) => p.providerId == 'password') ?? false;

    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Change email', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),

            TextFormField(
              controller: _newEmail,
              decoration: const InputDecoration(labelText: 'New email'),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Enter a new email';
                if (!v.contains('@')) return 'Invalid email';
                return null;
              },
            ),

            if (isEmailPasswordUser) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _currentPassword,
                decoration: const InputDecoration(labelText: 'Current password'),
                obscureText: true,
                validator: (v) => (v == null || v.isEmpty) ? 'Enter your current password' : null,
              ),
            ],

            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _busy ? null : () async {
                  if (!_form.currentState!.validate()) return;

                  setState(() => _busy = true);
                  try {
                    await FirebaseAuthService().changeEmail(
                      newEmail: _newEmail.text.trim(),
                      currentPasswordIfEmailUser:
                          isEmailPasswordUser ? _currentPassword.text : null,
                    );

                    if (!mounted) return;
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Check your new email to confirm the change.')),
                    );
                  } on FirebaseAuthException catch (e) {
                    final msg = switch (e.code) {
                      'email-already-exists' => 'That email is already in use.',
                      'invalid-email' => 'Invalid email format.',
                      // 'requires-recent-login' => 'Please re-authenticate and try again.',
                      _ => e.message ?? 'Email change failed.'
                    };
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Email change failed. $e')));
                    }
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
                child: _busy
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Send confirmation'),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'We’ll email a confirmation link to the new address.\n'
              'Your email will change after you click the link.',
              style: TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}