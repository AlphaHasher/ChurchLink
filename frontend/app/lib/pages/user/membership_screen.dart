import 'package:flutter/material.dart';

import 'package:app/helpers/membership_helper.dart';
import 'package:app/helpers/user_helper.dart';
import 'package:app/models/membership_request.dart';

import 'package:app/widgets/user/visualize_membership.dart';
import 'package:app/widgets/user/request_status.dart';
import 'package:app/pages/user/submit_membership_request.dart';
import 'package:app/pages/user/membership_denial.dart';

class MembershipScreen extends StatefulWidget {
  const MembershipScreen({super.key});

  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

enum _PrimaryAction { none, openSubmit, openRead }

class _UiPlan {
  final String? message;
  final String buttonLabel;
  final _PrimaryAction action;
  final bool resubmission;
  final String? prefill;
  final bool? readMuted;
  final String? readReason;

  const _UiPlan({
    required this.message,
    required this.buttonLabel,
    required this.action,
    required this.resubmission,
    required this.prefill,
    required this.readMuted,
    required this.readReason,
  });

  static const none = _UiPlan(
    message: null,
    buttonLabel: "",
    action: _PrimaryAction.none,
    resubmission: false,
    prefill: null,
    readMuted: null,
    readReason: null,
  );
}

class _MembershipScreenState extends State<MembershipScreen> {
  MembershipDetails? _details;
  bool _loading = true;
  bool _online = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    Future<void> _loadCache() async {
      try {
        final profile = await UserHelper.readCachedProfile();
        final isMember = (profile == null ? false : profile.membership);
        final synthesized = MembershipDetails(
          membership: isMember,
          pending_request: null,
        );
        if (!mounted) return;
        setState(() {
          _details = synthesized;
          _loading = false;
          _online = false;
        });
      } catch (e2) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = 'Failed to load membership details.';
          _online = false;
        });
      }
    }

    try {
      final fresh = await MembershipHelper.readMembershipDetails();
      if (fresh == null) {
        _loadCache();
        return;
      }
      if (!mounted) return;
      setState(() {
        _details = fresh;
        _loading = false;
        _online = true;
      });
    } catch (_) {}
  }

  Future<void> _reload() => _load();

  _UiPlan _deriveUi(MembershipDetails d) {
    final pr = d.pending_request;

    if (d.membership == true || _online == false) {
      return _UiPlan.none;
    }

    // Muted special case:
    // - muted + denied => allow "Read Request"
    // - muted otherwise => no status/button
    if (pr != null && pr.muted == true) {
      if (pr.resolved == true && pr.approved == false) {
        return _UiPlan(
          message:
              'Your previous membership request was denied. You can review your request below, there may be details as to why your request was denied.',
          buttonLabel: 'Read Request',
          action: _PrimaryAction.openRead,
          resubmission: false,
          prefill: null,
          readMuted: pr.muted,
          readReason: pr.reason,
        );
      }
      return _UiPlan.none;
    }

    // No pending OR previously approved (membership later revoked) → Request
    if (pr == null || (pr.approved == true)) {
      return _UiPlan(
        message:
            'You’re not a member yet. But, you can submit a membership request to become one below!',
        buttonLabel: 'Request Membership',
        action: _PrimaryAction.openSubmit,
        resubmission: false,
        prefill: null,
        readMuted: null,
        readReason: null,
      );
    }

    // Pending and unresolved → Re-submit
    if (pr.resolved == false) {
      return _UiPlan(
        message:
            'You already have a membership request pending review. If needed, you can re-submit it with a new or updated message below.',
        buttonLabel: 'Re-Submit Request',
        action: _PrimaryAction.openSubmit,
        resubmission: true,
        prefill: pr.message,
        readMuted: null,
        readReason: null,
      );
    }

    // Resolved & denied → Read
    if (pr.resolved == true && pr.approved == false) {
      return _UiPlan(
        message:
            'Your previous membership request was denied. You can review the details below.',
        buttonLabel: 'Read Request',
        action: _PrimaryAction.openRead,
        resubmission: false,
        prefill: null,
        readMuted: pr.muted,
        readReason: pr.reason,
      );
    }

    return _UiPlan.none;
  }

  Future<void> _handlePrimaryAction(_UiPlan plan) async {
    switch (plan.action) {
      case _PrimaryAction.openSubmit:
        {
          final result = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder:
                  (_) => SubmitMembershipRequestScreen(
                    resubmission: plan.resubmission,
                    initialMessage: plan.prefill,
                  ),
            ),
          );
          if (result == true) {
            if (!mounted) return;
            await _reload();
          }
          break;
        }
      case _PrimaryAction.openRead:
        {
          final refreshed = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder:
                  (_) => ReadMembershipDenialScreen(
                    muted: plan.readMuted ?? false,
                    reason: plan.readReason,
                    previousMessage: null,
                  ),
            ),
          );
          if (refreshed == true) {
            if (!mounted) return;
            await _reload();
          }
          break;
        }
      case _PrimaryAction.none:
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: LinearProgressIndicator());
    }

    final d = _details;
    if (d == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Church Membership')),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: Text('Unable to load membership details.'),
        ),
      );
    }

    final plan = _deriveUi(d);

    return Scaffold(
      appBar: AppBar(title: const Text('Church Membership')),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 100, 16, 0),
        child: Column(
          children: [
            VisualizeMembership(membership: d.membership),

            const SizedBox(height: 40),

            if (plan.message != null && plan.message!.isNotEmpty) ...[
              RequestStatus(message: plan.message!),
              const SizedBox(height: 16),
            ],

            if (plan.buttonLabel.isNotEmpty)
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: ElevatedButton(
                    onPressed: () => _handlePrimaryAction(plan),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(56),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      plan.buttonLabel,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
