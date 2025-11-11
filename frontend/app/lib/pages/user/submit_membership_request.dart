import 'package:flutter/material.dart';
import 'package:app/helpers/membership_helper.dart';
import 'package:app/helpers/localization_helper.dart';

class SubmitMembershipRequestScreen extends StatefulWidget {
  final bool resubmission;
  final String? initialMessage;

  const SubmitMembershipRequestScreen({
    super.key,
    required this.resubmission,
    this.initialMessage,
  }) : assert(
         initialMessage == null || resubmission == true,
         'initialMessage should only be provided for resubmission.',
       );

  @override
  State<SubmitMembershipRequestScreen> createState() =>
      _SubmitMembershipRequestScreenState();
}

class _SubmitMembershipRequestScreenState
    extends State<SubmitMembershipRequestScreen> {
  final _ctrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialMessage != null) {
      _ctrl.text = widget.initialMessage!;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!mounted) return;
    setState(() => _submitting = true);

    final raw = _ctrl.text.trim();
    final String? message = raw.isEmpty ? null : raw;

    try {
      final result = await MembershipHelper.createMembershipRequest(message);

      if (!mounted) return;
      if (result.success == true) {
        Navigator.of(context).pop(true);
      } else {
        final msg = result.msg;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(LocalizationHelper.localize('Something went wrong. Please try again.')),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isResubmit = widget.resubmission;
    final title =
        isResubmit
            ? LocalizationHelper.localize('Re-Submit Membership Request')
            : LocalizationHelper.localize('Submit Membership Request');
    final hint =
        isResubmit
            ? LocalizationHelper.localize('Optionally explain why you are re-submitting…')
            : LocalizationHelper.localize('Optional message to accompany your request…');
    final btn = isResubmit ? LocalizationHelper.localize('Re-Submit Request') : LocalizationHelper.localize('Submit Request');

    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationHelper.localize(title))
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 50, 16, 24),
        child: Column(
          children: [
            Text(
              LocalizationHelper.localize("Optionally, you may include a message to pass to the reviewer of your request which may include your reasonings for wanting to be marked as an official member"),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _ctrl,
              maxLines: 6,
              decoration: InputDecoration(
                hintText: LocalizationHelper.localize(hint),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 24),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Text(
                  _submitting ? LocalizationHelper.localize('Submitting…') : btn,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
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
