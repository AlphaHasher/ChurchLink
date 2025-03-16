import 'package:flutter/material.dart';
import 'src/auth/firebase_auth_service.dart';
import 'register_page_test.dart';
import '../pages/dashboard.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  _LoginPageState createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final FirebaseAuthService _authService = FirebaseAuthService();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  String errorMessage = '';



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Login")),
      body: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: emailController,
              decoration: InputDecoration(labelText: "Email"),
              keyboardType: TextInputType.emailAddress,
            ),
            TextField(
              controller: passwordController,
              decoration: InputDecoration(labelText: "Password"),
              obscureText: true,
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () async {
                  String? token = await _authService.signInWithEmail(
                    emailController.text.trim(),
                    passwordController.text.trim(),
                  );
                  if (token != null && token.isNotEmpty) {
                  print("Sign-In Successful! Token: $token");

                  // ✅ Navigate to HomePage after successful sign-in
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (context) => DashboardPage()),
                  );
                } else {
                  print("Sign-In Failed. Check logs.");
                }
                },
              child: Text("Login"),
            ),
            ElevatedButton(
              onPressed: () async {
                String? token = await _authService.signInWithGoogle(); // ✅ Fix: Now returns a Future<String?>
                if (token != null && token.isNotEmpty) {  // ✅ Ensure token is not null/empty
                  print("✅ Google Sign-In Successful! Token: $token");
                  // ✅ Navigate to HomePage after successful sign-in
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (context) => DashboardPage()),
                  );
                } else {
                  print("❌ Google Sign-In Failed. Check logs.");
                }
              },
              child: Text("Sign in with Google"),
            ),
            SizedBox(height: 10),
            TextButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => RegisterPage()),
                );
              },
              child: Text("Sign Up !"),
            ),
            TextButton(
              onPressed: () {
                // Navigate to Forgot Password Page
              },
              child: Text("Forgot Password?"),
            ),
            if (errorMessage.isNotEmpty)
              Padding(
                padding: EdgeInsets.all(8.0),
                child: Text(
                  errorMessage,
                  style: TextStyle(color: Colors.red),
                ),
              ),
          ],
        ),
      ),
    );
  }
}