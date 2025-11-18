// registration_payment_page.dart
//
// Full-screen page to mirror RegistrationPaymentModal.tsx.
//
// Wires together:
//  - RegistrationPaymentModalHelper (logic)
//  - EventAttendeesCard (choose self + family)
//  - ApplyDiscountCodesCard (discount codes)
//  - Summary + actions
//
// Online payment redirect (PayPal) is intentionally a NO-OP for now.

import 'package:flutter/material.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/registration_payment_modal_helper.dart';
import 'package:app/models/event_v2.dart';
import 'package:app/widgets/events/event_attendees_card.dart';
import 'package:app/widgets/events/apply_discount_codes_card.dart';
import 'package:app/helpers/payment_stores/event_pending_store.dart';
import 'package:app/pages/events/event_paypal_page.dart';
import 'package:app/helpers/event_registration_helper.dart';

class RegistrationPaymentPage extends StatefulWidget {
  final UserFacingEvent event;
  final String instanceId;

  /// Optional override for allowed payment options (e.g. subset of event.paymentOptions).
  final List<EventPaymentOption>? allowedPaymentOptions;

  /// Called after successful registration/change.
  final void Function(PaymentMethod method, RegistrationChangeResponse? resp)?
  onSuccess;

  /// Called to surface user-visible errors.
  final void Function(String msg)? onError;

  /// Optional hook to open “manage family members” UI.
  /// If provided, this will be used instead of a no-op to show the add-family button.
  final Future<void> Function()? onAddFamilyMember;

  const RegistrationPaymentPage({
    super.key,
    required this.event,
    required this.instanceId,
    this.allowedPaymentOptions,
    this.onSuccess,
    this.onError,
    this.onAddFamilyMember,
  });

  @override
  State<RegistrationPaymentPage> createState() =>
      _RegistrationPaymentPageState();
}

class _RegistrationPaymentPageState extends State<RegistrationPaymentPage> {
  late final RegistrationPaymentModalHelper helper;

  @override
  void initState() {
    super.initState();

    helper = RegistrationPaymentModalHelper(
      instanceId: widget.instanceId,
      event: widget.event,
      allowedPaymentOptions: widget.allowedPaymentOptions,
      onSuccess: _handleSuccess,
      onError: widget.onError ?? _defaultOnError,
      onPayPalOrderCreated: _onPayPalOrderCreated,
    );

    // Kick off household load etc.
    helper.initialize();
  }

  @override
  void dispose() {
    helper.dispose();
    super.dispose();
  }

  // ------------------------------
  // Callbacks
  // ------------------------------

  void _defaultOnError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  void _defaultOnSuccess(
    PaymentMethod method,
    RegistrationChangeResponse? resp,
  ) {
    final localize = LocalizationHelper.localize;

    final buffer = StringBuffer();

    // Base message: new registration vs change
    final base =
        helper.hasExistingReg
            ? localize('Registration updated.')
            : localize('Registration complete.');
    buffer.write(base);

    // Build detailed money summary
    final summaryParts = <String>[];

    // --- Online (now) ---
    if (helper.showOnlineNow) {
      final nowDetails = <String>[];

      if (helper.payNow > 0) {
        nowDetails.add(
          localize(
            'charged {amount}',
          ).replaceFirst('{amount}', helper.signMoney(helper.payNow)),
        );
      }

      if (helper.refundNow > 0) {
        // Use negative sign for refunds for readability
        nowDetails.add(
          localize(
            'refunded {amount}',
          ).replaceFirst('{amount}', helper.signMoney(-helper.refundNow)),
        );
      }

      final netNowStr = helper.signMoney(helper.netOnlineNow);

      final nowLabel =
          nowDetails.isEmpty
              ? localize('Now: {net}').replaceFirst('{net}', netNowStr)
              : localize('Now: {net} ({details})')
                  .replaceFirst('{net}', netNowStr)
                  .replaceFirst('{details}', nowDetails.join(', '));

      summaryParts.add(nowLabel);
    }

    // --- At the door (later) ---
    if (helper.showDoorLater) {
      final laterDetails = <String>[];

      if (helper.payAtDoor > 0) {
        laterDetails.add(
          localize(
            'pay at door {amount}',
          ).replaceFirst('{amount}', helper.signMoney(helper.payAtDoor)),
        );
      }

      if (helper.creditAtDoor > 0) {
        laterDetails.add(
          localize(
            'credit at door {amount}',
          ).replaceFirst('{amount}', helper.signMoney(-helper.creditAtDoor)),
        );
      }

      final netLaterStr = helper.signMoney(helper.netAtDoorLater);

      final laterLabel =
          laterDetails.isEmpty
              ? localize('Later: {net}').replaceFirst('{net}', netLaterStr)
              : localize('Later: {net} ({details})')
                  .replaceFirst('{net}', netLaterStr)
                  .replaceFirst('{details}', laterDetails.join(', '));

      summaryParts.add(laterLabel);
    }

    // --- Grand total / no-money case ---
    if (summaryParts.isEmpty) {
      // Free event / no payment movement
      summaryParts.add(
        localize('No payment is due now, and no refund was issued.'),
      );
    } else if (helper.showGrand) {
      final grandStr = helper.signMoney(
        helper.netOnlineNow + helper.netAtDoorLater,
      );
      summaryParts.add(
        localize(
          'Grand total change: {amount}',
        ).replaceFirst('{amount}', grandStr),
      );
    }

    buffer.write(' ');
    buffer.write(summaryParts.join(' • '));

    final msg = buffer.toString();

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  /// Combined success handler: always show our rich toast,
  /// then delegate to any parent onSuccess (e.g. EventShowcaseV2)
  /// so it can pop and refresh.
  void _handleSuccess(PaymentMethod method, RegistrationChangeResponse? resp) {
    // Always show the detailed money toast
    _defaultOnSuccess(method, resp);

    // Then let the parent page do its thing (pop + refresh, etc.)
    widget.onSuccess?.call(method, resp);
  }

  /// Called when a PayPal order has been successfully created.
  ///
  /// This is the entry point into the in-app PayPal flow:
  ///  1) Persist the pending registration details (finalDetails).
  ///  2) Open the PayPal WebView.
  ///  3) On cancel → show a toast and return.
  ///  4) On success → call capture on the backend, show toast, and notify onSuccess.
  Future<void> _onPayPalOrderCreated(
    String orderId,
    String approveUrl,
    RegistrationDetails finalDetails,
  ) async {
    final localize = LocalizationHelper.localize;

    // 1) Save the pending registration details so we can use them after approval.
    await EventPendingStore.savePending(
      instanceId: widget.instanceId,
      orderId: orderId,
      details: finalDetails,
    );

    if (!mounted) return;

    // 2) Open the in-app PayPal WebView and wait for the result.
    final result = await Navigator.of(context).push<PaypalFlowResult>(
      MaterialPageRoute(
        builder:
            (_) => PaypalWebViewPage(
              instanceId: widget.instanceId,
              orderId: orderId,
              approveUrl: approveUrl,
            ),
      ),
    );

    if (!mounted || result == null) {
      // User backed out in some odd way; treat as cancel and do nothing else.
      return;
    }

    if (result.state == PaypalFlowState.cancelled) {
      // User cancelled at PayPal; nothing was captured, no registration change.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(localize('Payment cancelled. No changes were made.')),
        ),
      );
      return;
    }

    // At this point, PayPal returned via the success URL.
    // We still need to CAPTURE the order and apply the registration changes.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(localize('Finalizing your registration…'))),
    );

    final pending = await EventPendingStore.loadPending(
      instanceId: widget.instanceId,
      orderId: orderId,
    );

    if (pending == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            localize(
              'We could not find your pending registration details for this payment.',
            ),
          ),
        ),
      );
      return;
    }

    final captureResp = await EventRegistrationHelper.capturePaidRegistration(
      orderId,
      widget.instanceId,
      pending,
    );

    if (!mounted) return;

    if (!captureResp.success) {
      final msg =
          captureResp.msg ??
          localize('There was a problem completing your payment.');
      _defaultOnError(msg);
      return;
    }

    await EventPendingStore.clearPending(
      instanceId: widget.instanceId,
      orderId: orderId,
    );

    // Reuse the unified success pipeline so PayPal gets the same detailed toast
    // and the parent still gets its refresh/pop behavior.
    _handleSuccess(PaymentMethod.paypal, captureResp);
  }

  Future<void> _handleAddFamilyMember() async {
    if (widget.onAddFamilyMember != null) {
      await widget.onAddFamilyMember!();
      // After user manages family, sync back with server.
      await helper.refreshPeople();
    }
  }

  // ------------------------------
  // UI
  // ------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: AnimatedBuilder(
          animation: helper,
          builder: (_, __) => Text(helper.headerLabel),
        ),
      ),
      body: AnimatedBuilder(
        animation: helper,
        builder: (context, _) {
          return _buildBody(context);
        },
      ),
      bottomNavigationBar: AnimatedBuilder(
        animation: helper,
        builder: (context, _) {
          return _buildBottomBar(context);
        },
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final lang = LocalizationHelper.currentLocale;
    final theme = Theme.of(context);

    // text variants (en vs other) – mirrors TS logic
    late String freeMsg;
    late String freeForMembers;
    late String freeForAll;
    late String changeMsg;
    late String netMsg;
    late String netLater;
    late String netTotal;

    if (lang == 'en') {
      freeMsg = 'Free for members';
      freeForMembers = 'This event is free for members.';
      freeForAll = 'This event is free.';
      changeMsg =
          'You are changing ${helper.addsCount} add(s) and ${helper.removesCount} removal(s).';
      netMsg = 'NET now: ${helper.signMoney(helper.netOnlineNow)}';
      netLater = 'NET later: ${helper.signMoney(helper.netAtDoorLater)}';
      netTotal = 'NET now + NET later';
    } else {
      freeMsg = 'No cost for members';
      freeForMembers = 'This event has no cost for members.';
      freeForAll = 'This event has no cost.';
      changeMsg =
          '${localize("You are registering this amount of people:")} ${helper.addsCount} '
          '${localize("And you are unregistering this amount of people:")} ${helper.removesCount}.';
      netMsg =
          '${localize("NET payment charge now")}: ${helper.signMoney(helper.netOnlineNow)}';
      netLater =
          '${localize("NET payment charge later")}: ${helper.signMoney(helper.netAtDoorLater)}';
      netTotal = localize('NET payment charge in total');
    }

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header / subtitle
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    helper.headerLabel,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    localize('Choose who’s attending and how you’ll pay.'),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withOpacity(0.7),
                    ),
                  ),
                ],
              ),
            ),

            // Event facts / status
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: _buildEventFactsCard(context),
              ),
            ),

            // Allowed attendance
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: _buildWhoCanAttendCard(context),
              ),
            ),

            // Attendees (household)
            if (helper.loading)
              Row(
                children: [
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    localize('Loading your household…'),
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              )
            else if (helper.loadErr != null)
              Text(
                helper.loadErr!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.red.shade700,
                ),
              )
            else
              EventAttendeesCard(
                rows: helper.attendeeRows,
                selfSelected: helper.selfSelected,
                onToggleSelf: helper.setSelfSelected,
                selectedFamilyIds:
                    helper.selectedFamily.entries
                        .where((e) => e.value && e.key != 'SELF')
                        .map((e) => e.key)
                        .toList(),
                onChangeFamily: helper.onChangeFamilyFromIds,
                initialSelfRegistered: helper.initialSelfRegistered,
                initialFamilyRegistered: helper.initialFamilyRegisteredSet,
                disabledReasonFor: helper.disabledReasonFor,
                personReasonsFor: helper.personReasonsFor,
                // Only show the button if the caller provided a handler.
                onAddFamilyMember:
                    widget.onAddFamilyMember != null
                        ? _handleAddFamilyMember
                        : null,
                paymentInfoFor: helper.paymentInfoFor,
              ),

            const SizedBox(height: 16),

            // Payment method card
            _buildPaymentMethodCard(
              context: context,
              freeMsg: freeMsg,
              freeForMembers: freeForMembers,
              freeForAll: freeForAll,
            ),

            const SizedBox(height: 16),

            if (helper.isPaidEvent)
              // Discount codes
              ApplyDiscountCodesCard(
                applying: helper.discountApplying,
                error: helper.discountErr,
                applied:
                    helper.discount == null
                        ? null
                        : AppliedDiscount(
                          id: helper.discount!.id!,
                          isPercent: helper.discount!.isPercent ?? false,
                          discount: helper.discount!.discount ?? 0.0,
                          usesLeft: helper.discount!.usesLeft,
                        ),
                onApply: helper.applyDiscountCode,
                onClear: helper.clearDiscountCode,
              ),

            const SizedBox(height: 16),

            // Summary
            _buildSummaryCard(
              context: context,
              changeMsg: changeMsg,
              netMsg: netMsg,
              netLater: netLater,
              netTotal: netTotal,
            ),

            const SizedBox(height: 12),

            if (helper.full)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      size: 16,
                      color: Color(0xFFB91C1C),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        localize('Event is currently full.'),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFFB91C1C),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildEventFactsCard(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);
    final event = widget.event;

    String recurrenceLabel() {
      final rec = event.recurring;
      if (rec == EventRecurrence.never) {
        return localize('One-time');
      }
      // We'll trust the backend strings for now, mirroring TS `Repeats ${event.recurring}`
      return localize('Repeats ${rec.name}');
    }

    return Column(
      children: [
        // Grid-like layout, but simple column on mobile
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.event, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localize('Event takes place on'),
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(localize(fmtDateTime(event.date))),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.repeat, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localize('Series'),
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(recurrenceLabel()),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.account_balance_wallet_outlined, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localize('Price'),
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (helper.unitPrice == 0)
                    Container(
                      margin: const EdgeInsets.only(top: 2),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF3),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Text(
                        localize('Free for members'),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF047857),
                        ),
                      ),
                    )
                  else if (helper.baseEventPaid)
                    Text(
                      '${money(helper.unitPrice)} ${localize("per person")}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    )
                  else
                    Container(
                      margin: const EdgeInsets.only(top: 2),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF3),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Text(
                        localize('Free'),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF047857),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              helper.regPhase == RegPhase.open
                  ? Icons.check_circle
                  : Icons.warning_amber_rounded,
              size: 18,
              color:
                  helper.regPhase == RegPhase.open
                      ? const Color(0xFF059669)
                      : const Color(0xFFDC2626),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localize('Registration'),
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    () {
                      switch (helper.regPhase) {
                        case RegPhase.closed:
                          return localize('Closed');
                        case RegPhase.notOpenYet:
                          return localize('Not open yet');
                        case RegPhase.deadlinePassed:
                          return localize('Deadline passed');
                        case RegPhase.open:
                          return localize('Open');
                      }
                    }(),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color:
                          helper.regPhase == RegPhase.open
                              ? const Color(0xFF047857)
                              : const Color(0xFFB91C1C),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (helper.opensAt != null) ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.access_time, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localize('Registration Opens'),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      localize(fmtDateTime(helper.opensAt!.toIso8601String())),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
        if (helper.deadlineAt != null) ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.warning_amber_rounded, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localize('Registration Deadline'),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      localize(
                        fmtDateTime(helper.deadlineAt!.toIso8601String()),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
        if (helper.refundDeadlineAt != null) ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.access_time_filled, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localize('Automatic Refund Deadline'),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      localize(
                        fmtDateTime(helper.refundDeadlineAt!.toIso8601String()),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildWhoCanAttendCard(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);
    final event = widget.event;

    Widget genderBadge() {
      switch (event.gender) {
        case EventGenderOption.male:
          return _pill(
            context,
            icon: Icons.male,
            label: localize('Men Only'),
            bg: const Color(0xFFE0F2FE),
            fg: const Color(0xFF1D4ED8),
          );
        case EventGenderOption.female:
          return _pill(
            context,
            icon: Icons.female,
            label: localize('Women Only'),
            bg: const Color(0xFFFCE7F3),
            fg: const Color(0xFFBE185D),
          );
        case EventGenderOption.all:
          return _pill(
            context,
            icon: Icons.people_alt_outlined,
            label: localize('Both Genders'),
            bg: const Color(0xFFECFDF3),
            fg: const Color(0xFF047857),
          );
      }
    }

    String ageLabel() {
      final minAge = event.minAge;
      final maxAge = event.maxAge;
      if (minAge == null && maxAge == null) {
        return localize('All Ages');
      }
      if (minAge != null && maxAge != null) {
        return '$minAge-$maxAge ${localize("Years Old")}';
      }
      if (minAge != null) {
        return '$minAge ${localize("Years Old and Over")}';
      }
      return '${maxAge ?? ''} ${localize("Years Old and Under")}';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.badge_outlined, size: 18),
            const SizedBox(width: 8),
            Text(
              localize('Who can attend'),
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            event.membersOnly
                ? _pill(
                  context,
                  icon: Icons.badge_outlined,
                  label: localize('Members Only'),
                  bg: const Color(0xFFF3E8FF),
                  fg: const Color(0xFF7E22CE),
                )
                : _pill(
                  context,
                  icon: Icons.people_outline,
                  label: localize('Members & Non-Members'),
                  bg: const Color(0xFFECFDF3),
                  fg: const Color(0xFF047857),
                ),
            genderBadge(),
            _pill(
              context,
              icon: Icons.cake_outlined,
              label: ageLabel(),
              bg: const Color(0xFFF8FAFC),
              fg: const Color(0xFF334155),
            ),
          ],
        ),
      ],
    );
  }

  Widget _pill(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color bg,
    required Color fg,
  }) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: bg.withOpacity(0.8)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Flexible(
            fit: FlexFit.loose,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: fg,
                fontSize: 11,
              ),
              softWrap: true,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodCard({
    required BuildContext context,
    required String freeMsg,
    required String freeForMembers,
    required String freeForAll,
  }) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localize('Payment'),
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            if (!helper.isPaidEvent)
              Row(
                children: [
                  const Icon(
                    Icons.check_circle,
                    size: 18,
                    color: Color(0xFF059669),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    fit: FlexFit.loose,
                    child: Text(
                      helper.baseEventPaid && helper.unitPrice == 0
                          ? localize(freeForMembers)
                          : localize(freeForAll),
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                ],
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      if (helper.canUsePayPal)
                        InkWell(
                          onTap: () => helper.setMethod(PaymentMethod.paypal),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Radio<PaymentMethod>(
                                value: PaymentMethod.paypal,
                                groupValue: helper.method,
                                onChanged:
                                    (_) =>
                                        helper.setMethod(PaymentMethod.paypal),
                              ),
                              const Icon(Icons.credit_card, size: 18),
                              const SizedBox(width: 4),
                              Text(localize('Pay online')),
                            ],
                          ),
                        ),
                      if (helper.canUseDoor)
                        InkWell(
                          onTap: () => helper.setMethod(PaymentMethod.door),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Radio<PaymentMethod>(
                                value: PaymentMethod.door,
                                groupValue: helper.method,
                                onChanged:
                                    (_) => helper.setMethod(PaymentMethod.door),
                              ),
                              const Icon(
                                Icons.door_front_door_outlined,
                                size: 18,
                              ),
                              const SizedBox(width: 4),
                              Text(localize('Pay at door')),
                            ],
                          ),
                        ),
                      if (!helper.canUseDoor && !helper.canUsePayPal)
                        Row(
                          children: [
                            const Icon(
                              Icons.warning_amber_rounded,
                              size: 18,
                              color: Color(0xFFB91C1C),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              localize('No payment methods available'),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: const Color(0xFFB91C1C),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  if (helper.showPayPalFeeWarning) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFCD34D)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            size: 16,
                            color: Color(0xFF92400E),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  localize(
                                    'PayPal refunds do not include fees',
                                  ),
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF92400E),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  localize(
                                    'If you pay online using PayPal and later unregister from this event, automatic refunds will return only the ticket amount. Any transaction fees charged by PayPal are non-refundable and will not be returned.',
                                  ),
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: const Color(0xFF92400E),
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard({
    required BuildContext context,
    required String changeMsg,
    required String netMsg,
    required String netLater,
    required String netTotal,
  }) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.attach_money, size: 18),
                const SizedBox(width: 8),
                Text(
                  localize('Summary'),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (!helper.isPaidEvent)
              Text(
                helper.addsCount > 0 || helper.removesCount > 0
                    ? changeMsg
                    : localize('This event is free. No changes selected.'),
                style: theme.textTheme.bodySmall,
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(localize('Unit Price')),
                      Text(
                        money(helper.summaryUnitPrice),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (helper.showOnlineNow)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF9FAFB),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            localize('Online (now)'),
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              _pill(
                                context,
                                icon: Icons.arrow_upward,
                                label:
                                    '+ ${localize("Pay now")}: ${money(helper.payNow)}',
                                bg: const Color(0xFFECFDF3),
                                fg: const Color(0xFF047857),
                              ),
                              _pill(
                                context,
                                icon: Icons.arrow_downward,
                                label:
                                    '− ${localize("Refund now")}: ${money(helper.refundNow)}',
                                bg: const Color(0xFFFFF1F2),
                                fg: const Color(0xFFB91C1C),
                              ),
                              _pill(
                                context,
                                icon: Icons.calculate_outlined,
                                label: netMsg,
                                bg:
                                    helper.netOnlineNow >= 0
                                        ? const Color(0xFFECFDF3)
                                        : const Color(0xFFFFF1F2),
                                fg:
                                    helper.netOnlineNow >= 0
                                        ? const Color(0xFF047857)
                                        : const Color(0xFFB91C1C),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  if (helper.showDoorLater)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            localize('At the door (later)'),
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              _pill(
                                context,
                                icon: Icons.arrow_upward,
                                label:
                                    '+ ${localize("Pay at door")}: ${money(helper.payAtDoor)}',
                                bg: const Color(0xFFECFDF3),
                                fg: const Color(0xFF047857),
                              ),
                              _pill(
                                context,
                                icon: Icons.arrow_downward,
                                label:
                                    '− ${localize("Pay less at door")}: ${money(helper.creditAtDoor)}',
                                bg: const Color(0xFFFFF1F2),
                                fg: const Color(0xFFB91C1C),
                              ),
                              _pill(
                                context,
                                icon: Icons.calculate_outlined,
                                label: netLater,
                                bg:
                                    helper.netAtDoorLater >= 0
                                        ? const Color(0xFFECFDF3)
                                        : const Color(0xFFFFF1F2),
                                fg:
                                    helper.netAtDoorLater >= 0
                                        ? const Color(0xFF047857)
                                        : const Color(0xFFB91C1C),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  if (helper.showGrand)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: const Color(0xFFE5E7EB),
                        ), // slate-200
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              localize('Grand Total'),
                              style: theme.textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              helper.signMoney(
                                helper.netOnlineNow + helper.netAtDoorLater,
                              ),
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color:
                                    (helper.netOnlineNow +
                                                helper.netAtDoorLater) >=
                                            0
                                        ? const Color(0xFF047857)
                                        : const Color(0xFFB91C1C),
                              ),
                              textAlign: TextAlign.right,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    localize(
                      '“Online (now)” reflects immediate movement (charges or refunds). “At the door (later)” reflects what you’ll owe or be credited at the event. “Grand Total” is the sum of both of these, if you have changes in both payment types.',
                    ),
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      color: theme.textTheme.bodySmall?.color?.withOpacity(0.7),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    final localize = LocalizationHelper.localize;
    final theme = Theme.of(context);

    String helperText() {
      if (helper.regPhase != RegPhase.open) {
        if (helper.removesCount > 0 && helper.addsCount == 0) {
          return localize(
            'Registration is closed, but you can remove attendee(s).',
          );
        }
        switch (helper.regPhase) {
          case RegPhase.notOpenYet:
            return localize('Registration hasn’t opened yet.');
          case RegPhase.deadlinePassed:
            return localize('Registration deadline has passed.');
          case RegPhase.closed:
            return localize('Registration is closed.');
          case RegPhase.open:
            break;
        }
      } else if (helper.full && helper.addsCount > 0) {
        return localize('Event is full — you can only remove attendees.');
      } else if (helper.isPaidEvent && helper.isPayPal && helper.payNow > 0) {
        return '${localize("You’ll be redirected to PayPal to pay")} ${money(helper.payNow)}.';
      } else if (helper.isPaidEvent && helper.isDoor && helper.payAtDoor > 0) {
        return localize(
          'The amount you will pay at the door: ${money(helper.payAtDoor)}.',
        );
      } else if (helper.removesCount > 0 && helper.refundNow > 0) {
        return localize(
          'The amount we’ll refund online: ${money(helper.refundNow)}.',
        );
      } else if (helper.removesCount > 0 && helper.creditAtDoor > 0) {
        return localize(
          'The amount you’ll pay less at the door: ${money(helper.creditAtDoor)}.',
        );
      }
      return localize('Click to add or remove event registrants.');
    }

    String primaryLabel() {
      if (helper.regPhase != RegPhase.open) {
        if (helper.removesCount > 0 && helper.addsCount == 0) {
          return localize('Process Changes');
        }
        return localize('Registration Closed');
      }
      final noChanges = helper.addsCount == 0 && helper.removesCount == 0;
      if (noChanges) {
        return localize('No Changes');
      }
      if (!helper.isPaidEvent) {
        return helper.hasExistingReg
            ? localize('Save Registration')
            : localize('Register');
      }
      if (helper.isPayPal) {
        return helper.addsCount > 0
            ? '${localize("Pay")} ${money(helper.payNow)}'
            : localize('Process Changes');
      }
      return localize('Process Changes');
    }

    final bool canSubmit =
        !helper.submitting &&
        ((helper.regPhase == RegPhase.open) ||
            (helper.removesCount > 0 && helper.addsCount == 0)) &&
        (!helper.full || helper.addsCount == 0) &&
        helper.attendeeRows.isNotEmpty;

    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          border: Border(top: BorderSide(color: theme.dividerColor)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: Text(
                helperText(),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.textTheme.bodySmall?.color?.withOpacity(0.7),
                ),
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed:
                  helper.submitting
                      ? null
                      : () => Navigator.of(context).maybePop(),
              child: Text(localize('Cancel')),
            ),
            const SizedBox(width: 4),
            ElevatedButton(
              onPressed: canSubmit ? helper.handleSubmit : null,
              style: ButtonStyle(
                backgroundColor: WidgetStateProperty.all(theme.primaryColor),
                foregroundColor: WidgetStateProperty.all(Colors.white),
              ),
              child:
                  helper.submitting
                      ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : Text(primaryLabel()),
            ),
          ],
        ),
      ),
    );
  }
}
