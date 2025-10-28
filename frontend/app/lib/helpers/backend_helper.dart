import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'dart:convert';
import 'dart:io' show Platform;

class BackendHelper {
  static String get apiBase {
    final envUrl = dotenv.env['BACKEND_URL'];
    if (envUrl != null && envUrl.isNotEmpty) return envUrl;
    
    // Fall back to compile-time environment variable
    const fromDefine = String.fromEnvironment('API_BASE_URL');
    if (fromDefine.isNotEmpty) return fromDefine;
    
    // Fall back to platform-specific defaults
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:8000';
      return 'http://127.0.0.1:8000';
    } catch (_) {
      return 'http://127.0.0.1:8000';
    }
  }

  static const String syncEndpoint = "/api/v1/users/sync-user";

  static Future<bool> syncFirebaseUserWithBackend() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception("User not authenticated");
      final String? idToken = await user.getIdToken(true);
      if (idToken == null) {
        throw Exception("Failed to retrieve Firebase ID token.");
      }

      final response = await http.post(
        Uri.parse("$apiBase$syncEndpoint"),
        headers: {
          "Authorization": "Bearer $idToken",
          "Content-Type": "application/json",
        },
      );

      if (response.statusCode != 200) {
        debugPrint("❌ Backend response: ${response.body}");
        return false;
      }

      final responseData = jsonDecode(response.body);
      debugPrint("✅ Backend verification response: $responseData");

      return responseData["verified"] == true;
    } catch (e) {
      debugPrint("❌ Error syncing user with backend: $e");
      return false;
    }
  }

  Future<bool> verifyAndSyncUser(Function(String) onError) async {
    final bool verified = await BackendHelper.syncFirebaseUserWithBackend();

    if (!verified) {
      await FirebaseAuth.instance.signOut();
      onError("Account verification failed. Please contact support.");
      return false;
    }

    return true;
  }
}
