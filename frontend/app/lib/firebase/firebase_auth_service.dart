import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Another test commit
/// - Connect to login page
/// - Connect to sign up page
/// - Connect to user profile
/// - Add toasts for error messages
/// - More testing (very minimal testing has been done but it works (kinda))

class AuthenticationService { // REMINDER - Needs to be used as an instance
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // Listen to auth state changes
  Stream<User?> get authStateChanges => _auth.authStateChanges();
  // Get auth
  FirebaseAuth getAuthInstance() {
    return _auth;
  }
  // Get current user
  User? getCurrentUser() {
    return _auth.currentUser;
  }
  // Sign out
  Future<void> signOut() async {
    await _auth.signOut();
  }

  // Sign up with email and password
  Future<User?> signUpEmailPass(String email, String password) async {
    // Check before  Firebase call
    try {
      validateEmail(email);
      validatePassword(password);
    } on FormatException catch (e) {
      return null;
    }

    // Call Firebase
    try {
      final UserCredential userCreds =
      await _auth.createUserWithEmailAndPassword(
          email: email,
          password: password
      );
      return userCreds.user;
    } on FirebaseAuthException catch (e) {
      String err = ''; // Error message for user
      if (e.code == 'weak-password') {
        err = 'The password provided is too weak.';
      } else if (e.code == 'email-already-in-use') {
        err = 'An account already exists with that email';
      }
      // Prompt error here
      return null;
    }
  }

  // Sign-in with email and password
  Future<User?> signInEmailPass(String email, String password) async {
    // Check before  Firebase call
    try {
      validateEmail(email);
      validatePassword(password);
    } on FormatException catch (e) {
      return null;
    }

    // Call Firebase
    try {
      final UserCredential userCreds =
        await _auth.signInWithEmailAndPassword(
            email: email,
            password: password
        );
      return userCreds.user;
    } on FirebaseAuthException catch (e) {
      String err = ''; // Error message for user
      if (e.code == 'invalid-email') {
        err = 'Email is invalid';
      } else if (e.code == 'invalid-credential') {
        err = 'Password is incorrect';
      }
      // Prompt error here
      return null;
    }
  }

  // Sign in with Google
  Future<UserCredential?> signInGoogle() async {
    final GoogleSignIn googleSignIn = GoogleSignIn();
    try {
      final GoogleSignInAccount? googleUser = await googleSignIn.signIn();
      if (googleUser == null) {
        throw Exception('Something went wrong');
      }

      // Obtain the auth details from the Google Sign-In
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      // Create a new credential for Firebase
      final AuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with the Google credential
      return await _auth.signInWithCredential(credential);
    } on Exception catch(e) {
      print(e);
      return null;
    }
  }

  /// Validation Helpers
  final RegExp emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
  void validateEmail(String email) {
    if (!emailRegex.hasMatch(email)) {
      throw FormatException('Invalid email format');
    }
  }

  void validatePassword(String password) {
    // Check minimum length
    if (password.length < 6) {
      throw FormatException('Password must be at least 6 characters long');
    }

    // Check for at least one uppercase letter
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      throw FormatException('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!RegExp(r'[a-z]').hasMatch(password)) {
      throw FormatException('Password must contain at least one lowercase letter');
    }

    // Check for at least one digit
    if (!RegExp(r'[0-9]').hasMatch(password)) {
      throw FormatException('Password must contain at least one digit');
    }
  }
}
