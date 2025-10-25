import 'package:app/models/membership_request.dart';
import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';

class CreateMembershipRequestResult {
  final bool success;
  final String msg;
  const CreateMembershipRequestResult({
    required this.success,
    required this.msg,
  });
}

class MembershipHelper {
  static Future<MembershipDetails?> readMembershipDetails() async {
    try {
      final res = await api.get("/v1/membership/membership-details");
      final data = res.data;

      if (data is! Map) return null;

      if (data['details'] is! Map) return null;

      final details = MembershipDetails.fromJson(data['details']);

      return details;
    } catch (e, st) {
      logger.e('readMembershipDetails failed', error: e, stackTrace: st);
      return null;
    }
  }

  static Future<CreateMembershipRequestResult> createMembershipRequest(
    String? message,
  ) async {
    try {
      final payload = {'message': message};

      final res = await api.post(
        "/v1/membership/create-request",
        data: payload,
      );

      final data =
          (res.data is Map)
              ? Map<String, dynamic>.from(res.data)
              : const <String, dynamic>{};

      final success = data['success'] == true;
      final msg = (data['msg'] is String) ? data['msg'] as String : '';

      return CreateMembershipRequestResult(success: success, msg: msg);
    } catch (e, st) {
      logger.e("createMembershipRequest failed", error: e, stackTrace: st);
      return const CreateMembershipRequestResult(
        success: false,
        msg: "Failed to create membership request!",
      );
    }
  }
}
