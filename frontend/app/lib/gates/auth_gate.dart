import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:app/helpers/user_helper.dart';
import 'package:app/pages/user/email_verification_screen.dart';
import 'package:app/pages/user/profile_init.dart';

/// Flow:
/// - Logged OUT  -> pass through (child)
/// - Logged IN:
///     * consult backend/cached canon via UserHelper.getIsInit()/readCachedStatus()
///     * verified == false -> VerifyEmailScreen
///     * verified == true && init == false -> ProfileInitScreen
///     * verified == true && init == true  -> pass (child)
class AuthGate extends StatefulWidget {
  final Widget child;
  const AuthGate({super.key, required this.child});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

enum _GateDecision { pass, verifyEmail, initProfile }

class _AuthGateState extends State<AuthGate> {
  Future<_GateDecision> _decide() async {
    final auth = FirebaseAuth.instance;
    final user = auth.currentUser;

    // Case 1 Logged out -> pass straight through
    if (user == null) return _GateDecision.pass;

    // Check Online Status, if we can connect to backend, write cache with new canon
    bool? verifiedOnline;
    bool? initOnline;
    try {
      final status = await UserHelper.getIsInit();
      if (status != null) {
        verifiedOnline = status['verified'] == true;
        initOnline = status['init'] == true;
      }
    } catch (_) {
      // ignore; we'll fallback to cache next
    }

    if (verifiedOnline != null && initOnline != null) {
      if (!verifiedOnline) return _GateDecision.verifyEmail;
      if (!initOnline) return _GateDecision.initProfile;
      return _GateDecision.pass;
    }

    // OFFLINE / ERROR fallback: use cached canon
    final cached = await UserHelper.readCachedStatus();
    final verifiedCached = cached?.verified == true;
    final initCached = cached?.init == true;

    if (!verifiedCached) return _GateDecision.verifyEmail;
    if (!initCached) return _GateDecision.initProfile;
    return _GateDecision.pass;
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, authSnap) {
        if (authSnap.connectionState == ConnectionState.waiting) {
          return const _CenteredLoader();
        }

        if (authSnap.data == null) {
          return widget.child;
        }

        return FutureBuilder<_GateDecision>(
          future: _decide(),
          builder: (context, decSnap) {
            if (decSnap.connectionState == ConnectionState.waiting) {
              return const _CenteredLoader();
            }
            final decision = decSnap.data ?? _GateDecision.pass;

            switch (decision) {
              case _GateDecision.pass:
                return widget.child;

              case _GateDecision.verifyEmail:
                return VerifyEmailScreen(
                  onVerified: () {
                    Navigator.of(
                      context,
                    ).pushNamedAndRemoveUntil('/', (_) => false);
                  },
                );

              case _GateDecision.initProfile:
                final u = FirebaseAuth.instance.currentUser!;
                return ProfileInitScreen(user: u);
            }
          },
        );
      },
    );
  }
}

class _CenteredLoader extends StatelessWidget {
  const _CenteredLoader();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(child: Center(child: CircularProgressIndicator())),
    );
  }
}
