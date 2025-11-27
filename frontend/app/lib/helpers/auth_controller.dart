import 'package:app/helpers/backend_helper.dart';
import 'package:app/firebase/firebase_auth_service.dart';

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
    return verified;
  }

  Future<bool> loginWithGoogleAndSync(Function(String) onError) async {
    final token = await authService.signInWithGoogle();
    if (token == null) return false;

    final verified = await backendHelper.verifyAndSyncUser(onError);
    return verified;
  }

  Future<bool> loginWithAppleAndSync(Function(String) onError) async {
    final token = await authService.signInWithApple();
    if (token == null) {
      onError("Apple Sign-In failed. Please try again.");
      return false;
    }

    final verified = await backendHelper.verifyAndSyncUser(onError);
    return verified;
  }
}
