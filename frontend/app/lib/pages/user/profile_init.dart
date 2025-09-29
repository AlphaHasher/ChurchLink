import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'package:app/widgets/user/profile_form.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/helpers/user_helper.dart';

class ProfileInitScreen extends StatefulWidget {
  final User user;
  const ProfileInitScreen({super.key, required this.user});

  @override
  State<ProfileInitScreen> createState() => _ProfileInitScreenState();
}

class _ProfileInitScreenState extends State<ProfileInitScreen> {
  bool _saving = false;

  // Parse first+last strictly from Firebase displayName for the very first init.
  (String first, String last) _splitFirebaseName() {
    final dn = (widget.user.displayName ?? '').trim();
    if (dn.isEmpty) return ('', '');
    final parts = dn.split(RegExp(r'\s+'));
    final first = parts.isNotEmpty ? parts.first : '';
    final last = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    return (first, last);
  }

  Future<void> _handleSave({
    required String firstName,
    required String lastName,
    DateTime? birthday,
    String? gender,
  }) async {
    setState(() => _saving = true);

    final draft = ProfileInfo(
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: widget.user.email ?? '',
      birthday: birthday,
      gender: (gender == 'M' || gender == 'F') ? gender : null,
    );

    final result = await UserHelper.updateProfileInfo(draft);

    await UserHelper.getIsInit();

    if (!mounted) return;
    setState(() => _saving = false);

    if (result.success) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile initialized!')));
      Navigator.of(context).pushNamedAndRemoveUntil('/', (_) => false);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.msg.isNotEmpty
                ? result.msg
                : 'Failed to initialize profile.',
          ),
        ),
      );
    }
  }

  Future<void> _logout() async {
    // Clear caches and sign out.
    await UserHelper.clearCachedProfile();
    await UserHelper.clearCachedStatus();
    await FirebaseAuth.instance.signOut();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final (first, last) = _splitFirebaseName();

    return Scaffold(
      appBar: AppBar(title: const Text('Initialize Profile')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'In order to use your account, please initialize your profile. '
                'Otherwise, you may log out.',
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 16),

              UserProfileForm(
                initialFirstName: first,
                initialLastName: last,
                initialBirthday: null,
                initialGender: null,
                onSave: _handleSave,
              ),

              const SizedBox(height: 12),

              TextButton(
                onPressed: _saving ? null : _logout,
                child: const Text('Log out'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
