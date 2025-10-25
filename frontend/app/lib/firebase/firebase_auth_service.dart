import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:app/services/fcm_token_service.dart';

class FirebaseAuthService {
  static final FirebaseAuthService _instance = FirebaseAuthService._internal();
  
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  
  bool _initialized = false;

  FirebaseAuthService._internal();

  factory FirebaseAuthService() {
    return _instance;
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
    } catch (e) {
      debugPrint("❌ Error during registration: $e");
      return null;
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
}
