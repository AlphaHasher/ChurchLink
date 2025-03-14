import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'src/auth/firebase_auth_service.dart';
import 'login_page_test.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  _RegisterPageState createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final FirebaseAuthService _authService = FirebaseAuthService();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController confirmPasswordController = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  String errorMessage = '';
  bool isLoading = false;

  Future<void> registerUser() async {
  // ✅ Check if form state exists before validating
  if (_formKey.currentState == null || !_formKey.currentState!.validate()) {
    return; // ✅ Don't proceed if validation fails
  }

  setState(() {
    isLoading = true;
    errorMessage = '';
  });

  try {
    // Register the user with Firebase
    String? token = await _authService.registerWithEmail(
      emailController.text.trim(),
      passwordController.text.trim(),
    );

    if (token != null) {
      print("✅ Account Register Successful! Token: $token");

      // Navigate to HomePage after successful registration
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => LoginPage()),
      );
    } else {
      setState(() {
        errorMessage = "Registration failed. Please try again.";
      });
      print("❌ Account Register Failed: No token returned.");
    }
  } on http.ClientException catch (e) {
    setState(() {
      errorMessage = "❌ Network error: Failed to connect to server.";
    });
    print("❌ Network error during registration: $e");
  } catch (e) {
    setState(() {
      errorMessage = "An error occurred: ${e.toString()}";
    });
    print("❌ Error during registration: $e");
  } finally {
    setState(() {
      isLoading = false;
    });
  }
}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Register")),
      body: Padding(
        padding: EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextFormField(
                controller: emailController,
                decoration: InputDecoration(labelText: "Email"),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) return "Email is required.";
                  if (!RegExp(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").hasMatch(value)) {
                    return "Enter a valid email.";
                  }
                  return null;
                },
              ),
              TextFormField(
                controller: passwordController,
                decoration: InputDecoration(labelText: "Password"),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) return "Password is required.";
                  if (value.length < 6) return "Password must be at least 6 characters.";
                  return null;
                },
              ),
              TextFormField(
                controller: confirmPasswordController,
                decoration: InputDecoration(labelText: "Confirm Password"),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) return "Confirm password is required.";
                  if (value != passwordController.text) return "Passwords do not match!";
                  return null;
                },
              ),
              SizedBox(height: 20),
              isLoading
                  ? CircularProgressIndicator()
                  : ElevatedButton(
                      onPressed: registerUser,
                      child: Text("Register"),
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
      ),
    );
  }
}