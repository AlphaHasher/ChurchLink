import 'package:app/pages/bible.dart';
import 'package:app/pages/dashboard.dart';
import 'package:app/pages/sermons.dart';
import 'package:app/pages/bulletins.dart';
import 'package:app/pages/eventspage.dart';
import 'package:app/pages/user/user_settings.dart';
import 'package:app/pages/joinlive.dart';
import 'package:app/pages/weeklybulletin.dart';
import 'package:app/pages/giving.dart';
import 'package:app/services/connectivity_service.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:app/services/FirebaseMessaging_service.dart';
import 'package:provider/provider.dart';
import 'package:app/providers/sermons_provider.dart';
import 'package:app/providers/bulletins_provider.dart';
import 'package:app/providers/tab_provider.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:app/services/deep_linking_service.dart';
import 'package:app/services/fcm_token_service.dart';
import 'package:app/gates/auth_gate.dart';
import 'package:app/theme/app_theme.dart';
import 'package:app/theme/theme_controller.dart';


final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
const bool kTestMode = bool.fromEnvironment('TEST_MODE', defaultValue: false);

Map<String, dynamic>? initialNotificationData;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  if (!kTestMode) {
    try {
      await dotenv.load(fileName: ".env");
    } catch (e) {
    // Environment file not found or invalid
    }
  }

  // Initialize Firebase
  await Firebase.initializeApp();

  final authService = FirebaseAuthService();
  try {
    await authService.initializeGoogleSignIn();
    debugPrint('✅ GoogleSignIn initialized successfully');
  } catch (e) {
    debugPrint('⚠️  GoogleSignIn initialization warning: $e');
  }

  // Load saved theme mode BEFORE runApp
  await ThemeController.instance.load();

  // Initialize DeepLinkingService with the navigator key
  DeepLinkingService.initialize(navigatorKey);

  // Setup messaging and notifications BEFORE checking for initial message

  if (!kTestMode) {
    setupFirebaseMessaging();
    await setupLocalNotifications();

    // Startup connectivity service
    ConnectivityService().start();

    RemoteMessage? initialMessage =
        await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      initialNotificationData = initialMessage.data;
      // Store the initial message for handling after the app is built
      WidgetsBinding.instance.addPostFrameCallback((_) {
        DeepLinkingService.handleNotificationData(initialMessage.data);
      });
    }
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (context) {
            final provider = TabProvider();
            TabProvider.instance = provider;
            if (kTestMode) {
              // Provide a fixed, fast-loading tab set for tests
              provider.setTabsForTest(const [
                {'name': 'home', 'displayName': 'Home', 'icon': 'home'},
                {'name': 'bible', 'displayName': 'Bible', 'icon': 'menu_book'},
                {'name': 'sermons', 'displayName': 'Sermons', 'icon': 'sermons'},
                {'name': 'events', 'displayName': 'Events', 'icon': 'event'},
                {'name': 'profile', 'displayName': 'Profile', 'icon': 'person'},
              ]);
              } else {
                provider.loadTabConfiguration();
              }
            return provider;
          },
        ),
        ChangeNotifierProvider(create: (_) => SermonsProvider()),
        ChangeNotifierProvider(create: (_) => BulletinsProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final c = ThemeController.instance;

    return AnimatedBuilder(
      animation: c,
      builder: (_, _) {
        return MaterialApp(
          title: 'ChurchLink',
          navigatorKey: navigatorKey,
          theme: AppTheme.light, // Colors are defined in app_theme.dart
          darkTheme: AppTheme.dark,
          themeMode: c.mode,

          home: kTestMode ? const MyHomePage() : AuthGate(child: const MyHomePage()),
          routes: {
            '/home': (context) => const DashboardPage(),
            '/bible': (context) => const BiblePage(),
            '/sermons': (context) => const SermonsPage(),
            '/events': (context) => const EventsPage(),
            '/profile': (context) => const UserSettings(),
            '/live': (context) => const JoinLive(),
            '/bulletin': (context) => const WeeklyBulletin(),
            '/giving': (context) => const Giving(),
          },
        );
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

    // Register FCM token for every device (no consent logic)
    FCMTokenService.registerDeviceToken(consent: {}, userId: user?.uid);

    // Handle initial notification navigation here using deep linking service
    if (initialNotificationData != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        DeepLinkingService.handleNotificationData(initialNotificationData!);
      });
      initialNotificationData = null;
    }
  }

  final Map<String, GlobalKey<NavigatorState>> _navKeyForTab = {};

  Widget _buildTabNavigator({
    required GlobalKey<NavigatorState> navKey,
    required Widget root,
    required bool isActive,
  }) {
    return TickerMode(
      enabled: isActive,
      child: Offstage(
        offstage: !isActive,
        child: Navigator(
          key: navKey,
          onGenerateRoute: (settings) => MaterialPageRoute(
            builder: (_) => root,
            settings: const RouteSettings(name: 'root'),
            maintainState: true,
          ),
        ),
      ),
    );
  }

  Widget _getScreenForTab(String tabName) {
    switch (tabName) {
      case 'home':
        return const DashboardPage();
      case 'bible':
        return const BiblePage();
      case 'sermons':
        return const SermonsPage();
      case 'bulletins':
        return const BulletinsPage();
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
      default:
        return const DashboardPage(); // Fallback
    }
  }

  @override
  Widget build(BuildContext context) {
    final tabProvider = Provider.of<TabProvider>(context);

    // Show loading indicator if tabs haven't loaded yet
    if (!tabProvider.isLoaded) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final tabs = tabProvider.tabs;
    final List<Widget> tabRoots = tabs
        .map((t) => _getScreenForTab((t['name'] as String).toLowerCase()))
        .toList();
    final List<GlobalKey<NavigatorState>> navKeys = tabs.map((t) {
      final name = (t['name'] as String).toLowerCase();
      return _navKeyForTab.putIfAbsent(name, () => GlobalKey<NavigatorState>());
    }).toList();

    final theme = Theme.of(context);

    return PopScope(
      canPop: false, // Stop the app from exiting when pressing the back button
      onPopInvokedWithResult: (didPop, result) {
        // If the pop is handled elsewhere, do nothing
        if (didPop) return;

        // Restrict popping behavior to within the current tab
        final idx = tabProvider.currentIndex;
        final nav = navKeys[idx].currentState;

        // Pop only if possible
        if (nav != null && nav.canPop()) {
          nav.pop();
        }
        else {
          // Do nothing, no more pages to pop
        }
      },
      child: Scaffold(
        body: IndexedStack(
          index: tabProvider.currentIndex,
          children: List.generate(
            tabRoots.length,
            (i) => _buildTabNavigator(
              navKey: navKeys[i],
              root: tabRoots[i],
              isActive: tabProvider.currentIndex == i,
            ),
          ),
        ),
        bottomNavigationBar: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          currentIndex: tabProvider.currentIndex,
          onTap: (value) {
            // If selecting the current tab, pop to the base page
            if (value == tabProvider.currentIndex) {
              final name = (tabs[value]['name'] as String).toLowerCase();
              final key = _navKeyForTab[name];
              key?.currentState?.popUntil((route) => route.isFirst);
            } else {
              // Switch tabs and pop to the base of the new tab
              final targetName = (tabs[value]['name'] as String).toLowerCase();
              final targetKey = _navKeyForTab[targetName];
              targetKey?.currentState?.popUntil((route) => route.isFirst);
              tabProvider.setTab(value);
            }
          },
          showSelectedLabels: true,
          showUnselectedLabels: true,
          selectedFontSize: 11,
          unselectedFontSize: 9,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w400),
          // Use Theme Colors
          backgroundColor: theme.colorScheme.surface,
          selectedItemColor: theme.colorScheme.primary,
          unselectedItemColor: theme.colorScheme.onSurfaceVariant,
          items: _buildNavItems(tabs),
        ),
      ),
    );
  }

  List<BottomNavigationBarItem> _buildNavItems(
    List<Map<String, dynamic>> tabs,
  ) {
    return tabs.asMap().entries.map((entry) {
      final tab = entry.value;
      final name = (tab['name'] as String).toLowerCase();
      final displayName = (tab['displayName'] as String?) ?? name;
      final iconName = (tab['icon'] as String?) ?? name;

      return BottomNavigationBarItem(
        label: displayName,
        icon: Semantics(
          label: 'tab-$name',
          child: _getTabIcon(name, iconName, false),
        ),
        activeIcon: Semantics(
          label: 'tab-$name-active',
          child: _getTabIcon(name, iconName, true),
        ),
        // Add a value key to help locate by index too
        tooltip: 'tab-$name', // optional
      );
    }).toList();
 }

  Widget _getTabIcon(String tabName, String iconName, bool isActive) {
    // First try to use the specific iconName from the database
    switch (iconName.toLowerCase()) {
      case 'home':
        return Icon(
          Icons.home,
        );
      case 'menu_book':
      case 'bible':
        return Icon(
          Icons.menu_book,
        );
      case 'play_circle':
      case 'cross':
      case 'sermons':
        return Icon(
          Icons.church,
        );
      case 'description':
      case 'bulletins':
        return Icon(Icons.description);
      case 'event':
      case 'events':
        return Icon(
          Icons.event,
        );
      case 'person':
      case 'profile':
        return Icon(
          Icons.person,
        );
      case 'live_tv':
      case 'live':
        return Icon(
          Icons.live_tv,
        );
      case 'article':
      case 'bulletin':
        return Icon(
          Icons.article,
        );
      case 'volunteer_activism':
      case 'giving':
        return Icon(
          Icons.volunteer_activism,
        );
      case 'groups':
        return Icon(
          Icons.groups,
        );
      case 'contact_mail':
      case 'contact':
        return Icon(
          Icons.contact_mail,
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
        );
      case 'bible':
        return Icon(
          Icons.menu_book,
        );
      case 'sermons':
        return Icon(
          Icons.church,
        );
      case 'bulletins':
        return Icon(Icons.description);
      case 'events':
        return Icon(
          Icons.event,
        );
      case 'profile':
        return Icon(
          Icons.person,
        );
      case 'live':
        return Icon(
          Icons.live_tv,
        );
      case 'bulletin':
        return Icon(
          Icons.article,
        );
      case 'giving':
        return Icon(
          Icons.volunteer_activism,
        );
      case 'contact':
        return Icon(
          Icons.contact_mail,
        );
      default:
        return Icon(Icons.tab);
    }
  }
}
