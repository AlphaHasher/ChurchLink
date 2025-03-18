import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
// import 'package:http/http.dart' as http;
import 'dart:convert';

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
      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        print("Google Sign-In Canceled");
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

      print("🔥 Firebase ID Token: $idToken");
      return idToken;
      // // ✅ Send Firebase ID Token to FastAPI backend
      // final response = await http.post(
      //   Uri.parse("$backendUrl/auth/google"),
      //   headers: {
      //     "Content-Type": "application/json",
      //     "Authorization": "Bearer $idToken",
      //   },
      // );

      // if (response.statusCode == 200) {
      //   final responseData = jsonDecode(response.body);
      //   print("✅ Google Sign-In Successful: ${response.body}");

      //   // ✅ Return the backend token if available
      //   if (responseData.containsKey("token")) {
      //     return responseData["token"];  // ✅ FIXED: Return backend token
      //   } else {
      //     print("❌ Unexpected Backend Response: ${response.body}");
      //     return null;
      //   }
      // } else {
      //   throw Exception("❌ Backend Error: ${response.body}");
      // }
    } catch (e) {
      print("❌ Error during Google Sign-In: $e");
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

      final String? idToken = await user.getIdToken(true);
      if (idToken == null) {
        throw Exception("❌ Failed to retrieve Firebase ID Token.");
      }
      print("🔥 Firebase ID Token: $idToken");
      return idToken;

      // final response = await http.post(
      //   Uri.parse("$backendUrl/auth/token"),
      //   headers: {
      //     "Content-Type": "application/json",
      //     "Authorization": "Bearer $idToken",
      //   },
      // );

      // print("🔍 Backend Response: ${response.body}");

      // if (response.statusCode == 200) {
      //   final responseData = jsonDecode(response.body);
      //   print("✅ Login Successful: ${response.body}");

      //   if (responseData.containsKey("access_token")) {
      //     return responseData["access_token"];
      //   } else {
      //     throw Exception("❌ No token received in response.");
      //   }
      // } else {
      //   throw Exception("❌ Backend Error: ${response.body}");
      // }
    } catch (e) {
      print("❌ Error signing in with email: $e");
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

      print("✅ Firebase User Created: ${user.email}");

      final String? idToken = await user.getIdToken(true);
      if (idToken == null) {
        throw Exception("❌ Failed to retrieve Firebase ID Token.");
      }

      print("🔥 Firebase ID Token: $idToken");
      return idToken;
      // final response = await http.post(
      //   Uri.parse("$backendUrl/auth/register"),
      //   headers: {
      //     "Content-Type": "application/json",
      //     "Authorization": "Bearer $idToken", // ✅ Send ID token in Authorization header
      //   },
      // );

      // print("🔍 Backend Response: ${response.body}");

      // if (response.statusCode == 200) {
      //   final responseData = jsonDecode(response.body);
      //   print("✅ Registration Successful: ${response.body}");
      //   return responseData["email"]; // ✅ Return registered email
      // } else {
      //   throw Exception("❌ Backend Error: ${response.body}");
      // }
    } catch (e) {
      print("❌ Error during registration: $e");
      return null;
    }
  }

  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _firebaseAuth.sendPasswordResetEmail(email: email);
    } catch (e) {
      throw e;
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