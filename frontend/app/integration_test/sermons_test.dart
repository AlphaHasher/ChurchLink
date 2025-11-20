import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:app/main.dart' as app;

void main() {
  
  patrolTest('Sermons page shows empty message', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  // Navigate to Sermons page
  await $(Card).$('Sermons').tap();
  await $.pumpAndSettle();

  // Check header and message
  expect($('No sermons available yet. Pull to refresh.').exists, isTrue);

},
  timeout: Timeout(Duration(seconds: 30)),
);
 
 patrolTest('Opens and shows filter dialog on Sermons page', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Sermons').tap();
  await $.pumpAndSettle();

  // Tap the search/filter icon in the AppBar
  await $(Icons.search).tap();
  await $.pumpAndSettle();

  // Verify the filter dialog title and key controls
  expect($('Filter Sermons').exists, isTrue);
  expect($('Search').exists, isTrue);
  expect($('Speaker').exists, isTrue);
  expect($('All ministries').exists, isTrue);
  expect($('Apply').exists, isTrue);
  expect($('Clear').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

 patrolTest('Filter dialog interaction works', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Sermons').tap();
  await $.pumpAndSettle();
  await $(Icons.search).tap();
  await $.pumpAndSettle();

  // Toggle favorites switch
  await $('Favorites only').tap();
  await $.pumpAndSettle();

  // Tap Apply
  await $('Apply').tap();
  await $.pumpAndSettle();

  // Verify filter closed (Apply should dismiss dialog)
  expect($('Filter Sermons').exists, isFalse);
},
  timeout: Timeout(Duration(seconds: 30)),
);

 patrolTest('Back arrow from Sermons page returns home', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $(Card).$('Sermons').tap();
  await $.pumpAndSettle();

  await $(Icons.arrow_back).tap();
  await $.pumpAndSettle();

  // Verify we're back on Home screen
  expect($('Join Live').exists, isTrue);
},
  timeout: Timeout(Duration(seconds: 30)),
);

 patrolTest('Dismiss filter dialog with close icon', ($) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exception.toString().contains('No host specified in URI')) {
      return;
    }
    originalOnError?.call(details);
  };

  app.main();
  await $.pumpAndSettle();

  await $('Sermons').tap();
  await $.pumpAndSettle();
  await $(Icons.search).tap();
  await $.pumpAndSettle();

  // Close the filter dialog
  await $(Icons.close).tap();
  await $.pumpAndSettle();

  // Verify dialog closed
  expect($('Filter Sermons').exists, isFalse);
},
  timeout: Timeout(Duration(seconds: 30)),
);
}