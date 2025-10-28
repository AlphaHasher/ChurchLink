class ContactInfo {
  final String? phone;
  final AddressSchema address;

  const ContactInfo({required this.phone, required this.address});

  factory ContactInfo.fromJson(Map<String, dynamic> j) {
    return ContactInfo(
      phone: (j['phone'] ?? '').toString(),
      address: AddressSchema.fromJson(j['address']),
    );
  }

  Map<String, dynamic> toJson() {
    return {'phone': phone, 'address': address.toJson()};
  }
}

class AddressSchema {
  final String? address;
  final String? suite;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;

  const AddressSchema({
    required this.address,
    required this.suite,
    required this.city,
    required this.state,
    required this.country,
    required this.postalCode,
  });

  factory AddressSchema.fromJson(Map<String, dynamic> j) {
    return AddressSchema(
      address: (j['address'] ?? '').toString(),
      suite: (j['suite'] ?? '').toString(),
      city: (j['city'] ?? '').toString(),
      state: (j['state'] ?? '').toString(),
      country: (j['country'] ?? '').toString(),
      postalCode: (j['postal_code'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'address': address,
      'suite': suite,
      'city': city,
      'state': state,
      'country': country,
      'postal_code': postalCode,
    };
  }
}
