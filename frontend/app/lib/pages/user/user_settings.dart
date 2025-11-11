import 'dart:async';

import 'package:app/helpers/user_helper.dart';
import 'package:app/firebase/firebase_auth_service.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/pages/user/edit_contact_info.dart';
import 'package:app/pages/user/edit_profile.dart';
import 'package:app/pages/user/family_members_page.dart';
import 'package:app/pages/user/membership_screen.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'package:app/components/auth_popup.dart';
import 'package:app/components/password_reset.dart';
import 'package:app/pages/user/notification_settings_page.dart';
import 'package:app/pages/my_events_page.dart';
import 'package:app/theme/theme_controller.dart';

 

import 'package:app/widgets/change_email_sheet.dart';
import 'package:app/helpers/localization_helper.dart';

class UserSettings extends StatefulWidget {
  const UserSettings({super.key});

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _TermsDialog extends StatefulWidget {
  const _TermsDialog();
  @override
  State<_TermsDialog> createState() => _TermsDialogState();
}

class _TermsDialogState extends State<_TermsDialog> {
  void _onLocaleChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    LocalizationHelper.addListener(_onLocaleChanged);
  }

  @override
  void dispose() {
    LocalizationHelper.removeListener(_onLocaleChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(LocalizationHelper.localize('Terms & Policies')),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              LocalizationHelper.localize('Trust me bro'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text('.'),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(LocalizationHelper.localize('Close')),
        ),
      ],
    );
  }
}

class _UserSettingsState extends State<UserSettings> {
  final ScrollController _scrollController = ScrollController();
  final FirebaseAuthService authService = FirebaseAuthService();

  StreamSubscription<User?>? _authSub;
  StreamSubscription<User?>? _userSub;

  ProfileInfo? _profile; // backend truth (cached/online)
  String _selectedLanguage = 'en'; // Language preference
  bool _loading = true;

  @override
  void initState() {
    super.initState();

    _loadLanguageFromServer();
    LocalizationHelper.addListener(_onLocaleChanged);
    _authSub = FirebaseAuth.instance.authStateChanges().listen((_) async {
      if (!mounted) return;
      await _loadProfile();
      if (!mounted) return;
      setState(() {});
      if (_scrollController.hasClients) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_scrollController.hasClients) return;
          _scrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 100),
            curve: Curves.easeOut,
          );
        });
      }
    });

    _userSub = FirebaseAuth.instance.userChanges().listen((_) async {
      if (!mounted) return;
      await _loadProfile();
      if (!mounted) return;
      setState(() {});
    });

    _loadProfile();
  }

 

  @override
  void dispose() {
    LocalizationHelper.removeListener(_onLocaleChanged);
    _authSub?.cancel();
    _userSub?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      if (!mounted) return;
      setState(() {
        _profile = null;
      });
      return;
    }

    final ok = await _tryFetchOnlineProfile();
    if (!ok) {
      final cachedProfile = await UserHelper.readCachedProfile();
      if (!mounted) return;
      setState(() {
        _profile =
            cachedProfile ??
            ProfileInfo(
              firstName: (user.displayName ?? '').split(' ').firstOrNull ?? '',
              lastName: (user.displayName ?? '').split(' ').skip(1).join(' '),
              email: user.email ?? '',
              membership: false,
              birthday: null,
              gender: null,
            );
      });
    }
  }

  Future<bool> _tryFetchOnlineProfile() async {
    try {
      final data = await UserHelper.getMyProfile();
      if (data == null) return false;
      if (!mounted) return true;
      setState(() {
        _profile = data.profile;
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  // Show the theme selection bottom sheet
  void _showThemeSheet() {
    final current = ThemeController.instance.mode;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                key: const Key('choose_theme_light'),
                leading: const Icon(Icons.wb_sunny_outlined),
                title: Text(LocalizationHelper.localize('Light', capitalize: true)),
                trailing: current == ThemeMode.light
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.light);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
              ListTile(
                key: const Key('choose_theme_system'),
                leading: const Icon(Icons.brightness_auto),
                title: Text(LocalizationHelper.localize('System', capitalize: true)),
                trailing: current == ThemeMode.system
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.system);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
              ListTile(
                key: const Key('choose_theme_dark'),
                leading: const Icon(Icons.nights_stay_outlined),
                title: Text(LocalizationHelper.localize('Dark', capitalize: true)),
                trailing: current == ThemeMode.dark
                    ? const Icon(Icons.check)
                    : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.dark);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
            ],
          ),
        );
      },
    );
  }

  // Show language selection bottom sheet
  void _showLanguageSheet() {
    final languages = LocalizationHelper.availableLanguages;
    final currentCode = _selectedLanguage;
    String searchQuery = '';

    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (BuildContext context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final filtered = languages.where((lang) =>
            lang.name.toLowerCase().contains(searchQuery.toLowerCase()) ||
            lang.code.toLowerCase().contains(searchQuery.toLowerCase())
          ).toList();

          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 50,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.grey[400],
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  LocalizationHelper.localize("Select Language"),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                const Divider(height: 24),
                // Search field
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: TextField(
                    onChanged: (value) {
                      searchQuery = value;
                      setSheetState(() {});
                    },
                    decoration: InputDecoration(
                      hintText: LocalizationHelper.localize("Search languages"),
                      prefixIcon: const Icon(Icons.search),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                // Current language
                if (currentCode.isNotEmpty && languages.any((l) => l.code == currentCode))
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: ListTile(
                      leading: const Icon(Icons.language, color: Colors.blue),
                      title: Text(
                        languages.firstWhere((l) => l.code == currentCode).name,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(LocalizationHelper.localize("Current")),
                      enabled: false,
                    ),
                  ),
                const Divider(),
                // List
                if (languages.isEmpty)
                   Padding(
                    padding: EdgeInsets.all(32.0),
                    child: Column(
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 16),
                        Text(LocalizationHelper.localize('Loading languages...', capitalize: true)),
                      ],
                    ),
                  )
                else ...[
                  Expanded(
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final lang = filtered[index];
                        final isSelected = lang.code == currentCode;
                        return ListTile(
                          leading: Icon(
                            Icons.language,
                            color: isSelected ? Colors.blue : null,
                          ),
                          title: Text(lang.name),
                          trailing: isSelected ? const Icon(Icons.check, color: Colors.blue) : null,
                          onTap: () {
                            Navigator.pop(context);
                            _updateLanguage(lang.code);
                          },
                        );
                      },
                    ),
                  ),
                ],
                const SizedBox(height: 12),
              ],
            ),
          );
        },
      ),
    );
  }

  // Update _updateLanguage
  Future<void> _updateLanguage(String newLang) async {
    setState(() => _loading = true);

    try {
      await LocalizationHelper.changeLocaleAndAwait(
        newLang,
        warmupKeys: const [
          'User Settings', 'Theme', 'System', 'Language', 'Notifications', 'Terms & Policies',
          'Login or Signup', 'To access more features login or signup',
          'Home', 'Bible', 'Sermons', 'Events', 'Profile',
          'No events found.',
          'Customize alert preferences',
          'Privacy policy and terms of use',
          'Account', 'Guest', 'Preferences', 'Support',
          'Trust me bro', 'Close',
        ],
      );
      if (mounted) {
        setState(() {
          _selectedLanguage = newLang;
        });
      }
    } catch (e) {
      print('Failed to update language: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onLocaleChanged() {
    if (!mounted) return;
    setState(() {});
  }

  // Update _loadLanguageFromServer
  Future<void> _loadLanguageFromServer() async {
    String lang = await UserHelper.fetchUserLanguage();
    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) {
      lang = LocalizationHelper.currentLocale;
    }
    if (mounted) {
      setState(() {
        _selectedLanguage = lang;
        _loading = false;
      });
    }
  }

  // Show Terms and Policies popup
  void _showTermsAndPolicies(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => const _TermsDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = authService.getCurrentUser();
    final bool loggedIn = user != null;

    final displayName = (() {
      final p = _profile;
      if (p != null) {
        final fn = p.firstName.trim();
        final ln = p.lastName.trim();
        final joined = [fn, ln].where((s) => s.isNotEmpty).join(' ').trim();
        if (joined.isNotEmpty) return joined;
      }
      return user?.displayName ?? "(Please set your display name)";
    })();

    final displayEmail = (() {
      final email = _profile?.email;
      if (email != null && email.trim().isNotEmpty) return email.trim();
      return user?.email ?? "(Please set your display email)";
    })();

    final mode = ThemeController.instance.mode;
    final themeLabel = switch (mode) {
      ThemeMode.light => 'Light',
      ThemeMode.dark => 'Dark',
      ThemeMode.system => 'System',
    };

    final List<Map<String, dynamic>> settingsCategories = [
      {
        'category': 'Account',
        'items': [
          {
            'icon': Icons.account_circle,
            'title': LocalizationHelper.localize('Edit Profile'),
            'subtitle': LocalizationHelper.localize('First/Last name, birthday, gender'),
            'ontap': () async {
              if (user == null) return;
              // Await result and update immediately if we get a ProfileInfo back
              final result = await Navigator.push<ProfileInfo>(
                context,
                MaterialPageRoute(
                  builder: (context) =>
                      EditProfileScreen(user: user, initialProfile: _profile),
                ),
              );
              if (!mounted) return;
              if (result != null) {
                setState(() => _profile = result);
              }
            },
          },
          {
            'icon': Icons.contact_page,
            'title': LocalizationHelper.localize('Edit Contact Info'),
            'subtitle': LocalizationHelper.localize('Phone and address'),
            'ontap': () {
              if (user != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EditContactInfoScreen(user: user),
                  ),
                );
              }
            },
          },
          {
            'icon': Icons.card_membership,
            'title': LocalizationHelper.localize('View Membership Status'),
            'subtitle': LocalizationHelper.localize('View your Church Membership Status'),
            'ontap': () {
              if (user != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => MembershipScreen()),
                );
              }
            },
          },
          {
            'icon': Icons.family_restroom,
            'title': LocalizationHelper.localize('Family Members'),
            'subtitle': LocalizationHelper.localize('Manage your family members'),
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const FamilyMembersPage(),
                ),
              );
            },
          },
          {
            'icon': Icons.event,
            'title': LocalizationHelper.localize('My Events'),
            'subtitle': LocalizationHelper.localize('Your registrations and RSVPs'),
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const MyEventsPage()),
              );
            },
          },
          {
            'icon': Icons.alternate_email,
            'title': LocalizationHelper.localize('Change Email'),
            'subtitle': LocalizationHelper.localize('Request an email to change your address'),
            'ontap': () => ChangeEmailSheet.show(context),
          },
          {
            'icon': Icons.password,
            'title': LocalizationHelper.localize('Change Password'),
            'subtitle': LocalizationHelper.localize('Request an email to reset your password'),
            'ontap': () {
              PasswordReset.show(context, user?.email);
            },
          },
        ],
      },
      {
        'category': 'Guest',
        'items': [
          {
            'icon': Icons.account_circle,
            'title': LocalizationHelper.localize('Login or Signup'),
            'subtitle': LocalizationHelper.localize('To access more features login or signup'),
            'ontap': () {
              AuthPopup.show(context);
            },
          },
        ],
      },
      {
        'category': 'Preferences',
        'items': [
          {
            'icon': Icons.dark_mode,
            'title': LocalizationHelper.localize('Theme'),
            'subtitle': themeLabel,
            'ontap': _showThemeSheet,
            'key': const ValueKey('settings_theme_tile'),
          },
          {
            'icon': Icons.language,
            'title': LocalizationHelper.localize('Language'),
            'subtitle': () {
              final selectedLang = LocalizationHelper.availableLanguages.firstWhere(
                (l) => l.code == _selectedLanguage,
                orElse: () => const LanguageOption(code: 'en', name: 'English'),
              );
              return selectedLang.name;
            }(),
            'ontap': _showLanguageSheet,
          },
          {
            'icon': Icons.notifications,
            'title': LocalizationHelper.localize('Notifications'),
            'subtitle': LocalizationHelper.localize('Customize alert preferences'),
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const NotificationSettingsPage(),
                ),
              );
            },
          },
        ],
      },
      {
        'category': 'Support',
        'items': [
          {
            'icon': Icons.policy,
            'title': LocalizationHelper.localize('Terms & Policies'),
            'subtitle': LocalizationHelper.localize('Privacy policy and terms of use'),
            'ontap': () => _showTermsAndPolicies(context),
          },
        ],
      },
    ];

    final List<Widget> pageWidgets = [];

    if (loggedIn) {
      pageWidgets.add(
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: theme.colorScheme.primary,
                backgroundImage: (user.photoURL != null && user.photoURL!.isNotEmpty
                    ? NetworkImage(user.photoURL!)
                    : const AssetImage('assets/user/ssbc-dove.png')
                        as ImageProvider),
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    displayEmail,
                    style: const TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    pageWidgets.add(const SizedBox(height: 16));

    for (final category in settingsCategories) {
      final catName = category['category'] as String;
      if (catName == 'Account' && !loggedIn) {
        continue;
      }
      if (catName == 'Guest' && loggedIn) continue;

      pageWidgets.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Text(
            LocalizationHelper.localize(catName),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
      );

      for (final item in (category['items'] as List<dynamic>)) {
        pageWidgets.add(
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                color: theme.colorScheme.primary.withAlpha(20),
                width: 3,
              ),
            ),
            shadowColor: Colors.black.withAlpha(10),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(20),
                    blurRadius: 8,
                    spreadRadius: 0,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ListTile(
                key: item['key'] as Key?,
                leading: Icon(
                  item['icon'] as IconData,
                  color: theme.colorScheme.primary,
                ),
                title: Text(item['title'] as String),
                subtitle: Text(item['subtitle'] as String),
                trailing:
                    item['trailing'] as Widget? ??
                    const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: item['ontap'] as void Function()?,
              ),
            ),
          ),
        );
      }

      pageWidgets.add(const SizedBox(height: 8));
    }

    if (loggedIn) {
      pageWidgets.add(
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(20),
                blurRadius: 8,
                spreadRadius: 0,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: () async {
              authService.signOut();
              await UserHelper.clearCachedStatus();
              await UserHelper.clearCachedProfile();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: theme.colorScheme.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 12),
              elevation: 0,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: theme.colorScheme.primary.withAlpha(30),
                  width: 4,
                ),
              ),
            ),
            child: Text(LocalizationHelper.localize('Logout'), style: const TextStyle(fontSize: 16)),
          ),
        ),
      );
    }

    return Scaffold(
      key: ValueKey('settings-' + LocalizationHelper.currentLocale + '-' + LocalizationHelper.uiVersion.toString()),
      appBar: AppBar(title: Text(LocalizationHelper.localize("User Settings")), centerTitle: true),
      backgroundColor: theme.brightness == Brightness.dark
          ? theme.colorScheme.surface
          : theme.colorScheme.surfaceContainerLow,
      body: SafeArea(
        child: ListView(
          controller: _scrollController,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
          children: pageWidgets,
        ),
      ),
    );
  }
}

