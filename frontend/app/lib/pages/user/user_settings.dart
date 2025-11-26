import 'dart:async';

import 'package:app/helpers/logger.dart';
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
import 'package:app/pages/events/myevents.dart';
import 'package:app/theme/theme_controller.dart';
import 'package:app/pages/user/legal_terms.dart';

import 'package:app/widgets/change_email_sheet.dart';
import 'package:app/helpers/localized_widgets.dart';
import 'package:app/pages/my_transactions/my_transactions_page.dart';
import 'package:app/pages/refund_requests/view_refund_requests.dart';

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
    addLocaleListener(_onLocaleChanged);
  }

  @override
  void dispose() {
    removeLocaleListener(_onLocaleChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Terms & Policies').localized(),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Trust me bro',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ).localized(),
            const SizedBox(height: 8),
            Text('.'),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Close').localized(),
        ),
      ],
    );
  }
}

class _DeleteConfirmationDialog extends StatefulWidget {
  final String confirmedEmail;

  const _DeleteConfirmationDialog({required this.confirmedEmail});

  @override
  State<_DeleteConfirmationDialog> createState() =>
      _DeleteConfirmationDialogState();
}

class _DeleteConfirmationDialogState extends State<_DeleteConfirmationDialog> {
  late final TextEditingController _controller;
  bool _isValid = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Final Confirmation').localized(),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Type your email address to confirm account deletion:',
          ).localized(),
          const SizedBox(height: 8),
          Text(
            widget.confirmedEmail,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'Enter your email',
            ).localizedLabels(),
            onChanged: (value) {
              setState(() {
                _isValid =
                    value.trim().toLowerCase() ==
                    widget.confirmedEmail.trim().toLowerCase();
              });
            },
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text('Cancel').localized(),
        ),
        TextButton(
          onPressed: _isValid ? () => Navigator.of(context).pop(true) : null,
          style: TextButton.styleFrom(
            foregroundColor: Colors.red,
            disabledForegroundColor: Colors.grey,
          ),
          child: Text('Delete Account').localized(),
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

  @override
  void initState() {
    super.initState();

    _loadLanguageFromServer();
    addLocaleListener(_onLocaleChanged);
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
    removeLocaleListener(_onLocaleChanged);
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
                title: Text('Light').localized(),
                trailing:
                    current == ThemeMode.light ? const Icon(Icons.check) : null,
                onTap: () {
                  ThemeController.instance.setMode(ThemeMode.light);
                  Navigator.pop(context);
                  setState(() {});
                },
              ),
              ListTile(
                key: const Key('choose_theme_system'),
                leading: const Icon(Icons.brightness_auto),
                title: Text('System').localized(),
                trailing:
                    current == ThemeMode.system
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
                title: Text('Dark').localized(),
                trailing:
                    current == ThemeMode.dark ? const Icon(Icons.check) : null,
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

  void _showDeleteAccountWarning() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.warning, color: Colors.red),
              const SizedBox(width: 8),
              Text('Delete Account?').localized(),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'This action cannot be undone. You will permanently lose:',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ).localized(),
              const SizedBox(height: 12),
              _buildWarningItem('All your personal data'),
              _buildWarningItem('Your saved preferences'),
              _buildWarningItem('Access to this account'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Cancel').localized(),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                _showDeleteAccountConfirmation();
              },
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              child: Text('Continue').localized(),
            ),
          ],
        );
      },
    );
  }

  void _showDeleteAccountConfirmation() async {
    // Fetch user's email from cache or API
    String? userEmail;
    final cachedProfile = await UserHelper.readCachedProfile();
    if (cachedProfile != null) {
      userEmail = cachedProfile.email;
    } else {
      final profileData = await UserHelper.getMyProfile();
      userEmail = profileData?.profile?.email;
    }

    if (!mounted) return;

    if (userEmail == null || userEmail.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(
              'Unable to verify account information. Please try again.',
            ).localized(),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final String confirmedEmail = userEmail;

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext confirmContext) {
        return _DeleteConfirmationDialog(confirmedEmail: confirmedEmail);
      },
    );

    if (result == true && mounted) {
      await _performAccountDeletion();
    }
  }

  Widget _buildWarningItem(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          const Icon(Icons.close, size: 16, color: Colors.red),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text).localized(),
          ),
        ],
      ),
    );
  }

  Future<void> _performAccountDeletion() async {
    logger.i('_performAccountDeletion: Starting');

    try {
      logger.i('_performAccountDeletion: Calling UserHelper.deleteAccount()');

      final result = await UserHelper.deleteAccount().timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          logger.e('_performAccountDeletion: Timed out after 30 seconds');
          return const DeleteAccountResult(
            success: false,
            msg:
                'Request timed out. Please check your connection and try again.',
          );
        },
      );

      logger.i(
        '_performAccountDeletion: Got result - success: ${result.success}, msg: ${result.msg}',
      );

      if (!mounted) {
        logger.w('_performAccountDeletion: Widget not mounted, returning');
        return;
      }

      if (result.success) {
        logger.i('_performAccountDeletion: Success - showing success message');

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (result.msg.isNotEmpty
                      ? result.msg
                      : 'Account deleted successfully')
                  .toString(),
            ).localized(),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );

        // Small delay before navigation
        await Future.delayed(const Duration(milliseconds: 500));

        if (!mounted) return;

        logger.i('_performAccountDeletion: Navigating to success screen');

        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(
            builder:
                (context) => Scaffold(
                  body: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.check_circle,
                          color: Colors.green,
                          size: 80,
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'Account deleted successfully',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ).localized(),
                        const SizedBox(height: 16),
                        Text(
                          'You have been signed out',
                          style: const TextStyle(fontSize: 16),
                        ).localized(),
                        const SizedBox(height: 32),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(
                                builder: (context) => const UserSettings(),
                              ),
                              (route) => false,
                            );
                          },
                          child: Text('Return to Settings').localized(),
                        ),
                      ],
                    ),
                  ),
                ),
          ),
          (route) => false,
        );
      } else {
        logger.w('_performAccountDeletion: Failed - ${result.msg}');

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (result.msg.isNotEmpty
                      ? result.msg
                      : 'Failed to delete account. Please try again.')
                  .toString(),
            ).localized(),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e, stackTrace) {
      logger.e(
        '_performAccountDeletion: Exception caught',
        error: e,
        stackTrace: stackTrace,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('An unexpected error occurred: $e').localized(),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  // Show language selection bottom sheet
  void _showLanguageSheet() {
    final languages = availableLanguages;
    final currentCode = _selectedLanguage;
    String searchQuery = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder:
          (BuildContext context) => StatefulBuilder(
            builder: (context, setSheetState) {
              final filtered =
                  languages
                      .where(
                        (lang) =>
                            lang.name.toLowerCase().contains(
                              searchQuery.toLowerCase(),
                            ) ||
                            lang.code.toLowerCase().contains(
                              searchQuery.toLowerCase(),
                            ),
                      )
                      .toList();

              return SafeArea(
                child: AnimatedPadding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).viewInsets.bottom,
                  ),
                  duration: const Duration(milliseconds: 150),
                  curve: Curves.easeOut,
                  child: SizedBox(
                    height: MediaQuery.of(context).size.height * 0.85,
                    child: Column(
                      mainAxisSize: MainAxisSize.max,
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
                          'Select Language',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ).localized(),
                        const Divider(height: 24),
                        // Search field
                        Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: TextField(
                            onChanged: (value) {
                              searchQuery = value;
                              setSheetState(() {});
                            },
                            decoration:
                                InputDecoration(
                                  hintText: 'Search languages',
                                  prefixIcon: const Icon(Icons.search),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ).localizedLabels(),
                          ),
                        ),
                        // Current language
                        if (currentCode.isNotEmpty &&
                            languages.any((l) => l.code == currentCode))
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16.0,
                            ),
                            child: ListTile(
                              leading: const Icon(
                                Icons.language,
                                color: Colors.blue,
                              ),
                              title: Text(
                                languages
                                    .firstWhere((l) => l.code == currentCode)
                                    .name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              subtitle: Text('Current').localized(),
                              enabled: false,
                            ),
                          ),
                        const Divider(),
                        // List
                        if (languages.isEmpty)
                          Expanded(
                            child: Padding(
                              padding: EdgeInsets.all(32.0),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CircularProgressIndicator(),
                                  SizedBox(height: 16),
                                  Text('Loading languages...').localized(),
                                ],
                              ),
                            ),
                          )
                        else
                          Expanded(
                            child: ListView.builder(
                              keyboardDismissBehavior:
                                  ScrollViewKeyboardDismissBehavior.onDrag,
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
                                  trailing:
                                      isSelected
                                          ? const Icon(
                                            Icons.check,
                                            color: Colors.blue,
                                          )
                                          : null,
                                  onTap: () {
                                    Navigator.pop(context);
                                    _updateLanguage(lang.code);
                                  },
                                );
                              },
                            ),
                          ),
                        const SizedBox(height: 12),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
    );
  }

  // Update _updateLanguage
  Future<void> _updateLanguage(String newLang) async {
    try {
      await changeLocaleAndAwait(
        newLang,
        warmupKeys: const [
          'User Settings',
          'Theme',
          'System',
          'Language',
          'Notifications',
          'Terms & Policies',
          'Login or Signup',
          'To access more features login or signup',
          'Home',
          'Bible',
          'Sermons',
          'Events',
          'Profile',
          'No events found.',
          'Customize alert preferences',
          'Privacy policy and terms of use',
          'Account',
          'Guest',
          'Preferences',
          'Support',
          'Trust me bro',
          'Close',
          'Notification Preferences',
          'Choose which notifications you want to receive:',
        ],
      );
      if (mounted) {
        setState(() {
          _selectedLanguage = newLang;
        });
      }
    } catch (e) {
      logger.e('Failed to update language: $e');
    } finally {}
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
      lang = currentLocale;
    }
    if (mounted) {
      setState(() {
        _selectedLanguage = lang;
      });
    }
  }

  // Show Terms and Policies popup
  void _showTermsAndPolicies(BuildContext context) {
    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text('View Legal Documents').localized(),
            content: Text("Select which document you'd like to view:").localized(),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop(); // Close dialog
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const LegalPageScreen(slug: 'terms'),
                    ),
                  );
                },
                child: Text('Terms & Conditions').localized(),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const LegalPageScreen(slug: 'privacy'),
                    ),
                  );
                },
                child: Text('Privacy Policy').localized(),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const LegalPageScreen(slug: 'refunds'),
                    ),
                  );
                },
                child: Text('Refund Policy').localized(),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('Cancel').localized(),
              ),
            ],
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = authService.getCurrentUser();
    final bool loggedIn = user != null;

    final displayName =
        (() {
          final p = _profile;
          if (p != null) {
            final fn = p.firstName.trim();
            final ln = p.lastName.trim();
            final joined = [fn, ln].where((s) => s.isNotEmpty).join(' ').trim();
            if (joined.isNotEmpty) return joined;
          }
          return user?.displayName ?? "(Please set your display name)";
        })();

    final displayEmail =
        (() {
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
            'title': 'Edit Profile',
            'subtitle': 'First/Last name, birthday, gender',
            'ontap': () async {
              if (user == null) return;
              // Await result and update immediately if we get a ProfileInfo back
              final result = await Navigator.push<ProfileInfo>(
                context,
                MaterialPageRoute(
                  builder:
                      (context) => EditProfileScreen(
                        user: user,
                        initialProfile: _profile,
                      ),
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
            'title': 'Edit Contact Info',
            'subtitle': 'Phone and address',
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
            'title': 'View Membership Status',
            'subtitle': 'View your Church Membership Status',
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
            'title': 'Family Members',
            'subtitle': 'Manage your family members',
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
            'title': 'My Events',
            'subtitle': 'Your registrations and RSVPs',
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const MyEventsPage()),
              );
            },
          },
          {
            'icon': Icons.attach_money,
            'title': 'My Transactions',
            'subtitle': 'View and manage your payments',
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const MyTransactionsPage(),
                ),
              );
            },
          },
          {
            'icon': Icons.money_off_csred,
            'title': 'My Refund Requests',
            'subtitle': 'View and manage your refund requests',
            'ontap': () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const ViewRefundRequestsPage(),
                ),
              );
            },
          },
          {
            'icon': Icons.alternate_email,
            'title': 'Change Email',
            'subtitle': 'Request an email to change your address',
            'ontap': () => ChangeEmailSheet.show(context),
          },
          {
            'icon': Icons.password,
            'title': 'Change Password',
            'subtitle': 'Request an email to reset your password',
            'ontap': () {
              PasswordReset.show(context, user?.email);
            },
          },
          {
            'icon': Icons.no_accounts,
            'title': 'Manage Account Status',
            'subtitle': 'Delete Account',
            'ontap': () {
              _showDeleteAccountWarning();
            },
          },
        ],
      },
      {
        'category': 'Guest',
        'items': [
          {
            'icon': Icons.account_circle,
            'title': 'Login or Signup',
            'subtitle': 'To access more features login or signup',
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
            'title': 'Theme',
            'subtitle': themeLabel,
            'ontap': _showThemeSheet,
            'key': const ValueKey('settings_theme_tile'),
          },
          {
            'icon': Icons.language,
            'title': 'Language',
            'subtitle': () {
              final selectedLang = availableLanguages.firstWhere(
                (l) => l.code == _selectedLanguage,
                orElse: () => const LanguageOption(code: 'en', name: 'English'),
              );
              return selectedLang.name;
            }(),
            'ontap': _showLanguageSheet,
          },
          {
            'icon': Icons.notifications,
            'title': 'Notifications',
            'subtitle': 'Customize alert preferences',
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
            'title': 'Terms & Policies',
            'subtitle': 'Privacy policy and terms of use',
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
                backgroundImage:
                    (user.photoURL != null && user.photoURL!.isNotEmpty
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
          child:
              Text(
                catName,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ).localized(),
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
                title: Text(item['title'] as String).localized(),
                subtitle: Text(item['subtitle'] as String).localized(),
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
            child:
                Text(
                  'Logout',
                  style: const TextStyle(fontSize: 16),
                ).localized(),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('User Settings').localized(),
        centerTitle: true,
      ),
      backgroundColor:
          theme.brightness == Brightness.dark
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
