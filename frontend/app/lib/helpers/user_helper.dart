import 'package:app/models/contact_info.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/models/family_member.dart';
import 'package:app/caches/user_status_cache.dart';
import 'package:app/caches/user_profile_cache.dart';
import 'package:app/caches/user_contact_info_cache.dart';

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

class UpdateContactResult {
  final bool success;
  final String msg;
  final ContactInfo? contact;
  const UpdateContactResult({
    required this.success,
    required this.msg,
    required this.contact,
  });
}

class FetchProfileReturn {
  final ProfileInfo? profile;
  final ContactInfo? contact;

  const FetchProfileReturn({required this.profile, required this.contact});
}

class UpdateLanguageResult {
  final bool success;
  final String msg;
  final String language;

  const UpdateLanguageResult({
    required this.success,
    required this.msg,
    required this.language,
  });
}

class AllPeopleResult {
  final bool success;
  final String msg;
  final ProfileInfo? profile;
  final List<FamilyMember> familyMembers;

  const AllPeopleResult({
    required this.success,
    required this.msg,
    required this.profile,
    required this.familyMembers,
  });
}

class DeleteAccountResult {
  final bool success;
  final String msg;

  const DeleteAccountResult({
    required this.success,
    required this.msg,
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

  static Future<FetchProfileReturn?> getMyProfile() async {
    try {
      final res = await api.get('/v1/users/get-profile');
      final data = res.data;
      if (data is! Map) return null;

      final piRaw = data['profile_info'];
      if (piRaw is! Map) return null;

      final ciRaw = data['contact_info'];
      if (ciRaw is! Map) return null;

      final profile = ProfileInfo.fromJson(Map<String, dynamic>.from(piRaw));
      final contact = ContactInfo.fromJson(Map<String, dynamic>.from(ciRaw));

      final uid = FirebaseAuth.instance.currentUser?.uid;
      if (uid != null) {
        await UserProfileCache.write(uid, profile);
        await ContactInfoCache.write(uid, contact);
      }

      return FetchProfileReturn(profile: profile, contact: contact);
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

  static Future<ContactInfo?> readCachedContact() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;
    return ContactInfoCache.read(uid);
  }

  static Future<void> clearCachedProfile() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    await UserProfileCache.clear(uid);
    await ContactInfoCache.clear(uid);
  }

  static Future<UpdateContactResult> updateContactInfo(
    ContactInfo contact,
  ) async {
    try {
      final subPayload = <String, dynamic>{
        'address': contact.address.address,
        'suite': contact.address.suite,
        'city': contact.address.city,
        'state': contact.address.state,
        'country': contact.address.country,
        'postal_code': contact.address.postalCode,
      };

      final payload = <String, dynamic>{
        'phone': contact.phone,
        'address': subPayload,
      };

      final res = await api.patch("/v1/users/update-contact", data: payload);

      final data =
          (res.data is Map)
              ? Map<String, dynamic>.from(res.data)
              : const <String, dynamic>{};

      final success = data['success'] == true;
      final msg = (data['msg'] is String) ? data['msg'] as String : '';

      ContactInfo? updated;
      final ciRaw = data['contact_info'];
      if (ciRaw is Map) {
        updated = ContactInfo.fromJson(Map<String, dynamic>.from(ciRaw));
      }

      final uid = FirebaseAuth.instance.currentUser?.uid;

      if (uid != null && updated != null) {
        await ContactInfoCache.write(uid, updated);
      }

      return UpdateContactResult(success: success, msg: msg, contact: updated);
    } catch (e, st) {
      logger.e("updateContactInfo failed", error: e, stackTrace: st);
      return const UpdateContactResult(
        success: false,
        msg: "Failed to update contact info",
        contact: null,
      );
    }
  }

  static Future<UpdateProfileResult> updateProfileInfo(
    ProfileInfo profile,
  ) async {
    try {
      final payload = <String, dynamic>{
        'first_name': profile.firstName,
        'last_name': profile.lastName,
        'email': profile.email,
        'membership': profile.membership,
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

  /// Fetch user language directly from backend.
  static Future<String> fetchUserLanguage() async {
    try {
      final res = await api.get('/v1/users/language');
      final raw = res.data;
      if (raw is Map) {
        final data = Map<String, dynamic>.from(raw);
        final lang = data['language'];
        if (lang is String) {
          final code = lang.trim();
          if (code.isNotEmpty) return code;
        }
      }
    } catch (e) {
      //fall
    }
    return 'en';
  }

  /// Update user's preferred language in MongoDB.
  static Future<UpdateLanguageResult> updateLanguage(
    String languageCode,
  ) async {
    try {
      final payload = <String, dynamic>{'language': languageCode.trim()};

      final res = await api.patch('/v1/users/update-language', data: payload);

      final data =
          (res.data is Map)
              ? Map<String, dynamic>.from(res.data)
              : const <String, dynamic>{};

      final success = data['success'] == true;
      final msg = (data['msg'] is String) ? data['msg'] as String : '';

      return UpdateLanguageResult(
        success: success,
        msg: msg,
        language: languageCode.trim(),
      );
    } catch (e) {
      return const UpdateLanguageResult(
        success: false,
        msg: 'Failed to update language.',
        language: 'en',
      );
    }
  }

  static Future<AllPeopleResult> getAllPeople() async {
    try {
      final res = await api.get('/v1/users/all-people');
      final raw = res.data;

      if (raw is! Map) {
        return const AllPeopleResult(
          success: false,
          msg: 'Unexpected response from server.',
          profile: null,
          familyMembers: <FamilyMember>[],
        );
      }

      final data = Map<String, dynamic>.from(raw);

      final success = data['success'] == true;
      final msg = (data['msg'] is String) ? data['msg'] as String : '';

      if (!success) {
        return AllPeopleResult(
          success: false,
          msg: msg.isNotEmpty ? msg : 'Failed to load people.',
          profile: null,
          familyMembers: const <FamilyMember>[],
        );
      }

      // profile_info
      ProfileInfo? profile;
      final piRaw = data['profile_info'];
      if (piRaw is Map) {
        profile = ProfileInfo.fromJson(Map<String, dynamic>.from(piRaw));
      }

      // family_members
      final famRaw = data['family_members'];
      final familyMembers = <FamilyMember>[];

      if (famRaw is List) {
        for (final item in famRaw) {
          if (item is Map) {
            try {
              familyMembers.add(
                FamilyMember.fromJson(Map<String, dynamic>.from(item)),
              );
            } catch (e, st) {
              logger.e(
                'getAllPeople: failed to parse family member',
                error: e,
                stackTrace: st,
              );
            }
          }
        }
      }

      return AllPeopleResult(
        success: true,
        msg: msg,
        profile: profile,
        familyMembers: familyMembers,
      );
    } catch (e, st) {
      logger.e('Failed to get all people', error: e, stackTrace: st);
      return AllPeopleResult(
        success: false,
        msg: 'Unexpected error in fetching people: $e',
        profile: null,
        familyMembers: const <FamilyMember>[],
      );
    }
  }

  static Future<DeleteAccountResult> deleteAccount() async {
    try {
      final res = await api.delete('/v1/users/delete-account');
      
      final data = (res.data is Map)
          ? Map<String, dynamic>.from(res.data)
          : const <String, dynamic>{};

      final success = data['success'] == true;
      final msg = (data['message'] is String) ? data['message'] as String : '';

      // If successful, clear all cached data
      if (success) {
        final uid = FirebaseAuth.instance.currentUser?.uid;
        if (uid != null) {
          await UserStatusCache.clear(uid);
          await UserProfileCache.clear(uid);
          await ContactInfoCache.clear(uid);
        }
        
        // Sign out from Firebase
        await FirebaseAuth.instance.signOut();
      }

      return DeleteAccountResult(success: success, msg: msg);
    } catch (e, st) {
      logger.e('deleteAccount failed', error: e, stackTrace: st);
      return const DeleteAccountResult(
        success: false,
        msg: 'Failed to delete account. Please try again.',
      );
    }
  }
}
