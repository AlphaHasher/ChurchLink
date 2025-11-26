import 'package:app/models/ministry.dart';

/// How often an event recurs.
enum EventRecurrence { never, weekly, monthly, yearly, daily }

EventRecurrence eventRecurrenceFromJson(String? value) {
  switch (value) {
    case 'weekly':
      return EventRecurrence.weekly;
    case 'monthly':
      return EventRecurrence.monthly;
    case 'yearly':
      return EventRecurrence.yearly;
    case 'daily':
      return EventRecurrence.daily;
    case 'never':
    default:
      return EventRecurrence.never;
  }
}

String eventRecurrenceToJson(EventRecurrence value) {
  switch (value) {
    case EventRecurrence.weekly:
      return 'weekly';
    case EventRecurrence.monthly:
      return 'monthly';
    case EventRecurrence.yearly:
      return 'yearly';
    case EventRecurrence.daily:
      return 'daily';
    case EventRecurrence.never:
      return 'never';
  }
}

/// Allowed gender targeting for an event.
enum EventGenderOption { all, male, female }

EventGenderOption eventGenderOptionFromJson(String? value) {
  switch (value) {
    case 'male':
      return EventGenderOption.male;
    case 'female':
      return EventGenderOption.female;
    case 'all':
    default:
      return EventGenderOption.all;
  }
}

String eventGenderOptionToJson(EventGenderOption value) {
  switch (value) {
    case EventGenderOption.all:
      return 'all';
    case EventGenderOption.male:
      return 'male';
    case EventGenderOption.female:
      return 'female';
  }
}

/// Allowed payment methods for an event instance.
enum EventPaymentOption { paypal, door }

EventPaymentOption eventPaymentOptionFromJson(String? value) {
  switch (value) {
    case 'door':
      return EventPaymentOption.door;
    case 'paypal':
    default:
      return EventPaymentOption.paypal;
  }
}

String eventPaymentOptionToJson(EventPaymentOption value) {
  switch (value) {
    case EventPaymentOption.paypal:
      return 'paypal';
    case EventPaymentOption.door:
      return 'door';
  }
}

/// Type of payment used for a registration line.
enum EventPaymentType { free, paypal, door }

EventPaymentType eventPaymentTypeFromJson(String? value) {
  switch (value) {
    case 'paypal':
      return EventPaymentType.paypal;
    case 'door':
      return EventPaymentType.door;
    case 'free':
    default:
      return EventPaymentType.free;
  }
}

String eventPaymentTypeToJson(EventPaymentType value) {
  switch (value) {
    case EventPaymentType.free:
      return 'free';
    case EventPaymentType.paypal:
      return 'paypal';
    case EventPaymentType.door:
      return 'door';
  }
}

/// Type filter used for "my events" views.
enum MyEventsTypeFilter {
  favoritesAndRegistered,
  registered,
  registeredNotFavorited,
  favorites,
  favoritesNotRegistered,
}

MyEventsTypeFilter? myEventsTypeFilterFromJson(String? value) {
  switch (value) {
    case 'favorites_and_registered':
      return MyEventsTypeFilter.favoritesAndRegistered;
    case 'registered':
      return MyEventsTypeFilter.registered;
    case 'registered_not_favorited':
      return MyEventsTypeFilter.registeredNotFavorited;
    case 'favorites':
      return MyEventsTypeFilter.favorites;
    case 'favorites_not_registered':
      return MyEventsTypeFilter.favoritesNotRegistered;
    default:
      return null;
  }
}

String? myEventsTypeFilterToJson(MyEventsTypeFilter? value) {
  if (value == null) return null;
  switch (value) {
    case MyEventsTypeFilter.favoritesAndRegistered:
      return 'favorites_and_registered';
    case MyEventsTypeFilter.registered:
      return 'registered';
    case MyEventsTypeFilter.registeredNotFavorited:
      return 'registered_not_favorited';
    case MyEventsTypeFilter.favorites:
      return 'favorites';
    case MyEventsTypeFilter.favoritesNotRegistered:
      return 'favorites_not_registered';
  }
}

/// Date filter used for "my events" views.
enum MyEventsDateFilter { upcoming, history, all }

MyEventsDateFilter? myEventsDateFilterFromJson(String? value) {
  switch (value) {
    case 'upcoming':
      return MyEventsDateFilter.upcoming;
    case 'history':
      return MyEventsDateFilter.history;
    case 'all':
      return MyEventsDateFilter.all;
    default:
      return null;
  }
}

String? myEventsDateFilterToJson(MyEventsDateFilter? value) {
  if (value == null) return null;
  switch (value) {
    case MyEventsDateFilter.upcoming:
      return 'upcoming';
    case MyEventsDateFilter.history:
      return 'history';
    case MyEventsDateFilter.all:
      return 'all';
  }
}

/// Payment information for a single registration line item.
class PaymentDetails {
  final EventPaymentType paymentType;
  final double price;
  final double? refundableAmount;
  final double amountRefunded;
  final bool paymentComplete;
  final String? discountCodeId;
  final bool automaticRefundEligibility;
  final String? transactionId;
  final String? lineId;
  final bool? isForced;

  PaymentDetails({
    required this.paymentType,
    required this.price,
    required this.refundableAmount,
    required this.amountRefunded,
    required this.paymentComplete,
    required this.discountCodeId,
    required this.automaticRefundEligibility,
    required this.transactionId,
    required this.lineId,
    required this.isForced,
  });

  factory PaymentDetails.fromJson(Map<String, dynamic> json) {
    return PaymentDetails(
      paymentType: eventPaymentTypeFromJson(json['payment_type'] as String?),
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      refundableAmount: (json['refundable_amount'] as num?)?.toDouble(),
      amountRefunded: (json['amount_refunded'] as num?)?.toDouble() ?? 0.0,
      paymentComplete: json['payment_complete'] as bool? ?? false,
      discountCodeId: json['discount_code_id'] as String?,
      automaticRefundEligibility:
          json['automatic_refund_eligibility'] as bool? ?? false,
      transactionId: json['transaction_id'] as String?,
      lineId: json['line_id'] as String?,
      isForced: json['is_forced'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'payment_type': eventPaymentTypeToJson(paymentType),
      'price': price,
      'refundable_amount': refundableAmount,
      'amount_refunded': amountRefunded,
      'payment_complete': paymentComplete,
      'discount_code_id': discountCodeId,
      'automatic_refund_eligibility': automaticRefundEligibility,
      'transaction_id': transactionId,
      'line_id': lineId,
      'is_forced': isForced,
    };
  }
}

/// Aggregated registration details for an event instance.
class RegistrationDetails {
  final bool selfRegistered;
  final List<String> familyRegistered;
  final PaymentDetails? selfPaymentDetails;
  final Map<String, PaymentDetails> familyPaymentDetails;

  RegistrationDetails({
    required this.selfRegistered,
    required this.familyRegistered,
    required this.selfPaymentDetails,
    required this.familyPaymentDetails,
  });

  factory RegistrationDetails.fromJson(Map<String, dynamic> json) {
    return RegistrationDetails(
      selfRegistered: json['self_registered'] as bool? ?? false,
      familyRegistered:
          (json['family_registered'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList(),
      selfPaymentDetails:
          json['self_payment_details'] != null
              ? PaymentDetails.fromJson(
                Map<String, dynamic>.from(json['self_payment_details'] as Map),
              )
              : null,
      familyPaymentDetails: _familyPaymentDetailsFromJson(
        json['family_payment_details'],
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'self_registered': selfRegistered,
      'family_registered': familyRegistered,
      'self_payment_details': selfPaymentDetails?.toJson(),
      'family_payment_details': familyPaymentDetails.map(
        (key, value) => MapEntry(key, value.toJson()),
      ),
    };
  }

  static Map<String, PaymentDetails> _familyPaymentDetailsFromJson(
    dynamic value,
  ) {
    if (value == null) return <String, PaymentDetails>{};
    final map = Map<String, dynamic>.from(value as Map);
    return map.map(
      (key, v) => MapEntry(
        key,
        PaymentDetails.fromJson(Map<String, dynamic>.from(v as Map)),
      ),
    );
  }
}

/// Localized label/content for an event.
class EventLocalization {
  final String title;
  final String description;
  final String locationInfo;

  EventLocalization({
    required this.title,
    required this.description,
    required this.locationInfo,
  });

  factory EventLocalization.fromJson(Map<String, dynamic> json) {
    return EventLocalization(
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      locationInfo: json['location_info'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'title': title,
      'description': description,
      'location_info': locationInfo,
    };
  }
}

/// Lightweight person details (used by some responses).
class PersonDetails {
  final String? firstName;
  final String? lastName;
  final String? dob;
  final String? gender;

  PersonDetails({
    required this.firstName,
    required this.lastName,
    required this.dob,
    required this.gender,
  });

  factory PersonDetails.fromJson(Map<String, dynamic> json) {
    return PersonDetails(
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      dob: json['DOB'] as String?,
      gender: json['gender'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'first_name': firstName,
      'last_name': lastName,
      'DOB': dob,
      'gender': gender,
    };
  }
}

/// Cursor for paginated event results.
class EventsCursor {
  final String scheduledDate;
  final String id;

  EventsCursor({required this.scheduledDate, required this.id});

  factory EventsCursor.fromJson(Map<String, dynamic> json) {
    return EventsCursor(
      scheduledDate: json['scheduled_date'] as String? ?? '',
      id: json['id'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{'scheduled_date': scheduledDate, 'id': id};
  }
}

/// Parameters for the public user event search endpoint.
class UserEventSearchParams {
  final int limit;
  final int? minAge;
  final int? maxAge;

  /// Values: "all" | "male" | "female" | "male_only" | "female_only"
  final String? gender;
  final List<String>? ministries;
  final bool? uniqueOnly;
  final String? preferredLang;
  final String? cursorScheduledDate;
  final String? cursorId;
  final bool? favoritesOnly;
  final bool? membersOnlyOnly;
  final double? maxPrice;

  UserEventSearchParams({
    required this.limit,
    this.minAge,
    this.maxAge,
    this.gender,
    this.ministries,
    this.uniqueOnly,
    this.preferredLang,
    this.cursorScheduledDate,
    this.cursorId,
    this.favoritesOnly,
    this.membersOnlyOnly,
    this.maxPrice,
  });

  factory UserEventSearchParams.fromJson(Map<String, dynamic> json) {
    return UserEventSearchParams(
      limit: (json['limit'] as num?)?.toInt() ?? 0,
      minAge: (json['min_age'] as num?)?.toInt(),
      maxAge: (json['max_age'] as num?)?.toInt(),
      gender: json['gender'] as String?,
      ministries:
          (json['ministries'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList(),
      uniqueOnly: json['unique_only'] as bool?,
      preferredLang: json['preferred_lang'] as String?,
      cursorScheduledDate: json['cursor_scheduled_date'] as String?,
      cursorId: json['cursor_id'] as String?,
      favoritesOnly: json['favorites_only'] as bool?,
      membersOnlyOnly: json['members_only_only'] as bool?,
      maxPrice: (json['max_price'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    final data = <String, dynamic>{'limit': limit};
    if (minAge != null) data['min_age'] = minAge;
    if (maxAge != null) data['max_age'] = maxAge;
    if (gender != null) data['gender'] = gender;
    if (ministries != null) data['ministries'] = ministries;
    if (uniqueOnly != null) data['unique_only'] = uniqueOnly;
    if (preferredLang != null) {
      data['preferred_lang'] = preferredLang;
    }
    if (cursorScheduledDate != null) {
      data['cursor_scheduled_date'] = cursorScheduledDate;
    }
    if (cursorId != null) data['cursor_id'] = cursorId;
    if (favoritesOnly != null) data['favorites_only'] = favoritesOnly;
    if (membersOnlyOnly != null) {
      data['members_only_only'] = membersOnlyOnly;
    }
    if (maxPrice != null) data['max_price'] = maxPrice;
    return data;
  }
}

/// A user-facing event instance with all fields the mobile client cares about.
class UserFacingEvent {
  final String id;
  final String eventId;
  final int seriesIndex;
  final String date;
  final String? endDate;
  final int seatsFilled;
  final Map<String, EventLocalization> localizations;
  final EventRecurrence recurring;
  final bool registrationAllowed;
  final bool hidden;
  final String? registrationOpens;
  final String? registrationDeadline;
  final String? automaticRefundDeadline;
  final List<String> ministries;
  final bool membersOnly;
  final bool rsvpRequired;
  final int? maxSpots;
  final double price;
  final double? memberPrice;
  final int? minAge;
  final int? maxAge;
  final EventGenderOption gender;
  final String? locationAddress;
  final String imageId;
  final List<EventPaymentOption> paymentOptions;
  final String updatedOn;
  final String overridesDateUpdatedOn;
  final String defaultTitle;
  final String defaultDescription;
  final String defaultLocationInfo;
  final String defaultLocalization;
  final String eventDate;
  final bool hasRegistrations;
  final RegistrationDetails? eventRegistrations;
  final bool isFavorited;

  UserFacingEvent({
    required this.id,
    required this.eventId,
    required this.seriesIndex,
    required this.date,
    required this.endDate,
    required this.seatsFilled,
    required this.localizations,
    required this.recurring,
    required this.registrationAllowed,
    required this.hidden,
    required this.registrationOpens,
    required this.registrationDeadline,
    required this.automaticRefundDeadline,
    required this.ministries,
    required this.membersOnly,
    required this.rsvpRequired,
    required this.maxSpots,
    required this.price,
    required this.memberPrice,
    required this.minAge,
    required this.maxAge,
    required this.gender,
    required this.locationAddress,
    required this.imageId,
    required this.paymentOptions,
    required this.updatedOn,
    required this.overridesDateUpdatedOn,
    required this.defaultTitle,
    required this.defaultDescription,
    required this.defaultLocationInfo,
    required this.defaultLocalization,
    required this.eventDate,
    required this.hasRegistrations,
    required this.eventRegistrations,
    required this.isFavorited,
  });

  factory UserFacingEvent.fromJson(Map<String, dynamic> json) {
    return UserFacingEvent(
      id: json['id'] as String? ?? '',
      eventId: json['event_id'] as String? ?? '',
      seriesIndex: (json['series_index'] as num?)?.toInt() ?? 0,
      date: json['date'] as String? ?? '',
      endDate: json['end_date'] as String?,
      seatsFilled: (json['seats_filled'] as num?)?.toInt() ?? 0,
      localizations: _localizationsFromJson(json['localizations']),
      recurring: eventRecurrenceFromJson(json['recurring'] as String?),
      registrationAllowed: json['registration_allowed'] as bool? ?? false,
      hidden: json['hidden'] as bool? ?? false,
      registrationOpens: json['registration_opens'] as String?,
      registrationDeadline: json['registration_deadline'] as String?,
      automaticRefundDeadline: json['automatic_refund_deadline'] as String?,
      ministries:
          (json['ministries'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList(),
      membersOnly: json['members_only'] as bool? ?? false,
      rsvpRequired: json['rsvp_required'] as bool? ?? false,
      maxSpots: (json['max_spots'] as num?)?.toInt(),
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      memberPrice: (json['member_price'] as num?)?.toDouble(),
      minAge: (json['min_age'] as num?)?.toInt(),
      maxAge: (json['max_age'] as num?)?.toInt(),
      gender: eventGenderOptionFromJson(json['gender'] as String?),
      locationAddress: json['location_address'] as String?,
      imageId: json['image_id'] as String? ?? '',
      paymentOptions: _paymentOptionsFromJson(json['payment_options']),
      updatedOn: json['updated_on'] as String? ?? '',
      overridesDateUpdatedOn:
          json['overrides_date_updated_on'] as String? ?? '',
      defaultTitle: json['default_title'] as String? ?? '',
      defaultDescription: json['default_description'] as String? ?? '',
      defaultLocationInfo: json['default_location_info'] as String? ?? '',
      defaultLocalization: json['default_localization'] as String? ?? '',
      eventDate: json['event_date'] as String? ?? '',
      hasRegistrations: json['has_registrations'] as bool? ?? false,
      eventRegistrations:
          json['event_registrations'] != null
              ? RegistrationDetails.fromJson(
                Map<String, dynamic>.from(json['event_registrations'] as Map),
              )
              : null,
      isFavorited: json['is_favorited'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'event_id': eventId,
      'series_index': seriesIndex,
      'date': date,
      'end_date': endDate,
      'seats_filled': seatsFilled,
      'localizations': localizations.map(
        (key, value) => MapEntry(key, value.toJson()),
      ),
      'recurring': eventRecurrenceToJson(recurring),
      'registration_allowed': registrationAllowed,
      'hidden': hidden,
      'registration_opens': registrationOpens,
      'registration_deadline': registrationDeadline,
      'automatic_refund_deadline': automaticRefundDeadline,
      'ministries': ministries,
      'members_only': membersOnly,
      'rsvp_required': rsvpRequired,
      'max_spots': maxSpots,
      'price': price,
      'member_price': memberPrice,
      'min_age': minAge,
      'max_age': maxAge,
      'gender': eventGenderOptionToJson(gender),
      'location_address': locationAddress,
      'image_id': imageId,
      'payment_options': paymentOptions.map(eventPaymentOptionToJson).toList(),
      'updated_on': updatedOn,
      'overrides_date_updated_on': overridesDateUpdatedOn,
      'default_title': defaultTitle,
      'default_description': defaultDescription,
      'default_location_info': defaultLocationInfo,
      'default_localization': defaultLocalization,
      'event_date': eventDate,
      'has_registrations': hasRegistrations,
      'event_registrations': eventRegistrations?.toJson(),
      'is_favorited': isFavorited,
    };
  }

  static Map<String, EventLocalization> _localizationsFromJson(dynamic value) {
    if (value == null) return <String, EventLocalization>{};
    final map = Map<String, dynamic>.from(value as Map);
    return map.map(
      (key, v) => MapEntry(
        key,
        EventLocalization.fromJson(Map<String, dynamic>.from(v as Map)),
      ),
    );
  }

  static List<EventPaymentOption> _paymentOptionsFromJson(dynamic value) {
    if (value == null) return <EventPaymentOption>[];
    final list = value as List<dynamic>;
    return list.map((e) => eventPaymentOptionFromJson(e as String?)).toList();
  }

  UserFacingEvent copyWith({
    String? id,
    String? eventId,
    int? seriesIndex,
    String? date,
    String? endDate,
    int? seatsFilled,
    Map<String, EventLocalization>? localizations,
    EventRecurrence? recurring,
    bool? registrationAllowed,
    bool? hidden,
    String? registrationOpens,
    String? registrationDeadline,
    String? automaticRefundDeadline,
    List<String>? ministries,
    bool? membersOnly,
    bool? rsvpRequired,
    int? maxSpots,
    double? price,
    double? memberPrice,
    int? minAge,
    int? maxAge,
    EventGenderOption? gender,
    String? locationAddress,
    String? imageId,
    List<EventPaymentOption>? paymentOptions,
    String? updatedOn,
    String? overridesDateUpdatedOn,
    String? defaultTitle,
    String? defaultDescription,
    String? defaultLocationInfo,
    String? defaultLocalization,
    String? eventDate,
    bool? hasRegistrations,
    RegistrationDetails? eventRegistrations,
    bool? isFavorited,
  }) {
    return UserFacingEvent(
      id: id ?? this.id,
      eventId: eventId ?? this.eventId,
      seriesIndex: seriesIndex ?? this.seriesIndex,
      date: date ?? this.date,
      endDate: endDate ?? this.endDate,
      seatsFilled: seatsFilled ?? this.seatsFilled,
      localizations: localizations ?? this.localizations,
      recurring: recurring ?? this.recurring,
      registrationAllowed: registrationAllowed ?? this.registrationAllowed,
      hidden: hidden ?? this.hidden,
      registrationOpens: registrationOpens ?? this.registrationOpens,
      registrationDeadline: registrationDeadline ?? this.registrationDeadline,
      automaticRefundDeadline:
          automaticRefundDeadline ?? this.automaticRefundDeadline,
      ministries: ministries ?? this.ministries,
      membersOnly: membersOnly ?? this.membersOnly,
      rsvpRequired: rsvpRequired ?? this.rsvpRequired,
      maxSpots: maxSpots ?? this.maxSpots,
      price: price ?? this.price,
      memberPrice: memberPrice ?? this.memberPrice,
      minAge: minAge ?? this.minAge,
      maxAge: maxAge ?? this.maxAge,
      gender: gender ?? this.gender,
      locationAddress: locationAddress ?? this.locationAddress,
      imageId: imageId ?? this.imageId,
      paymentOptions: paymentOptions ?? this.paymentOptions,
      updatedOn: updatedOn ?? this.updatedOn,
      overridesDateUpdatedOn:
          overridesDateUpdatedOn ?? this.overridesDateUpdatedOn,
      defaultTitle: defaultTitle ?? this.defaultTitle,
      defaultDescription: defaultDescription ?? this.defaultDescription,
      defaultLocationInfo: defaultLocationInfo ?? this.defaultLocationInfo,
      defaultLocalization: defaultLocalization ?? this.defaultLocalization,
      eventDate: eventDate ?? this.eventDate,
      hasRegistrations: hasRegistrations ?? this.hasRegistrations,
      eventRegistrations: eventRegistrations ?? this.eventRegistrations,
      isFavorited: isFavorited ?? this.isFavorited,
    );
  }
}

/// Paged results for user-facing events.
class UserEventResults {
  final List<UserFacingEvent> items;
  final EventsCursor? nextCursor;

  UserEventResults({required this.items, required this.nextCursor});

  factory UserEventResults.fromJson(Map<String, dynamic> json) {
    return UserEventResults(
      items:
          (json['items'] as List<dynamic>? ?? [])
              .map(
                (e) => UserFacingEvent.fromJson(
                  Map<String, dynamic>.from(e as Map),
                ),
              )
              .toList(),
      nextCursor:
          json['next_cursor'] != null
              ? EventsCursor.fromJson(
                Map<String, dynamic>.from(json['next_cursor'] as Map),
              )
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'items': items.map((e) => e.toJson()).toList(),
      'next_cursor': nextCursor?.toJson(),
    };
  }
}

/// Short representation of a "sister" event instance in the same series.
class SisterInstanceIdentifier {
  final String id;
  final String date;
  final String updatedOn;
  final String eventDate;

  SisterInstanceIdentifier({
    required this.id,
    required this.date,
    required this.updatedOn,
    required this.eventDate,
  });

  factory SisterInstanceIdentifier.fromJson(Map<String, dynamic> json) {
    return SisterInstanceIdentifier(
      id: json['id'] as String? ?? '',
      date: json['date'] as String? ?? '',
      updatedOn: json['updated_on'] as String? ?? '',
      eventDate: json['event_date'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'date': date,
      'updated_on': updatedOn,
      'event_date': eventDate,
    };
  }
}

/// Full event details response used on event detail screens.
class EventDetailsResponse {
  final bool success;
  final String msg;
  final UserFacingEvent? eventDetails;
  final List<SisterInstanceIdentifier> sisterDetails;
  final List<Ministry> ministries;

  EventDetailsResponse({
    required this.success,
    required this.msg,
    required this.eventDetails,
    required this.sisterDetails,
    required this.ministries,
  });

  factory EventDetailsResponse.fromJson(Map<String, dynamic> json) {
    return EventDetailsResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String? ?? '',
      eventDetails:
          json['event_details'] != null
              ? UserFacingEvent.fromJson(
                Map<String, dynamic>.from(json['event_details'] as Map),
              )
              : null,
      sisterDetails:
          (json['sister_details'] as List<dynamic>? ?? [])
              .map(
                (e) => SisterInstanceIdentifier.fromJson(
                  Map<String, dynamic>.from(e as Map),
                ),
              )
              .toList(),
      ministries:
          (json['ministries'] as List<dynamic>? ?? [])
              .map(
                (e) => Ministry.fromJson(Map<String, dynamic>.from(e as Map)),
              )
              .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'event_details': eventDetails?.toJson(),
      'sister_details': sisterDetails.map((e) => e.toJson()).toList(),
      'ministries': ministries.map((e) => e.toJson()).toList(),
    };
  }
}

/// Request payload describing a registration change.
class ChangeEventRegistration {
  final String eventInstanceId;
  final bool? selfRegistered;
  final List<String> familyMembersRegistering;
  final List<String> familyMembersUnregistering;
  final EventPaymentType paymentType;
  final String? discountCodeId;

  ChangeEventRegistration({
    required this.eventInstanceId,
    required this.selfRegistered,
    required this.familyMembersRegistering,
    required this.familyMembersUnregistering,
    required this.paymentType,
    required this.discountCodeId,
  });

  factory ChangeEventRegistration.fromJson(Map<String, dynamic> json) {
    return ChangeEventRegistration(
      eventInstanceId: json['event_instance_id'] as String? ?? '',
      selfRegistered: json['self_registered'] as bool?,
      familyMembersRegistering:
          (json['family_members_registering'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList(),
      familyMembersUnregistering:
          (json['family_members_unregistering'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList(),
      paymentType: eventPaymentTypeFromJson(json['payment_type'] as String?),
      discountCodeId: json['discount_code_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'event_instance_id': eventInstanceId,
      'self_registered': selfRegistered,
      'family_members_registering': familyMembersRegistering,
      'family_members_unregistering': familyMembersUnregistering,
      'payment_type': eventPaymentTypeToJson(paymentType),
      'discount_code_id': discountCodeId,
    };
  }
}

/// Response payload after attempting a registration change.
class RegistrationChangeResponse {
  final bool success;
  final String? msg;
  final int? seatsFilled;
  final RegistrationDetails? registrationDetails;
  final ChangeEventRegistration? changeRequest;
  final Map<String, dynamic>? detailsMap;

  RegistrationChangeResponse({
    required this.success,
    required this.msg,
    required this.seatsFilled,
    required this.registrationDetails,
    required this.changeRequest,
    required this.detailsMap,
  });

  factory RegistrationChangeResponse.fromJson(Map<String, dynamic> json) {
    return RegistrationChangeResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
      seatsFilled: (json['seats_filled'] as num?)?.toInt(),
      registrationDetails:
          json['registration_details'] != null
              ? RegistrationDetails.fromJson(
                Map<String, dynamic>.from(json['registration_details'] as Map),
              )
              : null,
      changeRequest:
          json['change_request'] != null
              ? ChangeEventRegistration.fromJson(
                Map<String, dynamic>.from(json['change_request'] as Map),
              )
              : null,
      detailsMap: _detailsMapFromJson(json['details_map']),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'seats_filled': seatsFilled,
      'registration_details': registrationDetails?.toJson(),
      'change_request': changeRequest?.toJson(),
      'details_map': detailsMap,
    };
  }

  static Map<String, dynamic>? _detailsMapFromJson(dynamic value) {
    if (value == null) return null;
    return Map<String, dynamic>.from(value as Map);
  }
}

/// Response for creating a paid registration (e.g. PayPal).
class CreatePaidRegistrationResponse {
  final bool success;
  final String? msg;
  final String? orderId;
  final String? approveUrl;

  CreatePaidRegistrationResponse({
    required this.success,
    required this.msg,
    required this.orderId,
    required this.approveUrl,
  });

  factory CreatePaidRegistrationResponse.fromJson(Map<String, dynamic> json) {
    return CreatePaidRegistrationResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
      orderId: json['order_id'] as String?,
      approveUrl: json['approve_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'order_id': orderId,
      'approve_url': approveUrl,
    };
  }
}

/// Parameters for fetching "my events".
class MyEventsSearchParams {
  final MyEventsTypeFilter? type;
  final MyEventsDateFilter? date;
  final int? limit;
  final String? preferredLang;
  final String? cursorScheduledDate;
  final String? cursorId;

  MyEventsSearchParams({
    this.type,
    this.date,
    this.limit,
    this.preferredLang,
    this.cursorScheduledDate,
    this.cursorId,
  });

  factory MyEventsSearchParams.fromJson(Map<String, dynamic> json) {
    return MyEventsSearchParams(
      type: myEventsTypeFilterFromJson(json['type'] as String?),
      date: myEventsDateFilterFromJson(json['date'] as String?),
      limit: (json['limit'] as num?)?.toInt(),
      preferredLang: json['preferred_lang'] as String?,
      cursorScheduledDate: json['cursor_scheduled_date'] as String?,
      cursorId: json['cursor_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    final data = <String, dynamic>{};
    final typeStr = myEventsTypeFilterToJson(type);
    if (typeStr != null) data['type'] = typeStr;
    final dateStr = myEventsDateFilterToJson(date);
    if (dateStr != null) data['date'] = dateStr;
    if (limit != null) data['limit'] = limit;
    if (preferredLang != null) {
      data['preferred_lang'] = preferredLang;
    }
    if (cursorScheduledDate != null) {
      data['cursor_scheduled_date'] = cursorScheduledDate;
    }
    if (cursorId != null) data['cursor_id'] = cursorId;
    return data;
  }
}

/// MyEventsResults is just the same structure as UserEventResults.
typedef MyEventsResults = UserEventResults;

/// Request payload for checking a discount code against an event.
class DiscountCodeCheckRequest {
  final String eventId;
  final String discountCode;

  DiscountCodeCheckRequest({required this.eventId, required this.discountCode});

  factory DiscountCodeCheckRequest.fromJson(Map<String, dynamic> json) {
    return DiscountCodeCheckRequest(
      eventId: json['event_id'] as String? ?? '',
      discountCode: json['discount_code'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'event_id': eventId,
      'discount_code': discountCode,
    };
  }
}

/// Response payload returned by the discount-code check endpoint.
class DiscountCodeCheckResponse {
  final bool success;
  final String? msg;
  final String? id;
  final bool? isPercent;
  final double? discount;
  final int? usesLeft;

  DiscountCodeCheckResponse({
    required this.success,
    required this.msg,
    required this.id,
    required this.isPercent,
    required this.discount,
    required this.usesLeft,
  });

  factory DiscountCodeCheckResponse.fromJson(Map<String, dynamic> json) {
    return DiscountCodeCheckResponse(
      success: json['success'] as bool? ?? false,
      msg: json['msg'] as String?,
      id: json['id'] as String?,
      isPercent: json['is_percent'] as bool?,
      discount: (json['discount'] as num?)?.toDouble(),
      usesLeft: (json['uses_left'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'success': success,
      'msg': msg,
      'id': id,
      'is_percent': isPercent,
      'discount': discount,
      'uses_left': usesLeft,
    };
  }
}
