import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:app/services/fcm_token_service.dart';
import 'package:app/helpers/backend_helper.dart';

class FirebaseAuthService {
  static final FirebaseAuthService _instance = FirebaseAuthService._internal();
  
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  
  bool _initialized = false;

  FirebaseAuthService._internal();

  factory FirebaseAuthService() {
    return _instance;
  }

  // Calls the sync function to make MongoDB email match Firebase
  Future<void> _postSignInSync() async {
    await BackendHelper().verifyAndSyncUser((msg) {
    });
  }

  Future<void> initializeGoogleSignIn({
    String? clientId,
    String? serverClientId,
  }) async {
    if (_initialized) return;
    
    try {
      await GoogleSignIn.instance.initialize(
        serverClientId: serverClientId, // Optionally: override if needed
      );
      _initialized = true;
      debugPrint("✅ GoogleSignIn initialized successfully");
    } catch (e) {
      debugPrint("❌ Error in GoogleSignIn initialization: $e");
      rethrow;
    }
  }

  Future<String?> signInWithGoogle() async {
    try {
      if (!_initialized) {
        debugPrint("⚠️  GoogleSignIn not initialized. Call initializeGoogleSignIn() first.");
        return null;
      }

      debugPrint("🔐 Attempting Google Sign-In...");
      
      final GoogleSignInAccount googleUser = await GoogleSignIn.instance.authenticate();
      
      debugPrint("✅ Google authentication successful for: ${googleUser.email}");

      // Get authentication tokens
      final GoogleSignInAuthentication googleAuth = googleUser.authentication;

      if (googleAuth.idToken == null) {
        debugPrint("❌ Failed to get ID token from Google authentication");
        return null;
      }

      // Create Firebase credential using the Google ID token
      final AuthCredential credential = GoogleAuthProvider.credential(
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase using the Google credential
      final UserCredential userCredential =
          await _firebaseAuth.signInWithCredential(credential);

      final User? user = userCredential.user;
      if (user == null) {
        throw Exception("❌ No user found after Firebase authentication.");
      }

      debugPrint("✅ Firebase authentication successful for user: ${user.email}");

      // Get Firebase ID Token for backend authentication
      final String? idToken = await user.getIdToken(true);
      debugPrint("🔥 Firebase ID Token: $idToken");
      if (idToken == null) {
        throw Exception("❌ Failed to retrieve Firebase ID Token.");
      }

      debugPrint("🔥 Firebase ID Token acquired (length: ${idToken.length})");
      return idToken;
    } on FirebaseAuthException catch (e) {
      debugPrint("❌ Firebase Auth Error: ${e.code} - ${e.message}");
      return null;
    } catch (e) {
      debugPrint("❌ Unexpected error during Google Sign-In: $e");
      return null;
    }
  }

  Future<String?> signInWithApple() async {
    try {
      debugPrint("🍎 Attempting Apple Sign-In...");
      
      // Check if Apple Sign In is available
      if (!await SignInWithApple.isAvailable()) {
        debugPrint("❌ Apple Sign-In is not available on this device");
        return null;
      }

      // Request credential from Apple
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      debugPrint("✅ Apple authentication successful");

      // Create Firebase credential using Apple ID token
      final oauthCredential = OAuthProvider("apple.com").credential(
        idToken: appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
      );

      // Sign in to Firebase using the Apple credential
      final UserCredential userCredential =
          await _firebaseAuth.signInWithCredential(oauthCredential);

      final User? user = userCredential.user;
      if (user == null) {
        throw Exception("❌ No user found after Firebase authentication.");
      }

      debugPrint("✅ Firebase authentication successful for user: ${user.email ?? 'No email provided'}");

      // Get Firebase ID Token for backend authentication
      final String? idToken = await user.getIdToken(true);
      if (idToken == null) {
        throw Exception("❌ Failed to retrieve Firebase ID Token.");
      }

      debugPrint("🔥 Firebase ID Token acquired (length: ${idToken.length})");
      return idToken;
    } on SignInWithAppleAuthorizationException catch (e) {
      debugPrint("❌ Apple Sign-In Authorization Error: ${e.code} - ${e.message}");
      // Handle specific Apple Sign-In errors
      switch (e.code) {
        case AuthorizationErrorCode.canceled:
          debugPrint("❌ Apple Sign-In was cancelled by user");
          break;
        case AuthorizationErrorCode.failed:
          debugPrint("❌ Apple Sign-In failed - check iOS configuration");
          break;
        case AuthorizationErrorCode.invalidResponse:
          debugPrint("❌ Apple Sign-In invalid response");
          break;
        case AuthorizationErrorCode.notHandled:
          debugPrint("❌ Apple Sign-In not handled");
          break;
        case AuthorizationErrorCode.notInteractive:
          debugPrint("❌ Apple Sign-In not interactive");
          break;
        case AuthorizationErrorCode.unknown:
          debugPrint("❌ Apple Sign-In unknown error - likely configuration issue");
          break;
        case AuthorizationErrorCode.credentialExport:
          debugPrint("❌ Apple Sign-In credential export error");
          break;
        default:
          debugPrint("❌ Apple Sign-In unhandled error code: ${e.code}");
          break;
      }
      return null;
    } on FirebaseAuthException catch (e) {
      debugPrint("❌ Firebase Auth Error: ${e.code} - ${e.message}");
      
      // Handle specific Firebase Auth errors for Apple Sign-In
      if (e.code == 'operation-not-allowed') {
        debugPrint("❌ Apple Sign-In not configured in Firebase Console");
        debugPrint("ℹ️  Go to Firebase Console > Authentication > Sign-in method");
        debugPrint("ℹ️  Enable Apple provider and configure Services ID");
      }
      
      return null;
    } catch (e) {
      debugPrint("❌ Unexpected error during Apple Sign-In: $e");
      return null;
    }
  }

  // ✅ Email & Password Sign-In
  Future<String?> signInWithEmail(String email, String password) async {
    try {
      final UserCredential userCredential =
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      final User? user = userCredential.user;
      if (user == null) {
        throw Exception("❌ No authenticated user found.");
      }

      if (!user.emailVerified) {
        debugPrint("❌ Email not verified. Please verify your email.");
        return "Email not verified. Please check your inbox.";
      }

      // Sync Firebase email with MongoDB
      // Needed for when user changes email
      await _postSignInSync();

      final String? idToken = await user.getIdToken(true);
      if (idToken == null) {
        throw Exception("❌ Failed to retrieve Firebase ID Token.");
      }
      debugPrint("🔥 Firebase ID Token: $idToken");
      return idToken;
    } catch (e) {
      debugPrint("❌ Error signing in with email: $e");
      return null;
    }
  }

  Future<String?> registerWithEmail(String email, String password) async {
    try {
      final UserCredential userCredential =
      await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final User? user = userCredential.user;
      if (user == null) {
        throw Exception("❌ User registration failed: No Firebase user found.");
      }

      debugPrint("✅ Firebase User Created: ${user.email}");

      final String? idToken = await user.getIdToken(true);
      if (idToken == null) {
        throw Exception("❌ Failed to retrieve Firebase ID Token.");
      }

      debugPrint("🔥 Firebase ID Token: $idToken");
      return idToken;
    } on FirebaseAuthException catch (e) {
      if (e.code == 'email-already-in-use') {
        debugPrint("❌ Registration error: Email already in use.");
        return "This email is already registered.";
      }
      debugPrint("❌ Firebase Auth Error: ${e.code} - ${e.message}");
      return e.message;
    } catch (e) {
      debugPrint("❌ Error during registration: $e");
      return "An unexpected error occurred during registration.";
    }
  }

  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _firebaseAuth.sendPasswordResetEmail(email: email);
    } catch (e) {
      rethrow;
    }
  }

  // ✅ Logout User
  Future<void> signOut() async {
    try {
      // Sign out from Firebase
      await _firebaseAuth.signOut();
      
      // Sign out from Google Sign-In
      await GoogleSignIn.instance.signOut();
      
      debugPrint("✅ User signed out successfully");
    } catch (e) {
      debugPrint("❌ Error signing out: $e");
    }
    
    // Reset FCM token flag when user logs out
    FCMTokenService.reset();
  }

  // ✅ Check User Login Status
  User? getCurrentUser() {
    return _firebaseAuth.currentUser;
  }

  // Change Email function
  // WORKS BUT DOESNT MATCH THE OTHER FUNCTIONS STYLE
  Future<void> changeEmail({
    required String newEmail,
    String? currentPasswordIfEmailUser,
  }) async {
    final user = FirebaseAuth.instance.currentUser!;
    
    // Re-auth for email/password users (Google/Apple reauth can be added later)
    if (currentPasswordIfEmailUser != null && user.email != null) {
      final cred = EmailAuthProvider.credential(
        email: user.email!,
        password: currentPasswordIfEmailUser,
      );
      await user.reauthenticateWithCredential(cred);
    }

    // Use the currently running project instead of hardcoding it
    final projectId = Firebase.app().options.projectId;
    final host = dotenv.env['AUTH_LINK_HOST'] ?? '$projectId.firebaseapp.com';
    final path = dotenv.env['EMAIL_CHANGE_PATH'] ?? '/finishEmailChange';

    final acs = ActionCodeSettings(
      url: 'https://$host$path',
      handleCodeInApp: false,
    );

    // Send verification link to the NEW email; Firebase updates after user clicks it
    await user.verifyBeforeUpdateEmail(newEmail, acs);
  }
}
