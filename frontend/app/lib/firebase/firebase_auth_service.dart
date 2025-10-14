import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/fcm_token_service.dart';

class FirebaseAuthService {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  // final String backendUrl = "http://10.0.2.2:8000"; // FastAPI backend URL

  // // ✅ Initialize Firebase Auth
  // Future<void> initializeFirebase() async {
  //   await FirebaseAuth.instance.useAuthEmulator('localhost', 9099); // Use emulator if needed
  // }

  // ✅ Google Sign-In (Fixed)
  Future<String?> signInWithGoogle() async {
    try {
  final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        debugPrint("Google Sign-In Canceled");
        return null; // User canceled sign-in
      }

  final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      final AuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final UserCredential userCredential =
      await FirebaseAuth.instance.signInWithCredential(credential);

      final String? idToken = await userCredential.user?.getIdToken(true);
      if (idToken == null) {
        throw Exception("❌ Failed to retrieve Firebase ID Token.");
      }

      debugPrint("🔥 Firebase ID Token: $idToken");
      return idToken;
    } catch (e) {
      debugPrint("❌ Error during Google Sign-In: $e");
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
    await _googleSignIn.signOut();
    await _firebaseAuth.signOut();
    // Reset FCM token flag when user logs out
    FCMTokenService.reset();
  }

  // ✅ Check User Login Status
  User? getCurrentUser() {
    return _firebaseAuth.currentUser;
  }
}