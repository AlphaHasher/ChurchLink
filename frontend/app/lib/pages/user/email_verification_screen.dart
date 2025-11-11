import 'dart:async';
import 'package:app/helpers/backend_helper.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:app/helpers/user_helper.dart';
import 'package:app/services/connectivity_service.dart';
import 'package:app/helpers/localization_helper.dart';

class VerifyEmailScreen extends StatefulWidget {
  final VoidCallback? onVerified;
  const VerifyEmailScreen({super.key, this.onVerified});

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  bool _hasSent = false;
  int _cooldown = 0;
  bool _sending = false;
  bool _online = true;

  Timer? _cooldownTimer;
  Timer? _pollTimer;
  StreamSubscription<bool>? _netSub;

  @override
  void initState() {
    super.initState();
    _netSub = ConnectivityService().online$.listen((v) {
      setState(() => _online = v);
      if (v) _startPolling(); // reconcile when back online
    });
    _startPolling(); // also handles the "already verified" case
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _pollTimer?.cancel();
    _netSub?.cancel();
    super.dispose();
  }

  String get _email => FirebaseAuth.instance.currentUser?.email ?? '';

  void _startCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _cooldown = 30);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() {
        _cooldown -= 1;
        if (_cooldown <= 0) {
          _cooldown = 0;
          t.cancel();
        }
      });
    });
  }

  void _startPolling() {
    _pollTimer?.cancel();

    Future<void> pollOnce() async {
      try {
        final user = FirebaseAuth.instance.currentUser;
        if (user == null) return;

        await user.reload();

        if (_online) {
          await BackendHelper.syncFirebaseUserWithBackend();
          final status = await UserHelper.getIsInit();
          if (status != null) {
            if (status['verified'] == true) {
              _finishVerified();
              return;
            }
          }
        } else {
          final cached = await UserHelper.readCachedStatus();
          if (cached?.verified == true) {
            _finishVerified();
            return;
          }
        }
      } catch (_) {}
    }

    // Fire immediately, then every 5s (only useful when online)
    unawaited(pollOnce());
    _pollTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(pollOnce()),
    );
  }

  void _finishVerified() {
    _cooldownTimer?.cancel();
    _pollTimer?.cancel();
    if (widget.onVerified != null) {
      widget.onVerified!.call();
    } else {
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
    }
  }

  Future<void> _sendVerification() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      setState(() => _sending = true);

      await user.sendEmailVerification();

      if (!mounted) return;
      setState(() => _hasSent = true);
      _startCooldown();
      _startPolling();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(LocalizationHelper.localize('Could not send verification email. Please try again.', capitalize: true)),
        ),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _logout() async {
    _cooldownTimer?.cancel();
    _pollTimer?.cancel();
    await UserHelper.clearCachedStatus();
    await UserHelper.clearCachedProfile();
    await FirebaseAuth.instance.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final disabled = !_online || _cooldown > 0 || _sending;
    final label =
        _cooldown > 0
            ? '${LocalizationHelper.localize('Resend in ', capitalize: true)}$_cooldown ${LocalizationHelper.localize('seconds')}'
            : _hasSent
                ? LocalizationHelper.localize('Re-send verification email', capitalize: true)
                : LocalizationHelper.localize('Send verification email', capitalize: true);

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Material(
                elevation: 1,
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_online)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(8),
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.orange.shade200),
                          ),
                          child: Text(
                            LocalizationHelper.localize('Offline — some actions are disabled. We\'ll resume automatically when you\'re back online.'),
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.orange),
                          ),
                        ),
                      Text(
                        LocalizationHelper.localize('Verify your email', capitalize: true),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${LocalizationHelper.localize('Please verify your email: ', capitalize: true)}${_email.isNotEmpty ? _email : LocalizationHelper.localize('(unknown)')} ${LocalizationHelper.localize('to continue. Check your spam folder if you can’t find the message.')}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.black54),
                      ),
                      const SizedBox(height: 20),
                      Icon(
                        Icons.mark_email_unread_rounded,
                        size: 82,
                        color: Colors.grey.shade700,
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: 280,
                        child: FilledButton(
                          onPressed: disabled ? null : _sendVerification,
                          child: Text(label),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: 280,
                        child: OutlinedButton(
                          onPressed: _logout,
                          child: Text(LocalizationHelper.localize('Logout', capitalize: true)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
