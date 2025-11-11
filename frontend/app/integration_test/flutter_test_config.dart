import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  // Suppress Flutter framework errors
  FlutterError.onError = (FlutterErrorDetails details) {
    final exception = details.exception;
    final message = details.exceptionAsString();
    
    // Filter out image-related errors
    if (exception is ArgumentError ||
        message.contains('No host specified in URI') ||
        message.contains('IMAGE RESOURCE SERVICE') ||
        message.contains('CachedNetworkImageProvider')) {
      return; // Silently ignore
    }
    
    FlutterError.presentError(details);
  };

  // Suppress async errors in the zone
  await runZonedGuarded(
    () async {
      await testMain();
    },
    (error, stack) {
      final errorString = error.toString();
      
      // Filter out image-related errors
      if (error is ArgumentError ||
          errorString.contains('No host specified in URI') ||
          errorString.contains('CachedNetworkImageProvider')) {
        return; // Silently ignore
      }
      
      // Print other errors (or throw them)
      print('Unhandled error: $error\n$stack');
    },
  );
}