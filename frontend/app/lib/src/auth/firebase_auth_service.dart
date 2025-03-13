import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class FirebaseAuthService {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  final String backendUrl = "http://10.0.2.2:8000"; // FastAPI backend URL

  // // ✅ Initialize Firebase Auth
  // Future<void> initializeFirebase() async {
  //   await FirebaseAuth.instance.useAuthEmulator('localhost', 9099); // Use emulator if needed
  // }

  // ✅ Google Sign-In (Fixed)
Future<String?> signInWithGoogle() async {
  try {
    final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
    if (googleUser == null) {
      print("Google Sign-In Canceled");
      return null; // User canceled
    }

    final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

    // ✅ Firebase Sign-In with Google Credential
    final AuthCredential credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,  // Google OAuth token
      idToken: googleAuth.idToken,          // Google ID token
    );

    final UserCredential userCredential =
        await _firebaseAuth.signInWithCredential(credential);

    // ✅ Get Firebase ID Token (THIS is what FastAPI expects)
    final String? firebaseIdToken = await userCredential.user?.getIdToken();

    if (firebaseIdToken == null) {
      print("Failed to retrieve Firebase ID Token");
      return null;
    }

    // Debug: Print Firebase ID token to confirm correct token is retrieved
    print("🔥 Firebase ID Token: $firebaseIdToken");

    // ✅ Send Firebase ID Token to FastAPI backend for verification
    final response = await http.post(
      Uri.parse("$backendUrl/auth/google"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"id_token": firebaseIdToken}),
    );

    if (response.statusCode == 200) {
      final responseData = jsonDecode(response.body);
      print("✅ Backend Response: ${response.body}");
      return responseData["token"]; // Return JWT token from backend
    } else {
      print("❌ Backend Error: ${response.body}");
      return null;
    }
  } catch (e) {
    print("❌ Error signing in with Google: $e");
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
      print("❌ Email not verified. Please verify your email.");
      return "Email not verified. Please check your inbox.";
    }

    final idToken = await user.getIdToken(true);
    return idToken;
  } catch (e) {
    print("❌ Error signing in with email: $e");
    return null;
  }
}

  Future<String?> registerWithEmail(String email, String password) async {
  try {
    // ✅ Step 1: Create user in Firebase
    final UserCredential userCredential =
        await FirebaseAuth.instance.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );

    final User? user = userCredential.user;
    if (user == null) {
      throw Exception("❌ User registration failed: No Firebase user found.");
    }

    print("✅ Firebase User Created: ${user.email}");

    // ❌ Removed Email Verification Step ❌
    // if (!user.emailVerified) {
    //   await user.sendEmailVerification();
    //   print("📩 Verification email sent to ${user.email}");
    // }

    // ✅ Step 2: Force reload Firebase session to ensure ID token is available
    await Future.delayed(Duration(seconds: 2)); // Wait for session update
    await user.reload();

    // ✅ Step 3: Retrieve Firebase ID Token (force refresh)
    final String? idToken = await user.getIdToken(true);
    if (idToken == null) {
      throw Exception("❌ Failed to retrieve Firebase ID Token.");
    }

    print("🔥 Firebase ID Token: $idToken");

    /// ✅ Step 5: Debug and Send Token to FastAPI
    final response = await http.post(
      Uri.parse("http://10.0.2.2:8000/auth/register"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"id_token": idToken}),
    );
    
    print("🔍 Backend Response: ${response.body}"); // ✅ Debugging
    
    if (response.statusCode == 200) {
      final responseData = jsonDecode(response.body);
      print("✅ Registration Successful: ${response.body}");
      
      if (responseData.containsKey("token")) {
        return responseData["token"]; // ✅ Ensure token exists before returning
      } else {
        throw Exception("❌ No token received in response.");
      }
    } else {
      throw Exception("❌ Backend Error: ${response.body}");
    }
  } catch (e) {
    print("❌ Error during registration: $e");
    return null;
  }
}

  // ✅ Logout User
  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _firebaseAuth.signOut();
  }

  // ✅ Check User Login Status
  User? getCurrentUser() {
    return _firebaseAuth.currentUser;
  }
}