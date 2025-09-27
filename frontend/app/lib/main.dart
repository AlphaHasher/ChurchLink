import 'package:app/pages/bible.dart';
import 'package:app/pages/dashboard.dart';
import 'package:app/pages/sermons.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/user/user_settings.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/weeklybulletin.dart';
import 'package:app/pages/giving.dart';
import 'package:app/pages/ministries.dart';
import 'package:app/pages/contact.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:app/services/FirebaseMessaging_service.dart';
import 'package:provider/provider.dart';
import 'package:app/providers/tab_provider.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:app/services/deep_linking_service.dart';
import 'package:app/services/fcm_token_service.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

Map<String, dynamic>? initialNotificationData;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  try {
    await dotenv.load(fileName: ".env");
  } catch (e) {
    // Environment file not found or invalid
  }

  // Initialize Firebase
  await Firebase.initializeApp();

  // Initialize DeepLinkingService with the navigator key
  DeepLinkingService.initialize(navigatorKey);

  // Setup messaging and notifications BEFORE checking for initial message
  setupFirebaseMessaging();
  await setupLocalNotifications();

  RemoteMessage? initialMessage = await FirebaseMessaging.instance.getInitialMessage();
  if (initialMessage != null) {
    initialNotificationData = initialMessage.data;
    // Store the initial message for handling after the app is built
    WidgetsBinding.instance.addPostFrameCallback((_) {
      DeepLinkingService.handleNotificationData(initialMessage.data);
    });
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (context) {
          final provider = TabProvider();
          TabProvider.instance = provider;
          // Load tab configuration asynchronously
          provider.loadTabConfiguration();
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
    final colorScheme = ColorScheme.fromSeed(seedColor: const Color.fromARGB(255, 22, 77, 60));
    return MaterialApp(
      title: 'ChurchLink',
      navigatorKey: navigatorKey, // Allows navigation from notifications
      theme: ThemeData(
        useMaterial3: false,
        colorScheme: colorScheme,
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Colors.black,
          elevation: 0,
          selectedItemColor: Colors.white,
          unselectedItemColor: Colors.white70,
          type: BottomNavigationBarType.fixed,
          showSelectedLabels: false,
          showUnselectedLabels: false,
        ),
      ),
      home: const MyHomePage(),
      routes: {
        '/home': (context) => const DashboardPage(),
        '/bible': (context) => const BiblePage(),
        '/sermons': (context) => const SermonsPage(),
        '/events': (context) => const EventsPage(),
        '/profile': (context) => const UserSettings(),
        '/live': (context) => const JoinLive(),
        '/bulletin': (context) => const WeeklyBulletin(),
        '/giving': (context) => const Giving(),
        '/ministries': (context) => const Ministries(),
        '/contact': (context) => const Contact(),
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
    
    // Register FCM token if user is already logged in
    if (isLoggedIn && user != null) {
      sendFcmTokenToBackend(user!.uid);
    }
    
    // Handle initial notification navigation here using deep linking service
    if (initialNotificationData != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        DeepLinkingService.handleNotificationData(initialNotificationData!);
      });
      initialNotificationData = null;
    }
  }

  List<Widget> get _screens {
    final tabProvider = context.read<TabProvider>();
    if (!tabProvider.isLoaded || tabProvider.tabs.isEmpty) {
      return [const DashboardPage()]; // Fallback
    }
    
    return tabProvider.tabs.map((tab) {
      final tabName = tab['name'] as String;
      return _getScreenForTab(tabName.toLowerCase());
    }).toList();
  }
  
  Widget _getScreenForTab(String tabName) {
    switch (tabName) {
      case 'home':
        return const DashboardPage();
      case 'bible':
        return const BiblePage();
      case 'sermons':
        return const SermonsPage();
      case 'events':
        return const EventsPage();
      case 'profile':
        return const UserSettings();
      case 'live':
        return const JoinLive();
      case 'bulletin':
        return const WeeklyBulletin();
      case 'giving':
        return const Giving();
      case 'ministries':
        return const Ministries();
      case 'contact':
        return const Contact();
      default:
        return const DashboardPage(); // Fallback
    }
  }

  @override
  Widget build(BuildContext context) {
    final tabProvider = Provider.of<TabProvider>(context);
    
    // Show loading indicator if tabs haven't loaded yet
    if (!tabProvider.isLoaded) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }
    
    return Scaffold(
      body: _screens[tabProvider.currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: tabProvider.currentIndex,
        onTap: (value) => tabProvider.setTab(value),
        showSelectedLabels: true,
        showUnselectedLabels: true,
        selectedFontSize: 11,
        unselectedFontSize: 9,
        selectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w500,
        ),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w400,
        ),
        items: _buildNavItems(tabProvider.tabs),
      ),
    );
  }

  List<BottomNavigationBarItem> _buildNavItems(List<Map<String, dynamic>> tabs) {
    return tabs.map((tab) {
      final name = tab['name'] as String;
      final displayName = tab['displayName'] as String? ?? name; // fallback to name if displayName is null
      final iconName = tab['icon'] as String? ?? name; // fallback to name if icon is null
      
      return BottomNavigationBarItem(
        label: displayName,
        icon: _getTabIcon(name, iconName, false),
        activeIcon: _getTabIcon(name, iconName, true),
      );
    }).toList();
  }

  Widget _getTabIcon(String tabName, String iconName, bool isActive) {
    // First try to use the specific iconName from the database
    switch (iconName.toLowerCase()) {
      case 'home':
        return Icon(
          Icons.home,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'menu_book':
      case 'bible':
        return Icon(
          Icons.menu_book,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'play_circle':
      case 'cross':
      case 'sermons':
        return Icon(
          Icons.church,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'event':
      case 'events':
        return Icon(
          Icons.event, 
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'person':
      case 'profile':
        return Icon(
          Icons.person,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'live_tv':
      case 'live':
        return Icon(
          Icons.live_tv,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'article':
      case 'bulletin':
        return Icon(
          Icons.article,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'volunteer_activism':
      case 'giving':
        return Icon(
          Icons.volunteer_activism,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'groups':
      case 'ministries':
        return Icon(
          Icons.groups,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'contact_mail':
      case 'contact':
        return Icon(
          Icons.contact_mail,
          color: isActive ? Colors.white : Colors.white70,
        );
      default:
        // Fallback to tab name if icon doesn't match
        return _getDefaultIconForTab(tabName, isActive);
    }
  }

  Widget _getDefaultIconForTab(String tabName, bool isActive) {
    switch (tabName.toLowerCase()) {
      case 'home':
        return Icon(
          Icons.home,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'bible':
        return Icon(
          Icons.menu_book,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'sermons':
        return Icon(Icons.church, color: isActive ? Colors.white : Colors.white70);
      case 'events':
        return Icon(Icons.event, color: isActive ? Colors.white : Colors.white70);
      case 'profile':
        return Icon(
          Icons.person,
          color: isActive ? Colors.white : Colors.white70,
        );
      case 'live':
        return Icon(Icons.live_tv, color: isActive ? Colors.white : Colors.white70);
      case 'bulletin':
        return Icon(Icons.article, color: isActive ? Colors.white : Colors.white70);
      case 'giving':
        return Icon(Icons.volunteer_activism, color: isActive ? Colors.white : Colors.white70);
      case 'ministries':
        return Icon(Icons.groups, color: isActive ? Colors.white : Colors.white70);
      case 'contact':
        return Icon(Icons.contact_mail, color: isActive ? Colors.white : Colors.white70);
      default:
        return Icon(Icons.tab, color: isActive ? Colors.white : Colors.white70);
    }
  }
}

