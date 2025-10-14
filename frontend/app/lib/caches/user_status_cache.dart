import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class UserStatus {
  final bool verified;
  final bool init;
  final DateTime updatedAt;

  const UserStatus({
    required this.verified,
    required this.init,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() => {
    'verified': verified,
    'init': init,
    'updatedAt': updatedAt.toIso8601String(),
  };

  static UserStatus? fromJson(Map<String, dynamic>? j) {
    if (j == null) return null;
    return UserStatus(
      verified: j['verified'] == true,
      init: j['init'] == true,
      updatedAt:
          DateTime.tryParse(j['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class UserStatusCache {
  static String _key(String uid) => 'user_status:$uid';

  static Future<void> write(String uid, UserStatus status) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(uid), jsonEncode(status.toJson()));
  }

  static Future<UserStatus?> read(String uid) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(uid));
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return UserStatus.fromJson(j);
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear(String uid) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(uid));
  }
}
