import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/event_registration_helper.dart';
import 'package:app/helpers/user_helper.dart';
import 'package:app/models/event_v2.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/models/family_member.dart';
import 'package:app/helpers/time_formatter.dart';

/// -----------------------------
/// Display helpers (exported so UI can reuse)
/// -----------------------------

String fmtDateTime(String? iso) {
  if (iso == null || iso.trim().isEmpty) return '—';
  try {
    final parsed = safeParseIsoLocal(iso) ?? DateTime.parse(iso);
    final dt = parsed.toLocal();
    // Mon, Jan 2, 2025 3:04 PM
    return DateFormat('EEE, MMM d, y h:mm a').format(dt);
  } catch (_) {
    // If everything explodes, at least show the raw value instead of crashing.
    return iso;
  }
}

String money(num n) {
  // USD-centric for now; matches web semantics.
  return NumberFormat.simpleCurrency(name: 'USD').format(n);
}

/// -----------------------------
/// Local types (mirroring TS)
/// -----------------------------

enum PaymentMethod { free, door, paypal }

enum RegPhase { open, notOpenYet, deadlinePassed, closed }

class Registrant {
  final bool isSelf;
  final String? id;
  final String displayName;
  final String? gender; // "M" | "F" | null
  final DateTime? dateOfBirth;
  final bool? membership;

  Registrant({
    required this.isSelf,
    required this.id,
    required this.displayName,
    required this.gender,
    required this.dateOfBirth,
    required this.membership,
  });
}

/// Attendee row type that mirrors the TS AttendeeRow used by the card.
class PersonPayload {
  final String id;
  final String? firstName;
  final String? lastName;
  final String? dateOfBirthIso;
  final String? gender;

  const PersonPayload({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.dateOfBirthIso,
    required this.gender,
  });
}

class AttendeeRow {
  final String id;
  final String displayName;
  final String? gender; // "M" | "F" | null
  final String? dateOfBirthIso;
  final bool isSelf;
  final PersonPayload personPayload;

  const AttendeeRow({
    required this.id,
    required this.displayName,
    required this.gender,
    required this.dateOfBirthIso,
    required this.isSelf,
    required this.personPayload,
  });
}

class AttendeePaymentInfo {
  final EventPaymentType? option;
  final double? price;
  final bool? complete;
  final double refundableRemaining;
  final double totalRefunded;

  const AttendeePaymentInfo({
    required this.option,
    required this.price,
    required this.complete,
    required this.refundableRemaining,
    required this.totalRefunded,
  });
}

/// -----------------------------
/// Pure utilities (logic only)
/// -----------------------------

int? _getAgeOn(DateTime? dateOfBirth, DateTime on) {
  if (dateOfBirth == null) return null;
  final ref = on;
  var age = ref.year - dateOfBirth.year;
  if (ref.month < dateOfBirth.month ||
      (ref.month == dateOfBirth.month && ref.day < dateOfBirth.day)) {
    age--;
  }
  return age;
}

bool _genderMatches(EventGenderOption? eventGender, String? personGender) {
  if (eventGender == null || eventGender == EventGenderOption.all) return true;
  if (personGender == null) return false;
  switch (eventGender) {
    case EventGenderOption.male:
      return personGender == 'M';
    case EventGenderOption.female:
      return personGender == 'F';
    case EventGenderOption.all:
      return true;
  }
}

bool _withinAgeRange(int? min, int? max, int? personAge) {
  if (personAge == null) {
    return !(min is int || max is int);
  }
  if (min is int && personAge < min) return false;
  if (max is int && personAge > max) return false;
  return true;
}

bool eventIsFull(UserFacingEvent event) {
  final max = event.maxSpots ?? 0;
  final seats = event.seatsFilled;
  return max > 0 && seats >= max;
}

bool requiresPayment(UserFacingEvent event) {
  final price = event.price;
  final hasOptions = event.paymentOptions.isNotEmpty;
  return price > 0 && hasOptions;
}

double memberUnitPrice(UserFacingEvent event, bool? isMember) {
  final std = max(0.0, event.price);
  final member = event.memberPrice;
  if ((isMember ?? false) && member != null) {
    return max(0.0, member);
  }
  return std;
}

bool requiresPaymentForUser(UserFacingEvent event, bool? isMember) {
  final hasOptions = event.paymentOptions.isNotEmpty;
  final priceForUser = memberUnitPrice(event, isMember);
  return hasOptions && priceForUser > 0;
}

bool _hasPayPalInExistingRegistrations(UserFacingEvent event) {
  final reg = event.eventRegistrations;
  if (reg == null) return false;

  bool usedPayPal(PaymentDetails? pd) {
    if (pd == null) return false;
    return pd.paymentType == EventPaymentType.paypal && pd.paymentComplete;
  }

  if (usedPayPal(reg.selfPaymentDetails)) return true;

  if (reg.familyPaymentDetails.isNotEmpty) {
    for (final pd in reg.familyPaymentDetails.values) {
      if (usedPayPal(pd)) return true;
    }
  }

  return false;
}

/// Result object for the "get all people" call (profile + family).
class PeopleResult {
  final ProfileInfo profile;
  final List<FamilyMember> family;

  const PeopleResult({required this.profile, required this.family});
}

/// -----------------------------
/// Controller (hook equivalent)
/// -----------------------------

/// Hook-like controller for the RegistrationPaymentModal logic.
///
/// Create an instance per modal, call [initialize()] before use, then
/// bind its fields/methods into your Flutter widgets (e.g. via ChangeNotifierProvider).
class RegistrationPaymentModalHelper extends ChangeNotifier {
  final String instanceId;
  final UserFacingEvent event;
  final List<EventPaymentOption>? allowedPaymentOptions;

  /// Called on successful change-registration (or equivalent).
  final void Function(PaymentMethod method, RegistrationChangeResponse? resp)?
  onSuccess;

  /// Called when we want to surface a user-visible error string.
  final void Function(String msg)? onError;

  /// Called when a PayPal order is created (mobile replacement
  /// for window.location + sessionStorage).
  final void Function(
    String orderId,
    String approveUrl,
    RegistrationDetails finalDetails,
  )?
  onPayPalOrderCreated;

  RegistrationPaymentModalHelper({
    required this.instanceId,
    required this.event,
    this.allowedPaymentOptions,
    this.onSuccess,
    this.onError,
    this.onPayPalOrderCreated,
  }) : _initialSelfRegistered =
           event.eventRegistrations?.selfRegistered ?? false,
       _initialFamilyRegistered = List<String>.from(
         event.eventRegistrations?.familyRegistered ?? const <String>[],
       ),
       hasExistingReg = event.hasRegistrations {
    _initialFamilyRegisteredSet = _initialFamilyRegistered.toSet();
    _unitPrice = memberUnitPrice(event, null); // recomputed once profile loads
    _computeStaticFlags();

    _payOptions = allowedPaymentOptions ?? event.paymentOptions;

    // Default method choice; will be re-evaluated after membership is known.
    if (_isPaidEvent) {
      if (_payOptions.contains(EventPaymentOption.paypal)) {
        method = PaymentMethod.paypal;
      } else if (_payOptions.contains(EventPaymentOption.door)) {
        method = PaymentMethod.door;
      } else {
        method = PaymentMethod.free;
      }
    } else {
      method = PaymentMethod.free;
    }

    // Selection starts as current registration snapshot.
    selfSelected = _initialSelfRegistered;
    selectedFamily = {for (final id in _initialFamilyRegistered) id: true};
  }

  // ------------------------------
  // Household state
  // ------------------------------

  bool loading = false;
  String? loadErr;
  ProfileInfo? profile;
  List<FamilyMember> family = <FamilyMember>[];

  // ------------------------------
  // Initial registration snapshot
  // ------------------------------

  final bool _initialSelfRegistered;
  final List<String> _initialFamilyRegistered;
  late final Set<String> _initialFamilyRegisteredSet;

  bool get initialSelfRegistered => _initialSelfRegistered;
  Set<String> get initialFamilyRegisteredSet => _initialFamilyRegisteredSet;

  final bool hasExistingReg;

  // ------------------------------
  // Event / payment flags
  // ------------------------------

  late bool _baseEventPaid;
  late List<EventPaymentOption> _payOptions;
  late DateTime _now;
  late DateTime? opensAt;
  late DateTime? deadlineAt;
  late DateTime? refundDeadlineAt;
  late bool full;
  late RegPhase regPhase;
  late DateTime eventDate;

  bool _isPaidEvent = false;
  bool get isPaidEvent => _isPaidEvent;
  bool get baseEventPaid => _baseEventPaid;
  List<EventPaymentOption> get payOptions => _payOptions;

  void _computeStaticFlags() {
    _baseEventPaid = event.price > 0;
    _now = DateTime.now();

    // Use the same parsing semantics as EventShowcaseV2: safeParseIsoLocal + toLocal
    opensAt =
        event.registrationOpens != null
            ? safeParseIsoLocal(event.registrationOpens!)?.toLocal()
            : null;

    deadlineAt =
        event.registrationDeadline != null
            ? safeParseIsoLocal(event.registrationDeadline!)?.toLocal()
            : null;

    refundDeadlineAt =
        event.automaticRefundDeadline != null
            ? safeParseIsoLocal(event.automaticRefundDeadline!)?.toLocal()
            : null;

    full = eventIsFull(event);

    // Same regPhase logic as EventShowcaseV2
    if (!event.registrationAllowed) {
      regPhase = RegPhase.closed;
    } else if (opensAt != null && _now.isBefore(opensAt!)) {
      regPhase = RegPhase.notOpenYet;
    } else if (deadlineAt != null && _now.isAfter(deadlineAt!)) {
      regPhase = RegPhase.deadlinePassed;
    } else {
      regPhase = RegPhase.open;
    }

    // Keep eventDate aligned with the same parsing approach
    eventDate = safeParseIsoLocal(event.date)?.toLocal() ?? DateTime.now();
  }

  // ------------------------------
  // Unit price (member-aware)
  // ------------------------------

  late double _unitPrice;
  double get unitPrice => _unitPrice;

  // ------------------------------
  // UI selection (self + family)
  // ------------------------------

  late bool selfSelected;
  late Map<String, bool> selectedFamily;

  List<String> get selectedFamilyIds =>
      selectedFamily.entries
          .where((e) => e.value && e.key != 'SELF')
          .map((e) => e.key)
          .toList();

  void setSelfSelected(bool value) {
    if (selfSelected == value) return;
    selfSelected = value;
    _recomputeMoney();
    notifyListeners();
  }

  void setSelectedFamily(Map<String, bool> value) {
    selectedFamily = Map<String, bool>.from(value);
    _recomputeMoney();
    notifyListeners();
  }

  void onChangeFamilyFromIds(List<String> ids) {
    selectedFamily = {for (final id in ids) id: true};
    _recomputeMoney();
    notifyListeners();
  }

  // ------------------------------
  // Discount state
  // ------------------------------

  bool discountApplying = false;
  String? discountErr;
  DiscountCodeCheckResponse? discount;

  int get _selectedCount {
    var n = 0;
    if (selfSelected) n += 1;
    for (final id in selectedFamily.keys) {
      if (selectedFamily[id] == true) n += 1;
    }
    return n;
  }

  double _dropTwoDecimalPlaces(double n) {
    return (n * 100).truncateToDouble() / 100.0;
  }

  double _refundableRemainingFromPaymentDetails(
    PaymentDetails? pd,
    double fallbackUnitPrice,
  ) {
    if (pd == null) return 0;

    double base;
    if (pd.refundableAmount != null) {
      base = pd.refundableAmount!;
    } else if (!pd.price.isNaN) {
      base = pd.price;
    } else {
      base = fallbackUnitPrice;
    }

    final double already = (!pd.amountRefunded.isNaN) ? pd.amountRefunded : 0.0;
    final double remaining = base - already;
    if (!remaining.isFinite) return 0;

    final double clamped = remaining > 0 ? remaining : 0.0;
    return _dropTwoDecimalPlaces(clamped);
  }

  double _calcEffectiveUnit(double unit, int count) {
    if (discount == null) return unit;

    if (count == 0) {
      count = 1;
    }

    final usesLeft = discount!.usesLeft;
    final L = usesLeft == null ? count : max(0, min(count, usesLeft));
    if (L == 0) return unit;

    final isPercent = discount!.isPercent ?? false;
    final double discountValue = (discount!.discount ?? 0).toDouble();

    double perPersonAfter;
    if (isPercent) {
      final raw = unit * (1 - discountValue / 100.0);
      perPersonAfter = max(0.0, _dropTwoDecimalPlaces(raw));
    } else {
      final raw = unit - min(unit, discountValue).toDouble();
      perPersonAfter = max(0.0, _dropTwoDecimalPlaces(raw));
    }

    final total = _dropTwoDecimalPlaces(
      perPersonAfter * L + unit * (count - L),
    );
    return _dropTwoDecimalPlaces(total / count);
  }

  double summaryUnitPrice = 0.0;

  Future<void> applyDiscountCode(String rawCode) async {
    discountErr = null;
    final code = rawCode.trim();
    if (code.isEmpty) {
      discount = null;
      summaryUnitPrice = _calcEffectiveUnit(unitPrice, _selectedCount);
      _recomputeMoney();
      notifyListeners();
      return;
    }

    discountApplying = true;
    notifyListeners();

    try {
      final req = DiscountCodeCheckRequest(
        eventId: event.eventId,
        discountCode: code,
      );
      final resp = await EventRegistrationHelper.validateDiscountCodeForEvent(
        req,
      );
      if (!resp.success || resp.id == null) {
        discount = null;
        discountErr =
            resp.msg ??
            LocalizationHelper.localize(
              'This discount code is not valid for this event.',
            );
      } else {
        discount = resp;
      }
    } catch (_) {
      discount = null;
      discountErr = LocalizationHelper.localize(
        'Could not validate discount code.',
      );
    } finally {
      discountApplying = false;
      summaryUnitPrice = _calcEffectiveUnit(unitPrice, _selectedCount);
      _recomputeMoney();
      notifyListeners();
    }
  }

  void clearDiscountCode() {
    discountErr = null;
    discount = null;
    summaryUnitPrice = _calcEffectiveUnit(unitPrice, _selectedCount);
    _recomputeMoney();
    notifyListeners();
  }

  // ------------------------------
  // Payment method
  // ------------------------------

  late PaymentMethod method;
  bool get canUsePayPal =>
      isPaidEvent && _payOptions.contains(EventPaymentOption.paypal);
  bool get canUseDoor =>
      isPaidEvent && _payOptions.contains(EventPaymentOption.door);
  bool get isPayPal => method == PaymentMethod.paypal;
  bool get isDoor => method == PaymentMethod.door;

  bool get showPayPalFeeWarning =>
      _hasPayPalInExistingRegistrations(event) || canUsePayPal;

  void setMethod(PaymentMethod value) {
    if (method == value) return;
    method = value;
    _recomputeMoney();
    notifyListeners();
  }

  // ------------------------------
  // Derived registrant rows (self + family)
  // ------------------------------

  Registrant? get _selfRegistrant {
    final p = profile;
    if (p == null) return null;
    final display =
        '${p.firstName} ${p.lastName}'.trim().isNotEmpty
            ? '${p.firstName} ${p.lastName}'.trim()
            : 'You';
    return Registrant(
      isSelf: true,
      id: null,
      displayName: '$display ${LocalizationHelper.localize("(You)")}',
      gender: p.gender,
      dateOfBirth: p.birthday,
      membership: p.membership,
    );
  }

  List<Registrant> get _familyRegistrants {
    final membership = profile?.membership;
    return family
        .map(
          (p) => Registrant(
            isSelf: false,
            id: p.id,
            displayName:
                '${p.firstName} ${p.lastName}'.trim().isNotEmpty
                    ? '${p.firstName} ${p.lastName}'.trim()
                    : p.id,
            gender: p.gender,
            dateOfBirth: p.dateOfBirth,
            membership: membership,
          ),
        )
        .toList();
  }

  List<String> personEligibilityReasons(Registrant r) {
    final reasons = <String>[];
    if (event.membersOnly && !(r.membership ?? false)) {
      reasons.add(
        LocalizationHelper.localize('This event is for Members Only'),
      );
    }

    if (!_genderMatches(event.gender, r.gender)) {
      if (event.gender == EventGenderOption.male) {
        reasons.add(LocalizationHelper.localize('This event is for Men Only'));
      } else if (event.gender == EventGenderOption.female) {
        reasons.add(
          LocalizationHelper.localize('This event is for Women Only'),
        );
      }
    }

    final age = _getAgeOn(r.dateOfBirth, eventDate);
    final minAge = event.minAge;
    final maxAge = event.maxAge;
    final ageBad = !_withinAgeRange(minAge, maxAge, age);

    if (ageBad) {
      if (minAge != null && maxAge != null) {
        reasons.add(
          '${LocalizationHelper.localize('This event is for Ages:')} $minAge–$maxAge',
        );
      } else if (minAge != null) {
        reasons.add(
          '${LocalizationHelper.localize('This event is for Ages:')} $minAge+',
        );
      } else if (maxAge != null) {
        reasons.add(
          '${LocalizationHelper.localize('This event is for Ages:')} ≤ $maxAge',
        );
      }
    }

    return reasons;
  }

  String? hardIneligible(Registrant r) {
    if (regPhase != RegPhase.open) {
      return LocalizationHelper.localize('Registration not open');
    }
    if (full) {
      return LocalizationHelper.localize('Event full');
    }
    final reasons = personEligibilityReasons(r);
    return reasons.isNotEmpty
        ? LocalizationHelper.localize('Does not meet requirements')
        : null;
  }

  // ------------------------------
  // AttendeeRows for UI
  // ------------------------------

  late List<AttendeeRow> attendeeRows = <AttendeeRow>[];

  AttendeePaymentInfo? paymentInfoFor(AttendeeRow row) {
    final reg = event.eventRegistrations;
    if (reg == null) return null;

    PaymentDetails? pd;
    if (row.isSelf) {
      if (!_initialSelfRegistered) return null;
      pd = reg.selfPaymentDetails;
    } else {
      if (!_initialFamilyRegisteredSet.contains(row.id)) return null;
      pd = reg.familyPaymentDetails[row.id];
    }

    if (pd == null) return null;

    final price = !pd.price.isNaN ? pd.price : null;
    final refundableRemaining = _refundableRemainingFromPaymentDetails(
      pd,
      price ?? unitPrice,
    );
    final totalRefunded = !pd.amountRefunded.isNaN ? pd.amountRefunded : 0.0;

    return AttendeePaymentInfo(
      option: pd.paymentType,
      price: price,
      complete: pd.paymentComplete,
      refundableRemaining: refundableRemaining,
      totalRefunded: totalRefunded,
    );
  }

  // ------------------------------
  // Money math
  // ------------------------------

  int addSelf = 0;
  int addFamilies = 0;
  int addsCount = 0;
  int removeSelf = 0;
  int removeFamilies = 0;
  int removesCount = 0;

  double payNow = 0.0;
  double refundNow = 0.0;
  double payAtDoor = 0.0;
  double creditAtDoor = 0.0;

  double get netOnlineNow => payNow - refundNow;
  double get netAtDoorLater => payAtDoor - creditAtDoor;

  late bool _hasAnyOrigPayPal;
  late bool _hasAnyOrigDoor;

  bool get canUsePayPalOrPast =>
      isPaidEvent && (canUsePayPal || _hasAnyOrigPayPal);
  bool get canUseDoorOrPast => isPaidEvent && (canUseDoor || _hasAnyOrigDoor);

  bool get showOnlineNow =>
      canUsePayPalOrPast && (payNow != 0 || refundNow != 0 || isPayPal);
  bool get showDoorLater =>
      canUseDoorOrPast && (payAtDoor != 0 || creditAtDoor != 0 || isDoor);

  bool get showGrand =>
      showOnlineNow &&
      showDoorLater &&
      (netOnlineNow != 0 || netAtDoorLater != 0);

  String signMoney(num n) {
    final sign = n >= 0 ? '+' : '−';
    return '$sign${money(n.abs())}';
  }

  String get headerLabel =>
      hasExistingReg
          ? LocalizationHelper.localize('Change Registration')
          : LocalizationHelper.localize('Register for Event');

  void _computeOriginalPaymentFlags() {
    final reg = event.eventRegistrations;
    var anyPayPal = false;
    var anyDoor = false;

    if (reg != null) {
      if (reg.selfRegistered &&
          reg.selfPaymentDetails?.paymentType == EventPaymentType.paypal) {
        anyPayPal = true;
      }
      if (reg.selfRegistered &&
          reg.selfPaymentDetails?.paymentType == EventPaymentType.door) {
        anyDoor = true;
      }
      for (final entry in reg.familyPaymentDetails.entries) {
        if (entry.value.paymentType == EventPaymentType.paypal) {
          anyPayPal = true;
        }
        if (entry.value.paymentType == EventPaymentType.door) {
          anyDoor = true;
        }
      }
    }

    _hasAnyOrigPayPal = anyPayPal;
    _hasAnyOrigDoor = anyDoor;
  }

  ({
    PaymentMethod? method,
    double? price,
    bool? complete,
    double refundableRemaining,
  })?
  _originalPaymentForRegistrantWithPrice(AttendeeRow row) {
    final reg = event.eventRegistrations;
    if (reg == null) return null;

    PaymentDetails? d;
    bool initiallyRegistered;

    if (row.isSelf) {
      initiallyRegistered = _initialSelfRegistered;
      d = reg.selfPaymentDetails;
    } else {
      initiallyRegistered = _initialFamilyRegisteredSet.contains(row.id);
      d = reg.familyPaymentDetails[row.id];
    }

    if (!initiallyRegistered || d == null) return null;

    final price = !d.price.isNaN ? d.price : null;
    final refundableRemaining = _refundableRemainingFromPaymentDetails(
      d,
      price ?? unitPrice,
    );

    return (
      method:
          d.paymentType == EventPaymentType.free
              ? PaymentMethod.free
              : (d.paymentType == EventPaymentType.door
                  ? PaymentMethod.door
                  : PaymentMethod.paypal),
      price: price,
      complete: d.paymentComplete,
      refundableRemaining: refundableRemaining,
    );
  }

  void _recomputeMoney() {
    // Update paid flags now that membership may be known.
    _isPaidEvent = requiresPaymentForUser(event, profile?.membership);
    _unitPrice = memberUnitPrice(event, profile?.membership);
    summaryUnitPrice = _calcEffectiveUnit(_unitPrice, _selectedCount);

    // Recompute original payment flags once registration details are known.
    _computeOriginalPaymentFlags();

    // Adds / removes
    addSelf = (selfSelected && !_initialSelfRegistered) ? 1 : 0;
    addFamilies =
        selectedFamilyIds
            .where((id) => !_initialFamilyRegisteredSet.contains(id))
            .length;
    addsCount = addSelf + addFamilies;

    removeSelf = (!selfSelected && _initialSelfRegistered) ? 1 : 0;
    removeFamilies =
        _initialFamilyRegisteredSet
            .where((id) => !selectedFamilyIds.contains(id))
            .length;
    removesCount = removeSelf + removeFamilies;

    payNow = 0;
    refundNow = 0;
    payAtDoor = 0;
    creditAtDoor = 0;

    if (isPaidEvent && addsCount > 0) {
      if (isPayPal) {
        payNow += addsCount * summaryUnitPrice;
      } else if (isDoor) {
        payAtDoor += addsCount * summaryUnitPrice;
      }
    }

    if (isPaidEvent && removesCount > 0) {
      final rowsById = {for (final r in attendeeRows) r.id: r};
      final removedRows = <AttendeeRow>[];

      if (removeSelf > 0 && rowsById.containsKey('SELF')) {
        removedRows.add(rowsById['SELF']!);
      }
      for (final id in _initialFamilyRegisteredSet) {
        if (!selectedFamilyIds.contains(id) && rowsById.containsKey(id)) {
          removedRows.add(rowsById[id]!);
        }
      }

      for (final row in removedRows) {
        final orig = _originalPaymentForRegistrantWithPrice(row);
        if (orig == null || orig.method == null) continue;

        final priceEach = orig.price ?? unitPrice;
        final refundableEach = orig.refundableRemaining;

        if (orig.method == PaymentMethod.paypal && (orig.complete ?? false)) {
          refundNow += refundableEach;
        } else if (orig.method == PaymentMethod.door) {
          creditAtDoor += priceEach;
        } else {
          // free or unknown → no dollar movement
        }
      }
    }
  }

  void _buildAttendeeRows() {
    final rows = <AttendeeRow>[];

    final self = _selfRegistrant;
    if (self != null) {
      final dobIso = self.dateOfBirth?.toIso8601String();
      rows.add(
        AttendeeRow(
          id: 'SELF',
          displayName: self.displayName,
          gender: self.gender,
          dateOfBirthIso: dobIso,
          isSelf: true,
          personPayload: PersonPayload(
            id: 'SELF',
            firstName: profile?.firstName,
            lastName: profile?.lastName,
            dateOfBirthIso: dobIso,
            gender: profile?.gender,
          ),
        ),
      );
    }

    for (final p in family) {
      final dobIso = p.dateOfBirth.toIso8601String();
      rows.add(
        AttendeeRow(
          id: p.id,
          displayName:
              '${p.firstName} ${p.lastName}'.trim().isNotEmpty
                  ? '${p.firstName} ${p.lastName}'.trim()
                  : p.id,
          gender: p.gender,
          dateOfBirthIso: dobIso,
          isSelf: false,
          personPayload: PersonPayload(
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            dateOfBirthIso: dobIso,
            gender: p.gender,
          ),
        ),
      );
    }

    attendeeRows = rows;
  }

  String? disabledReasonFor(AttendeeRow row) {
    final initiallyRegistered =
        row.isSelf
            ? _initialSelfRegistered
            : _initialFamilyRegisteredSet.contains(row.id);

    if (regPhase != RegPhase.open) {
      return initiallyRegistered
          ? null
          : LocalizationHelper.localize('Registration not open');
    }

    if (eventIsFull(event) && !initiallyRegistered) {
      return LocalizationHelper.localize('Event full');
    }

    if (!initiallyRegistered) {
      final registrant =
          row.isSelf
              ? _selfRegistrant
              : Registrant(
                isSelf: false,
                id: row.id,
                displayName: row.displayName,
                gender: row.gender,
                dateOfBirth:
                    row.dateOfBirthIso != null
                        ? DateTime.tryParse(row.dateOfBirthIso!)
                        : null,
                membership: profile?.membership,
              );
      if (registrant != null) {
        final reasons = personEligibilityReasons(registrant);
        if (reasons.isNotEmpty) {
          return LocalizationHelper.localize('Does not meet requirements');
        }
      }
    }

    return null;
  }

  List<String> personReasonsFor(AttendeeRow row) {
    final registrant =
        row.isSelf
            ? _selfRegistrant
            : Registrant(
              isSelf: false,
              id: row.id,
              displayName: row.displayName,
              gender: row.gender,
              dateOfBirth:
                  row.dateOfBirthIso != null
                      ? DateTime.tryParse(row.dateOfBirthIso!)
                      : null,
              membership: profile?.membership,
            );

    if (registrant == null) return const <String>[];

    final reasons = personEligibilityReasons(registrant);
    final age = _getAgeOn(registrant.dateOfBirth, eventDate);
    reasons.insert(
      0,
      '${LocalizationHelper.localize('Age at time of Event:')} ${age ?? '—'}',
    );
    return reasons;
  }

  // ------------------------------
  // People load / refresh
  // ------------------------------

  /// Call this once when the modal/page is created.
  Future<void> initialize() async {
    await _loadPeople();
    _recomputeMoney();
  }

  Future<void> _loadPeople() async {
    loading = true;
    loadErr = null;
    notifyListeners();

    try {
      final res = await UserHelper.getAllPeople();

      if (!res.success || res.profile == null) {
        // Mirror TS behavior: show backend msg if we have it
        final msg =
            (res.msg.isNotEmpty ? res.msg : 'Failed to load your people.');
        loadErr = LocalizationHelper.localize(msg);
        return;
      }

      // hydrate household
      profile = res.profile;
      family = List.from(res.familyMembers);

      // recompute "is paid" flags now that we know membership
      _isPaidEvent = requiresPaymentForUser(event, profile?.membership);
      _unitPrice = memberUnitPrice(event, profile?.membership);

      // If the event is paid and we haven't chosen a real method yet,
      // pick a sensible default based on available options.
      if (_isPaidEvent && method == PaymentMethod.free) {
        if (_payOptions.contains(EventPaymentOption.paypal)) {
          method = PaymentMethod.paypal;
        } else if (_payOptions.contains(EventPaymentOption.door)) {
          method = PaymentMethod.door;
        }
      }

      // (re)build attendee rows + money math
      _buildAttendeeRows();
      _recomputeMoney();
    } catch (e) {
      loadErr = LocalizationHelper.localize('Failed to load your people.');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Refresh after add/edit/delete of family members.
  /// Mirrors the TS `refreshPeople` behavior: re-fetches all people and
  /// quietly ignores failures.
  Future<void> refreshPeople() async {
    try {
      final res = await UserHelper.getAllPeople();
      if (!res.success || res.profile == null) {
        // TS version just bails silently if not successful
        return;
      }

      profile = res.profile;
      family = List<FamilyMember>.from(res.familyMembers);

      _buildAttendeeRows();
      _recomputeMoney();
      notifyListeners();
    } catch (_) {
      // ignore – same semantics as TS; no UI error spam on refresh
    }
  }

  // ------------------------------
  // Change body / submission
  // ------------------------------

  bool _isNoop() {
    final selfNoChange = _initialSelfRegistered == selfSelected;
    if (!selfNoChange) return false;

    if (_initialFamilyRegisteredSet.length != selectedFamilyIds.length) {
      return false;
    }
    for (final id in selectedFamilyIds) {
      if (!_initialFamilyRegisteredSet.contains(id)) return false;
    }
    return true;
  }

  ChangeEventRegistration _computeChangeBody() {
    bool? selfRegistered;
    if (_initialSelfRegistered != selfSelected) {
      selfRegistered = selfSelected;
    } else {
      selfRegistered = null;
    }

    final prev = _initialFamilyRegisteredSet;
    final nowSet = selectedFamilyIds.toSet();

    final familyMembersRegistering = nowSet
        .where((id) => !prev.contains(id))
        .toList(growable: false);
    final familyMembersUnregistering = prev
        .where((id) => !nowSet.contains(id))
        .toList(growable: false);

    EventPaymentType paymentType;
    final adding =
        (selfRegistered == true) || familyMembersRegistering.isNotEmpty;

    if (adding) {
      if (!isPaidEvent) {
        paymentType = EventPaymentType.free;
      } else {
        paymentType =
            isPayPal ? EventPaymentType.paypal : EventPaymentType.door;
      }
    } else {
      paymentType = EventPaymentType.free;
    }

    return ChangeEventRegistration(
      eventInstanceId: instanceId,
      selfRegistered: selfRegistered,
      familyMembersRegistering: familyMembersRegistering,
      familyMembersUnregistering: familyMembersUnregistering,
      paymentType: paymentType,
      discountCodeId: discount?.id,
    );
  }

  RegistrationDetails _buildFinalDetails() {
    final familyIds =
        selectedFamily.entries.where((e) => e.value).map((e) => e.key).toList();
    final filtered = familyIds
        .where((id) => id != 'SELF')
        .toList(growable: false);
    return RegistrationDetails(
      selfRegistered: selfSelected,
      familyRegistered: filtered,
      selfPaymentDetails: null,
      familyPaymentDetails: const <String, PaymentDetails>{},
    );
  }

  bool submitting = false;

  Future<bool> _submitViaChange({
    EventPaymentType? overridePaymentType,
    double refundNowAmount = 0.0,
  }) async {
    final base = _computeChangeBody();
    final body = ChangeEventRegistration(
      eventInstanceId: base.eventInstanceId,
      selfRegistered: base.selfRegistered,
      familyMembersRegistering: base.familyMembersRegistering,
      familyMembersUnregistering: base.familyMembersUnregistering,
      paymentType: overridePaymentType ?? base.paymentType,
      discountCodeId: discount?.id ?? base.discountCodeId,
    );

    final resp = await EventRegistrationHelper.changeRegistration(body);
    if (!resp.success) {
      final msg =
          resp.msg ??
          LocalizationHelper.localize('Could not update registration.');
      onError?.call(msg);
      return false;
    }

    // UI is responsible for any "registration updated" / "refund processed" toasts.
    onSuccess?.call(
      body.paymentType == EventPaymentType.free
          ? PaymentMethod.free
          : (body.paymentType == EventPaymentType.door
              ? PaymentMethod.door
              : PaymentMethod.paypal),
      resp,
    );
    return true;
  }

  Future<void> _submitPaidCreate() async {
    final base = _computeChangeBody();
    final body = ChangeEventRegistration(
      eventInstanceId: base.eventInstanceId,
      selfRegistered: base.selfRegistered,
      familyMembersRegistering: base.familyMembersRegistering,
      familyMembersUnregistering: base.familyMembersUnregistering,
      paymentType: EventPaymentType.paypal,
      discountCodeId: discount?.id,
    );

    final addsExist =
        (body.selfRegistered == true) ||
        body.familyMembersRegistering.isNotEmpty;

    if (!addsExist) {
      onError?.call(
        LocalizationHelper.localize('No new attendees selected to pay for.'),
      );
      return;
    }

    if (!canUsePayPal) {
      onError?.call(
        LocalizationHelper.localize(
          'Online payment is not available for this event.',
        ),
      );
      return;
    }

    final res = await EventRegistrationHelper.createPaidRegistration(body);
    if (!res.success || res.approveUrl == null || res.orderId == null) {
      final msg =
          res.msg ?? LocalizationHelper.localize('Could not start payment.');
      onError?.call(msg);
      return;
    }

    final finalDetails = _buildFinalDetails();
    onPayPalOrderCreated?.call(res.orderId!, res.approveUrl!, finalDetails);
  }

  Future<void> handleSubmit() async {
    final base = _computeChangeBody();
    final adding =
        (base.selfRegistered == true) ||
        base.familyMembersRegistering.isNotEmpty;

    if (adding) {
      final selfRow = _selfRegistrant;
      final selfEligible =
          selfRow != null &&
          selfSelected &&
          hardIneligible(selfRow) == null &&
          personEligibilityReasons(selfRow).isEmpty;

      final famEligible = _familyRegistrants.any(
        (r) =>
            (selectedFamily[r.id ?? ''] ?? false) &&
            hardIneligible(r) == null &&
            personEligibilityReasons(r).isEmpty,
      );

      if (!selfEligible && !famEligible) {
        onError?.call(
          LocalizationHelper.localize(
            'Select at least one eligible registrant.',
          ),
        );
        return;
      }
    }

    try {
      submitting = true;
      notifyListeners();

      if (_isNoop()) {
        onError?.call(LocalizationHelper.localize('No changes selected.'));
        return;
      }

      if (!isPaidEvent) {
        await _submitViaChange(
          overridePaymentType: EventPaymentType.free,
          refundNowAmount: refundNow,
        );
        return;
      }

      final dueNow =
          isPaidEvent && isPayPal ? addsCount * summaryUnitPrice : 0.0;
      final dueAtDoor =
          isPaidEvent && isDoor ? addsCount * summaryUnitPrice : 0.0;
      final zeroDue = adding && (dueNow + dueAtDoor) == 0.0;

      if (zeroDue) {
        await _submitViaChange(
          overridePaymentType: EventPaymentType.free,
          refundNowAmount: refundNow,
        );
        return;
      }

      if (isPayPal) {
        if (adding) {
          await _submitPaidCreate();
        } else {
          await _submitViaChange(refundNowAmount: refundNow);
        }
        return;
      }

      await _submitViaChange(
        overridePaymentType: EventPaymentType.door,
        refundNowAmount: refundNow,
      );
    } finally {
      submitting = false;
      notifyListeners();
    }
  }
}
