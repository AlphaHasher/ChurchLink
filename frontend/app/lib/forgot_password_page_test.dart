import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'firebase/firebase_auth_service.dart';

class ForgotPasswordPage extends StatefulWidget {
  @override
  _ForgotPasswordPageState createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final TextEditingController _emailController = TextEditingController();
  final FirebaseAuthService _authService = FirebaseAuthService();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  void _resetPassword() async {
  if (_formKey.currentState!.validate()) {
    String email = _emailController.text.trim();
    try {
      await _authService.sendPasswordResetEmail(email);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('If an account exists, a password reset link has been sent to $email')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('An error occurred. Please try again later.')),
      );
    }
  }
}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Forgot Password")),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                "Enter your email to reset your password",
                style: TextStyle(fontSize: 18),
              ),
              SizedBox(height: 20),
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: "Email",
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return "Please enter your email";
                  } else if (!RegExp(r"^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$")
                      .hasMatch(value)) {
                    return "Enter a valid email";
                  }
                  return null;
                },
              ),
              SizedBox(height: 20),
              ElevatedButton(
                onPressed: _resetPassword,
                child: Text("Reset Password"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}