
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;


void main() {

  patrolTest('Profile tab shows Guest state when logged out', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  // Navigate to the Profile/User Settings tab
  await $('Profile').tap();
  await $.pumpAndSettle();

  // Verify the correct state
  expect($('User Settings').exists, isTrue);
  expect($('Guest').exists, isTrue);
  expect($('Login or Signup').exists, isTrue);
  expect($('To access more features login or signup').exists, isTrue);
  expect($('Theme').exists, isTrue);
  expect($('Language').exists, isTrue);
  expect($('Notifications').exists, isTrue);
  expect($('Terms & Policies').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);
 patrolTest('Login or Signup opens authentication popup', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Profile').tap();
  await $.pumpAndSettle();

  await $('Login or Signup').tap();
  await $.pumpAndSettle();

  // Verify popup UI
  expect($('Sign in').exists, isTrue);
  expect($('Continue with Email').exists, isTrue);
  expect($('Continue with Google').exists, isTrue);
  expect($('Continue with Apple').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

}