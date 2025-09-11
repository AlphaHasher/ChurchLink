import 'package:app/pages/bible.dart';
import 'package:app/pages/dashboard.dart';
import 'package:app/pages/sermons.dart';
import 'package:app/pages/user/user_settings.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:app/services/FirebaseMessaging_service.dart';
import 'package:provider/provider.dart';
import 'package:app/providers/tab_provider.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:url_launcher/url_launcher.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

Map<String, dynamic>? initialNotificationData;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  try {
    await dotenv.load(fileName: ".env");
  } catch (e) {
    debugPrint("Failed to load .env file: $e");
  }

  // Initialize Firebase
  await Firebase.initializeApp();

  // Setup messaging and notifications BEFORE checking for initial message
  setupFirebaseMessaging();
  await setupLocalNotifications();

  RemoteMessage? initialMessage = await FirebaseMessaging.instance.getInitialMessage();
  if (initialMessage != null) {
    initialNotificationData = initialMessage.data;
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (context) {
          final provider = TabProvider();
          TabProvider.instance = provider;
          return provider;
        }),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ChurchLink',
      navigatorKey: navigatorKey, // Allows navigation from notifications
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color.fromARGB(255, 22, 77, 60)),
      ),
      home: const MyHomePage(),
      routes: {
        '/home': (context) => const DashboardPage(),
        '/bible': (context) => const BiblePage(),
        '/sermons': (context) => const SermonsPage(),
        '/profile': (context) => const UserSettings(),
      },
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
  bool isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    user = authService.getCurrentUser();
    isLoggedIn = user != null;
    // Handle initial notification navigation here
    if (initialNotificationData != null) {
      final data = initialNotificationData!;
      if (data['tab'] != null) {
        final tabValue = data['tab'];
        if (tabValue is String) {
          TabProvider.instance?.setTabByName(tabValue);
        } else if (tabValue is int) {
          TabProvider.instance?.setTab(tabValue);
        } else {
          int? idx = int.tryParse(tabValue.toString());
          if (idx != null) TabProvider.instance?.setTab(idx);
        }
      } else if (data['link'] != null) {
        launchUrl(Uri.parse(data['link']));
      } else if (data['route'] != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          navigatorKey.currentState?.pushNamed(data['route']);
        });
      }
      initialNotificationData = null;
    }
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
    final tabProvider = Provider.of<TabProvider>(context);
    return Scaffold(
      body: _screens[tabProvider.currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: tabProvider.currentIndex,
        onTap: (value) => tabProvider.setTab(value),
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

