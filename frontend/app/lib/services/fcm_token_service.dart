
import 'package:firebase_messaging/firebase_messaging.dart';
// import 'package:http/http.dart' as http;
import 'package:app/helpers/api_client.dart';
import 'dart:convert';
import 'dart:developer';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'dart:io';


class FCMTokenService {
  static bool _tokenSent = false;

  /// Send FCM token to backend with device info and consent
  static Future<void> registerDeviceToken({required Map<String, bool> consent, String? userId}) async {
    if (_tokenSent) {
      log('FCM token already sent in this session, skipping...');
      return;
    }

    final token = await FirebaseMessaging.instance.getToken();
    final info = await PackageInfo.fromPlatform();
    final platform = Platform.isIOS ? 'ios' : Platform.isAndroid ? 'android' : 'web';
    final appVersion = info.version;

    log('=== FCM TOKEN SERVICE DEBUG ===');
    log('registerDeviceToken called for token: $token');
    log('Platform: $platform, AppVersion: $appVersion, Consent: $consent, UserId: $userId');

    if (token != null) {
      final backendUrl = dotenv.env['BACKEND_URL']?.replaceAll(RegExp(r'/+$'), '') ?? '';
      final fullUrl = '$backendUrl/api/v1/notification/registerToken';
      log('Backend URL: $backendUrl');
      log('Full API URL: $fullUrl');

      try {
        final requestBody = json.encode({
          'token': token,
          'platform': platform,
          'appVersion': appVersion,
          'consent': consent,
          if (userId != null) 'userId': userId,
        });
        log('Request body: $requestBody');

        final response = await api.post(
          '/v1/notification/registerToken',
          data: {
            'token': token,
            'platform': platform,
            'appVersion': appVersion,
            'consent': consent,
            if (userId != null) 'userId': userId,
          },
        );

        log('FCM token registration response status: \\${response.statusCode}');
        log('FCM token registration response body: \\${response.data}');

        if (response.statusCode == 200) {
          log('✅ FCM token registered successfully!');
          _tokenSent = true;
        } else {
          log('❌ FCM token registration failed with status: \\${response.statusCode}');
        }
      } catch (e) {
        log('❌ Error registering FCM token to backend: $e');
        log('Stack trace: ${StackTrace.current}');
      }
    } else {
      log('❌ FCM token is null, not registering to backend');
    }
    log('=== END FCM TOKEN SERVICE DEBUG ===');
  }

  /// Initialize FCM token management for device
  static Future<void> initializeFCMToken({required Map<String, bool> consent, String? userId}) async {
    await registerDeviceToken(consent: consent, userId: userId);

    // Listen for token refresh
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      log('FCM token refreshed: $newToken');
      _tokenSent = false;
      await registerDeviceToken(consent: consent, userId: userId);
    });
  }

  /// Reset the token sent flag (call when user logs out)
  static void reset() {
    _tokenSent = false;
  }
}

