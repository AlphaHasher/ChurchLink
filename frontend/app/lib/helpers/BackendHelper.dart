import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:convert';

class BackendHelper {
  static const String apiBase =
      "http://10.0.2.2:8000"; // Emulator-safe localhost
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
        print("❌ Backend response: ${response.body}");
        return false;
      }

      final responseData = jsonDecode(response.body);
      print("✅ Backend verification response: $responseData");

      return responseData["verified"] == true;
    } catch (e) {
      print("❌ Error syncing user with backend: $e");
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
