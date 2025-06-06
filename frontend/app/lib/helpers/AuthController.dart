import "BackendHelper.dart";
import "../firebase/firebase_auth_service.dart";

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
}
