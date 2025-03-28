import 'package:app/pages/bible.dart';
import 'package:app/pages/dashboard.dart';
import 'package:app/pages/sermons.dart';
import 'package:app/pages/user/user_settings.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

/// Handles notifications received while the app is in the background
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  print("📢 Background notification received: ${message.notification?.title}");
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Load environment variables
  try {
    await dotenv.load(fileName: ".env");
  } catch (e) {
    print("❌ Failed to load .env file: $e");
  }

  // ✅ Initialize Firebase
  await Firebase.initializeApp();

  // ✅ Setup Firebase Messaging
  setupFirebaseMessaging();

  runApp(const MyApp());
}

void setupFirebaseMessaging() async {
  FirebaseMessaging messaging = FirebaseMessaging.instance;

  // ✅ Request permission from the user
  NotificationSettings settings = await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );

  if (settings.authorizationStatus == AuthorizationStatus.authorized) {
    print("✅ User granted permission");

    // ✅ Retrieve the FCM device token
    String? token = await messaging.getToken();
    print("🔥 Firebase Token: $token");

    // ✅ Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print("📢 Foreground message received: ${message.notification?.title}");

      // Show a SnackBar notification
      ScaffoldMessenger.of(navigatorKey.currentContext!).showSnackBar(
        SnackBar(
          content: Text("${message.notification?.title}: ${message.notification?.body}"),
        ),
      );
    });

    // ✅ Handle background messages
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

    // ✅ Handle when notification is clicked
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print("📩 Notification clicked!");
      navigatorKey.currentState?.push(MaterialPageRoute(builder: (_) => DashboardPage()));
    });
  } else {
    print("❌ User denied permission");
  }
}

// ✅ Global navigator key for displaying notifications
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ChurchLink',
      navigatorKey: navigatorKey, // ✅ Allows access to Navigator for SnackBars
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color.fromARGB(255, 22, 77, 60)),
      ),
      home: const MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  final FirebaseAuthService authService = FirebaseAuthService();

  User? user;
  int _currentIndex = 0;
  bool isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    user = authService.getCurrentUser();
    isLoggedIn = user != null;
  }

  List<Widget> get _screens {
    return [
      const DashboardPage(),
      const BiblePage(),
      const SermonsPage(),
      const UserSettings(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (value) => setState(() {
          _currentIndex = value;
        }),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: "Home"),
          BottomNavigationBarItem(icon: Icon(Icons.book), label: "Bible"),
          BottomNavigationBarItem(icon: Icon(Icons.book), label: "Sermons"),
          BottomNavigationBarItem(icon: Icon(Icons.account_box), label: "Profile"),
        ],
      ),
    );
  }
}
