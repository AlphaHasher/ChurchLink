import 'package:app/pages/bible.dart';
import 'package:app/pages/dashboard.dart';
import 'package:app/pages/user/guest_settings.dart';
import 'package:app/pages/sermons.dart';
import 'package:app/pages/user/user_settings.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/firebase/firebase_options.dart';
import 'package:app/firebase/firebase_auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color.fromARGB(255, 22, 77, 60)),
      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});
  final String title;
  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  final AuthenticationService authService = AuthenticationService();

  User? user;
  int _currentIndex = 0;
  bool isLoggedIn = false;

  // Create a stream to listen for auth state changes
  @override
  void initState() {
    user = authService.getCurrentUser();
    isLoggedIn = user != null;

    super.initState();
    authService.getAuthInstance().authStateChanges().listen((User? user) {
      setState(() {
        // This will rebuild the widget with the correct settings screen
      });
    });
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
      isLoggedIn ? const UserSettings() : const GuestSettings(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
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
                label: isLoggedIn ? "Profile" : "Guest"
            ),
          ]
      ),
    );
  }
}