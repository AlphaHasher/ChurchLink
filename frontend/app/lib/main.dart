import 'package:app/pages/bible.dart';
import 'package:app/pages/dashboard.dart';
import 'package:app/pages/sermons.dart';
import 'package:app/pages/user/user_settings.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:app/firebase/firebase_options.dart';
import 'firebase/firebase_auth_service.dart';

import 'package:flutter_dotenv/flutter_dotenv.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Try loading the .env file & handle errors
  try {
    await dotenv.load(fileName: ".env"); // Explicitly specify the .env file
  } catch (e) {
    print("❌ Failed to load .env file: $e");
  }

  // ✅ Initialize Firebase AFTER .env loads
  await Firebase.initializeApp();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ChurchLink',
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

  // Method to get the current screens based on auth state
  List<Widget> get _screens {
    if(isLoggedIn) {
      print(user.toString());
    }
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
          onTap: (value) => {
            setState(() {
              _currentIndex = value;
            })
          },
          items: [
            BottomNavigationBarItem(
                icon: Icon(Icons.home),
                label: "Home"
            ),
            BottomNavigationBarItem(
                icon: Icon(Icons.book),
                label: "Bible"
            ),
            BottomNavigationBarItem(
                icon: Icon(Icons.book),
                label: "Sermons"
            ),
            BottomNavigationBarItem(
                icon: Icon(Icons.account_box),
                label: "Profile"
            ),
          ]
      ),
    );
  }
}