import 'package:flutter/material.dart';
import 'package:app/pages/user/submit_membership_request.dart';
import 'package:app/helpers/localization_helper.dart';

class ReadMembershipDenialScreen extends StatefulWidget {
  final bool muted;
  final String? reason;
  final String? previousMessage;

  const ReadMembershipDenialScreen({
    super.key,
    required this.muted,
    this.reason,
    this.previousMessage,
  });

  @override
  State<ReadMembershipDenialScreen> createState() =>
      _ReadMembershipDenialScreenState();
}

class _ReadMembershipDenialScreenState
    extends State<ReadMembershipDenialScreen> {
  bool _navigating = false;

  Future<void> _goToResubmit() async {
    if (!mounted) return;
    setState(() => _navigating = true);

    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder:
            (_) => SubmitMembershipRequestScreen(
              resubmission: true,
              initialMessage: widget.previousMessage,
            ),
      ),
    );

    if (!mounted) return;
    setState(() => _navigating = false);

    if (result == true) {
      if (!mounted) return;
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cardColor = theme.colorScheme.surface;
    final borderColor = theme.colorScheme.outlineVariant.withValues(alpha: 0.6);

    return Scaffold(
      appBar: AppBar(title: Text(LocalizationHelper.localize('Membership Request'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 50, 16, 24),
        children: [
          Card(
            elevation: 0,
            color: cardColor,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: borderColor),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    LocalizationHelper.localize('Request Denied'),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    LocalizationHelper.localize('Your previous membership request was denied.'),
                    style: theme.textTheme.bodyMedium,
                  ),
                  if (widget.reason != null &&
                      widget.reason!.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      LocalizationHelper.localize('Reason provided by reviewer:'),
                      style: theme.textTheme.bodySmall,
                    ),
                    Text(
                      widget.reason!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.hintColor,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          if (!widget.muted) ...[
            const SizedBox(height: 20),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: ElevatedButton(
                onPressed: _navigating ? null : _goToResubmit,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Text(
                  _navigating ? LocalizationHelper.localize('Opening…') : LocalizationHelper.localize('Re-Submit Request'),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

