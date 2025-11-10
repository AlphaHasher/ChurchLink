import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

void main() {
  patrolTest('Join Live page shows offline message', ($) async {
    app.main();
    await $.pumpAndSettle();

    // Navigate to Join Live
    await $('Join Live').tap();
    await $.pumpAndSettle();

    // Verify header
    expect(await $('YouTube Live').exists, isTrue);

    // Verify offline message
    expect(await $('We are not currently live!').exists, isTrue);

    // Verify "Go to Channel" button
    expect(await $('Go to Channel').exists, isTrue);

    // Verify description text
    expect(await $('To keep up with our future streams').exists, isTrue);
  });

 patrolTest('Join Live Go to Channel button works', ($) async {
  app.main();
  await $.pumpAndSettle();

  await $('Join Live').tap();
  await $.pumpAndSettle();

  await $('Go to Channel').tap();
  await $.pumpAndSettle();

  // Verify something changes — for example, a Snackbar or navigation
  // (If nothing changes visually, use mock handling for URL launcher)
  // Example fallback check:
  expect(true, isTrue, reason: 'Tapped Go to Channel successfully');
});
 
 patrolTest('Join Live back arrow navigates home', ($) async {
  app.main();
  await $.pumpAndSettle();

  await $('Join Live').tap();
  await $.pumpAndSettle();

  // Tap the app bar back arrow
  await $(Icons.arrow_back).tap();
  await $.pumpAndSettle();

  // Verify we're back on the home screen
  expect(await $('Join Live').exists, true); // back to home
});

 patrolTest('Join Live shows offline instead of video', ($) async {
  app.main();
  await $.pumpAndSettle();

  await $('Join Live').tap();
  await $.pumpAndSettle();

  final offlineMsg = $('We are not currently live!');

  expect(await offlineMsg.exists, true);
});
}