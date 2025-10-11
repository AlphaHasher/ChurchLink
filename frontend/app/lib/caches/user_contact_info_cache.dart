import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:app/models/contact_info.dart';

class ContactInfoCache {
  static String _key(String uid) => 'contact_info:$uid';

  static Future<void> write(String uid, ContactInfo contact) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(uid), jsonEncode(contact.toJson()));
  }

  static Future<ContactInfo?> read(String uid) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(uid));
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return ContactInfo.fromJson(j);
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear(String uid) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(uid));
  }
}
