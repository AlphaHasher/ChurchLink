
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
  expect(await $('User Settings').exists, isTrue);
  expect(await $('Guest').exists, isTrue);
  expect(await $('Login or Signup').exists, isTrue);
  expect(await $('To access more features login or signup').exists, isTrue);
  expect(await $('Theme').exists, isTrue);
  expect(await $('Language').exists, isTrue);
  expect(await $('Notifications').exists, isTrue);
  expect(await $('Terms & Policies').exists, isTrue);
});
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
  expect(await $('Sign in').exists, isTrue);
  expect(await $('Continue with Email').exists, isTrue);
  expect(await $('Continue with Google').exists, isTrue);
});

}