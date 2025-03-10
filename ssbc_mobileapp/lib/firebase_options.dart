// File generated by FlutterFire CLI.
// ignore_for_file: type=lint
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
///
/// Example:
/// ```dart
/// import 'firebase_options.dart';
/// // ...
/// await Firebase.initializeApp(
///   options: DefaultFirebaseOptions.currentPlatform,
/// );
/// ```
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBtkeMmIix9cDcA0As1R62aWiQ1zo1ZbY0',
    appId: '1:790634165676:web:48651e2c8506bb9d5d7609',
    messagingSenderId: '790634165676',
    projectId: 'ssbc-9ef2d',
    authDomain: 'ssbc-9ef2d.firebaseapp.com',
    storageBucket: 'ssbc-9ef2d.firebasestorage.app',
    measurementId: 'G-1LSFGBWFN4',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDhiB48_d9_x7gtk1-G9430EpRCwZHEnhw',
    appId: '1:790634165676:android:3aa6c510fa921ee45d7609',
    messagingSenderId: '790634165676',
    projectId: 'ssbc-9ef2d',
    storageBucket: 'ssbc-9ef2d.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyCiPX1WikzBGUjyAEkXDVsWCBk8mTKYHeA',
    appId: '1:790634165676:ios:1e18a7e575150a985d7609',
    messagingSenderId: '790634165676',
    projectId: 'ssbc-9ef2d',
    storageBucket: 'ssbc-9ef2d.firebasestorage.app',
    iosBundleId: 'com.example.ssbcMobileapp',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyCiPX1WikzBGUjyAEkXDVsWCBk8mTKYHeA',
    appId: '1:790634165676:ios:1e18a7e575150a985d7609',
    messagingSenderId: '790634165676',
    projectId: 'ssbc-9ef2d',
    storageBucket: 'ssbc-9ef2d.firebasestorage.app',
    iosBundleId: 'com.example.ssbcMobileapp',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyBtkeMmIix9cDcA0As1R62aWiQ1zo1ZbY0',
    appId: '1:790634165676:web:08a3f9a124e700bf5d7609',
    messagingSenderId: '790634165676',
    projectId: 'ssbc-9ef2d',
    authDomain: 'ssbc-9ef2d.firebaseapp.com',
    storageBucket: 'ssbc-9ef2d.firebasestorage.app',
    measurementId: 'G-3TVLFSKWWR',
  );
}
