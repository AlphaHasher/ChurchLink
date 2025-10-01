import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'package:app/helpers/user_helper.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/widgets/user/profile_form.dart';

class EditProfileScreen extends StatefulWidget {
  final User user;

  final ProfileInfo? initialProfile;

  const EditProfileScreen({super.key, required this.user, this.initialProfile});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  bool _loading = true;

  String? _initialFirstName;
  String? _initialLastName;
  DateTime? _initialBirthday;
  String? _initialGender;

  @override
  void initState() {
    super.initState();
    _prefillFromIncomingOrFallback();
  }

  Future<void> _prefillFromIncomingOrFallback() async {
    ProfileInfo? p =
        widget.initialProfile ?? await UserHelper.readCachedProfile();
    p ??= await UserHelper.getMyProfile();

    if (p == null) {
      final first = '';
      final last = '';
      if (!mounted) return;
      setState(() {
        _initialFirstName = first;
        _initialLastName = last;
        _initialBirthday = null;
        _initialGender = null;
        _loading = false;
      });
      return;
    }

    final ProfileInfo profile = p;

    if (!mounted) return;
    setState(() {
      _initialFirstName = profile.firstName;
      _initialLastName = profile.lastName;
      _initialBirthday = profile.birthday;
      _initialGender =
          (profile.gender == 'M' || profile.gender == 'F')
              ? profile.gender
              : null;
      _loading = false;
    });
  }

  Future<void> _handleSave({
    required String firstName,
    required String lastName,
    DateTime? birthday,
    String? gender,
  }) async {
    final draft = ProfileInfo(
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: widget.user.email ?? '',
      birthday: birthday,
      gender: (gender == 'M' || gender == 'F') ? gender : null,
    );

    final result = await UserHelper.updateProfileInfo(draft);
    if (!mounted) return;

    if (result.success && result.profile != null) {
      Navigator.of(context).pop<ProfileInfo>(result.profile);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile updated')));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.msg.isNotEmpty ? result.msg : 'Failed to update profile.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Profile'),
        backgroundColor: ssbcGray,
      ),
      body:
          _loading
              ? const Center(child: CircularProgressIndicator())
              : SafeArea(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  child: UserProfileForm(
                    initialFirstName: _initialFirstName,
                    initialLastName: _initialLastName,
                    initialBirthday: _initialBirthday,
                    initialGender: _initialGender,
                    onSave: _handleSave,
                  ),
                ),
              ),
    );
  }
}
