import "backend_helper.dart";
import "../firebase/firebase_auth_service.dart";
import "../services/fcm_token_service.dart";
import "package:firebase_auth/firebase_auth.dart";

class AuthController {
  final FirebaseAuthService authService = FirebaseAuthService();
  final BackendHelper backendHelper = BackendHelper();

  Future<bool> loginWithEmailAndSync(
    String email,
    String password,
    Function(String) onError,
  ) async {
    final token = await authService.signInWithEmail(email, password);
    if (token == null) return false;

    final verified = await backendHelper.verifyAndSyncUser(onError);
    if (verified) {
      // Update FCM token from anonymous to logged-in user
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        FCMTokenService.reset(); // Reset flag to allow sending new token
        await FCMTokenService.sendFcmTokenToBackend(user.uid);
      }
    }
    return verified;
  }

  Future<bool> loginWithGoogleAndSync(Function(String) onError) async {
    final token = await authService.signInWithGoogle();
    if (token == null) return false;

    final verified = await backendHelper.verifyAndSyncUser(onError);
    if (verified) {
      // Update FCM token from anonymous to logged-in user
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        FCMTokenService.reset(); // Reset flag to allow sending new token
        await FCMTokenService.sendFcmTokenToBackend(user.uid);
      }
    }
    return verified;
  }
}
