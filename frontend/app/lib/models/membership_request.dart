class ReadMembershipRequest {
  final String? message;
  final bool resolved;
  final bool? approved;
  final String? reason;
  final bool muted;

  const ReadMembershipRequest({
    required this.message,
    required this.resolved,
    required this.approved,
    required this.reason,
    required this.muted,
  });

  factory ReadMembershipRequest.fromJson(Map<String, dynamic> j) {
    return ReadMembershipRequest(
      message: (j['message']),
      resolved: (j['resolved'] ?? false),
      approved: (j['approved']),
      reason: (j['reason']),
      muted: (j['muted'] ?? false),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'resolved': resolved,
      'approved': approved,
      'reason': reason,
      'muted': muted,
    };
  }
}

class MembershipDetails {
  final bool membership;
  final ReadMembershipRequest? pendingRequest;

  const MembershipDetails({
    required this.membership,
    required this.pendingRequest,
  });

  factory MembershipDetails.fromJson(Map<String, dynamic> j) {
    final pending = j['pending_request'] as Map<String, dynamic>?;

    return MembershipDetails(
      membership: (j['membership'] as bool?) ?? false,
      pendingRequest:
          pending == null ? null : ReadMembershipRequest.fromJson(pending),
    );
  }

  Map<String, dynamic> toJson() => {
    'membership': membership,
    'pending_request': pendingRequest?.toJson(),
  };
}
