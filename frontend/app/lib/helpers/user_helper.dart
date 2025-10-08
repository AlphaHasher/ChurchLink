import 'package:firebase_auth/firebase_auth.dart';
import 'api_client.dart';
import 'logger.dart';

import 'package:app/models/profile_info.dart';
import 'package:app/caches/user_status_cache.dart';
import 'package:app/caches/user_profile_cache.dart';

class UpdateProfileResult {
  final bool success;
  final String msg;
  final ProfileInfo? profile;
  const UpdateProfileResult({
    required this.success,
    required this.msg,
    required this.profile,
  });
}

class UserHelper {
  static Future<Map<String, dynamic>?> getIsInit() async {
    try {
      final res = await api.get('/v1/users/is-init');
      final raw = res.data;
      final data = (raw is Map) ? Map<String, dynamic>.from(raw) : null;
      if (data == null) return null;

      final verified = data['verified'] == true;
      final init = data['init'] == true;

      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid != null) {
        await UserStatusCache.write(
          uid,
          UserStatus(verified: verified, init: init, updatedAt: DateTime.now()),
        );
      }

      return {
        'verified': verified,
        'init': init,
        'msg': (data['msg'] is String) ? data['msg'] as String : '',
      };
    } catch (e, st) {
      logger.e('Failed to get init stats!', error: e, stackTrace: st);
      return null;
    }
  }

  static Future<UserStatus?> readCachedStatus() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;
    return UserStatusCache.read(uid);
  }

  static Future<void> clearCachedStatus() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    await UserStatusCache.clear(uid);
  }

  static Future<ProfileInfo?> getMyProfile() async {
    try {
      final res = await api.get('/v1/users/get-profile');
      final data = res.data;
      if (data is! Map) return null;

      final piRaw = data['profile_info'];
      if (piRaw is! Map) return null;

      final profile = ProfileInfo.fromJson(Map<String, dynamic>.from(piRaw));

      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid != null) {
        await UserProfileCache.write(uid, profile);
      }

      return profile;
    } catch (e, st) {
      logger.e('getMyProfile failed', error: e, stackTrace: st);
      return null;
    }
  }

  static Future<ProfileInfo?> readCachedProfile() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;
    return UserProfileCache.read(uid);
  }

  static Future<void> clearCachedProfile() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    await UserProfileCache.clear(uid);
  }

  static Future<UpdateProfileResult> updateProfileInfo(
    ProfileInfo profile,
  ) async {
    try {
      final payload = <String, dynamic>{
        'first_name': profile.firstName,
        'last_name': profile.lastName,
        'email': profile.email,
        'birthday': profile.birthday?.toIso8601String(),
        'gender': profile.gender,
      };

      final res = await api.patch('/v1/users/update-profile', data: payload);
      final data =
          (res.data is Map)
              ? Map<String, dynamic>.from(res.data)
              : const <String, dynamic>{};

      final success = data['success'] == true;
      final msg = (data['msg'] is String) ? data['msg'] as String : '';

      ProfileInfo? updated;
      final piRaw = data['profile_info'];
      if (piRaw is Map) {
        updated = ProfileInfo.fromJson(Map<String, dynamic>.from(piRaw));
      }

      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid != null && updated != null) {
        await UserProfileCache.write(uid, updated);
      }

      return UpdateProfileResult(success: success, msg: msg, profile: updated);
    } catch (e, st) {
      logger.e('updateProfileInfo failed', error: e, stackTrace: st);
      return const UpdateProfileResult(
        success: false,
        msg: 'Failed to update profile info.',
        profile: null,
      );
    }
  }
}
