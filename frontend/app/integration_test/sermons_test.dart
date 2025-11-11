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
  expect(await $('No sermons').exists, isTrue);

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
  expect(await $('Filter Sermons').exists, isTrue);
  expect(await $('Search').exists, isTrue);
  expect(await $('Speaker').exists, isTrue);
  expect(await $('All ministries').exists, isTrue);
  expect(await $('Apply').exists, isTrue);
  expect(await $('Clear').exists, isTrue);
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
  expect(await $('Filter Sermons').exists, isFalse);
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
  expect(await $('Join Live').exists, isTrue);
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
  expect(await $('Filter Sermons').exists, isFalse);
},
  timeout: Timeout(Duration(seconds: 30)),
);
}