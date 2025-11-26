import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'package:app/helpers/backend_helper.dart';
import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/event_user_helper.dart';
import 'package:app/models/event_v2.dart';

/// Compact ticket card showing a QR code that points to the admin view
/// for this user's registrations for a specific event instance.
///
/// This is meant to be rendered conditionally in an Event Showcase screen
/// when the user has registrations for the instance.
class EventTicketCard extends StatefulWidget {
  final UserFacingEvent instance;
  final String userId;

  const EventTicketCard({
    super.key,
    required this.instance,
    required this.userId,
  });

  @override
  State<EventTicketCard> createState() => _EventTicketCardState();
}

class _EventTicketCardState extends State<EventTicketCard> {
  late int _registrantCount;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _initRegistrantCount();
  }

  int _countFromRegistrationDetails(RegistrationDetails? regs) {
    if (regs == null) return 0;
    final selfCount = regs.selfRegistered ? 1 : 0;
    return selfCount + regs.familyRegistered.length;
  }

  Future<void> _initRegistrantCount() async {
    // Seed from the instance payload.
    _registrantCount = _countFromRegistrationDetails(
      widget.instance.eventRegistrations,
    );

    // If we already have a count, no need to hit the network.
    if (_registrantCount > 0) {
      if (mounted) {
        setState(() {
          _initialized = true;
        });
      }
      return;
    }

    // Best-effort fetch to fill in registrant count if missing.
    try {
      final resp = await EventUserHelper.fetchEventInstanceDetails(
        widget.instance.id,
      );
      if (!mounted) return;
      if (resp.success && resp.eventDetails != null) {
        _registrantCount = _countFromRegistrationDetails(
          resp.eventDetails!.eventRegistrations,
        );
      }
    } catch (_) {
      // ignore – best-effort only
    }

    if (!mounted) return;
    setState(() {
      _initialized = true;
    });
  }

  String get _adminUrl {
    // `${baseUrl}/admin/events/${event_id}/instance_details/${id}/user_registrations/${userId}`
    final baseUrl = BackendHelper.webBase;
    final instance = widget.instance;
    final eventId = Uri.encodeComponent(instance.eventId);
    final instanceId = Uri.encodeComponent(instance.id);
    final userId = Uri.encodeComponent(widget.userId);

    return '$baseUrl/admin/events/$eventId/instance_details/$instanceId/user_registrations/$userId';
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    final url = _adminUrl.trim();
    final hasUrl = url.isNotEmpty;

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: icon + "Ticket"
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.qr_code_2, size: 18),
                const SizedBox(width: 8),
                Text(
                  localize('Ticket'),
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // QR code (or placeholder if URL is somehow empty)
            Center(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: theme.colorScheme.outline.withValues(alpha: 0.3),
                  ),
                ),
                padding: const EdgeInsets.all(8),
                child:
                    hasUrl
                        ? Container(
                          color: Colors.white,
                          child: QrImageView(
                            data: url,
                            size: 220,
                            version: QrVersions.auto,
                            gapless: true,
                          ),
                        )
                        : _buildQrPlaceholder(context),
              ),
            ),

            const SizedBox(height: 12),

            // Explainer
            Text(
              localize(
                'This QR code can be scanned to show an event administrator all of the registrations on your account for this event. You do not need a separate code per registrant—this single code is valid for all of your registrants.',
              ),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.textTheme.bodySmall?.color?.withValues(
                  alpha: 0.75,
                ),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 8),

            // Registrant count
            if (_initialized)
              RichText(
                text: TextSpan(
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.textTheme.bodySmall?.color?.withValues(
                      alpha: 0.75,
                    ),
                  ),
                  children: [
                    TextSpan(text: '${localize('Registrants')}: '),
                    TextSpan(
                      text: '${_registrantCount.clamp(0, 1 << 31)}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                    TextSpan(
                      text:
                          '  (${localize('Code will remain valid even if registrants are added or dropped.')})',
                    ),
                  ],
                ),
              )
            else
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.8,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        theme.colorScheme.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    localize('Loading registrant count…'),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(
                        alpha: 0.7,
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildQrPlaceholder(BuildContext context) {
    final theme = Theme.of(context);
    final localize = LocalizationHelper.localize;

    return Container(
      width: 220,
      height: 220,
      alignment: Alignment.center,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.error_outline,
            size: 32,
            color: theme.colorScheme.error.withValues(alpha: 0.8),
          ),
          const SizedBox(height: 8),
          Text(
            localize('Unable to generate ticket code'),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.75),
            ),
          ),
        ],
      ),
    );
  }
}
