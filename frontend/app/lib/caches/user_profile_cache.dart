import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:app/models/profile_info.dart';

class UserProfileCache {
  static String _key(String uid) => 'user_profile:$uid';

  static Future<void> write(String uid, ProfileInfo profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(uid), jsonEncode(profile.toJson()));
  }

  static Future<ProfileInfo?> read(String uid) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(uid));
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return ProfileInfo.fromJson(j);
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear(String uid) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(uid));
  }
}
