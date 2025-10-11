import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'package:app/helpers/user_helper.dart';
import 'package:app/models/profile_info.dart';

class MembershipScreen extends StatefulWidget {
  final User user;
  final ProfileInfo? initialProfile;

  const MembershipScreen({super.key, required this.user, this.initialProfile});

  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends State<MembershipScreen> {
  bool _loading = true;
  ProfileInfo? profile;

  @override
  void initState() {
    super.initState();
    _prefillFromIncomingOrFallback();
  }

  Future<void> _prefillFromIncomingOrFallback() async {
    ProfileInfo? p =
        widget.initialProfile ?? await UserHelper.readCachedProfile();
    p ??= (await UserHelper.getMyProfile())?.profile;

    if (!mounted) return;
    setState(() {
      profile = p;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    final isMember = profile?.membership == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Church Membership'),
        backgroundColor: ssbcGray,
      ),
      body:
          _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
                children: [
                  Text(
                    'Your Status',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _StatusCard(isMember: isMember),
                  const SizedBox(height: 20),
                  _PerksList(isMember: isMember),
                  const SizedBox(height: 28),
                  if (profile == null)
                    _SubtleNote(
                      text:
                          'We couldn’t load your profile details. Pull down to refresh, or try again later.',
                    ),
                ],
              ),
    );
  }
}

class _StatusCard extends StatefulWidget {
  final bool isMember;
  const _StatusCard({required this.isMember});

  @override
  State<_StatusCard> createState() => _StatusCardState();
}

class _StatusCardState extends State<_StatusCard> {
  @override
  Widget build(BuildContext context) {
    final isMember = widget.isMember;

    final gradient =
        isMember
            ? const LinearGradient(
              colors: [Color(0xFF22C55E), Color(0xFF16A34A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            )
            : const LinearGradient(
              colors: [Color(0xFFEF4444), Color(0xFFB91C1C)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            );

    final icon = isMember ? Icons.verified_rounded : Icons.cancel_rounded;
    final title = isMember ? 'Official Member' : 'Not a Member';
    final subtitle =
        isMember
            ? 'You are an official church member and will receive the benefits of lower members-only event prices!'
            : 'You are not currently registered as an official church member. You won’t receive members-only pricing on events.';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 12,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            child: Container(
              key: ValueKey<bool>(isMember),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: Colors.white, size: 34),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: Text(
                    title,
                    key: ValueKey<bool>(isMember),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withOpacity(0.95),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PerksList extends StatelessWidget {
  final bool isMember;
  const _PerksList({required this.isMember});

  @override
  Widget build(BuildContext context) {
    final items =
        isMember
            ? const [
              'Lower members-only event prices',
              'Access to members-only events',
              'Other benefits that are undefined',
            ]
            : const [
              'General event pricing applies',
              'Some members-only events may be restricted',
              'Other benefits that are undefined',
            ];

    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isMember ? 'What you get' : 'Heads up',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ...items.map(
              (t) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Icon(
                      isMember
                          ? Icons.check_circle_rounded
                          : Icons.info_rounded,
                      size: 20,
                      color:
                          isMember
                              ? const Color(0xFF16A34A)
                              : const Color(0xFFB91C1C),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        t,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubtleNote extends StatelessWidget {
  final String text;
  const _SubtleNote({required this.text});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: Theme.of(context).textTheme.bodySmall?.color?.withOpacity(0.7),
      ),
      textAlign: TextAlign.center,
    );
  }
}
