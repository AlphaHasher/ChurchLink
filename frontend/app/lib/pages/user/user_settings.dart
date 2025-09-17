import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../components/auth_popup.dart';
import '../../components/password_reset.dart';
import '../../firebase/firebase_auth_service.dart';
import 'edit_profile.dart';
import 'family_members_page.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class UserSettings extends StatefulWidget {
  const UserSettings({super.key});

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _UserSettingsState extends State<UserSettings> {
  final ScrollController _scrollController = ScrollController();
  final FirebaseAuthService authService = FirebaseAuthService();
  File? _profileImage;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();

    // Listen for auth state changes
    FirebaseAuth.instance.authStateChanges().listen((User? user) {
      setState(() {});
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
      );
    });

    // Listen for user changes
    FirebaseAuth.instance.userChanges().listen((User? user) {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? pickedImage = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80, //  Reduce size
    );

    if (pickedImage == null) return; // No image picked

    setState(() {
      _isUploading = true; //  Show loading animation
    });

    File file = File(pickedImage.path);
    User? user = FirebaseAuth.instance.currentUser;

    try {
      //  Step 1: Delete Old Image (if exists)
      if (user?.photoURL != null) {
        await _deleteOldImage(user!.photoURL!);
      }

      //  Step 2: Upload New Avatar to Cloudinary
      Uri uri = Uri.parse(
        "https://api.cloudinary.com/v1_1/${dotenv.env['CLOUDINARY_CLOUD_NAME']}/image/upload",
      );

      var request =
          http.MultipartRequest("POST", uri)
            ..fields['upload_preset'] =
                "user_avatars" //CLOUDINARY_UPLOAD_PRESET
            ..files.add(await http.MultipartFile.fromPath('file', file.path));

      var response = await request.send();
      var responseData = await response.stream.bytesToString();
      var jsonData = jsonDecode(responseData);

      String imageUrl = jsonData['secure_url']; //  Get uploaded image URL

      //  Step 3: Update Firebase User Profile
      await user?.updatePhotoURL(imageUrl);
      await user?.reload();

      setState(() {
        _profileImage = file; //  Update local UI
        _isUploading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(" Profile picture updated!")),
        );
      }
    } catch (e) {
      setState(() {
        _isUploading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(" Failed to update avatar: $e")));
      }
    }
  }

  ///  Deletes the old avatar from Cloudinary before uploading a new one
  Future<void> _deleteOldImage(String imageUrl) async {
    // Extract public ID from the Cloudinary URL
    Uri uri = Uri.parse(imageUrl);
    String fileName =
        uri.pathSegments.last.split('.').first; // Get Cloudinary public ID

    Uri deleteUri = Uri.parse(
      "https://api.cloudinary.com/v1_1/${dotenv.env['CLOUDINARY_CLOUD_NAME']}/image/destroy",
    );

    var response = await http.post(
      deleteUri,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "public_id": fileName,
        "api_key": dotenv.env['CLOUDINARY_API_KEY'],
      }),
    );

    if (response.statusCode == 200) {
      debugPrint(" Old avatar deleted successfully!");
    } else {
      debugPrint(" Failed to delete old avatar: ${response.body}");
    }
  }

  @override
  Widget build(BuildContext context) {
    List<Widget> pageWidgets = [];
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    bool loggedIn = authService.getCurrentUser() != null;
    User? user = authService.getCurrentUser();

    final List<Map<String, dynamic>> settingsCategories = [
      {
        'category': 'Account',
        'items': [
          {
            'icon': Icons.account_circle,
            'title': 'Edit Profile',
            'subtitle': 'Name, email, phone number',
            'ontap': () {
              if (user != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EditProfileScreen(user: user),
                  ),
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
            'icon': Icons.image,
            'title': 'Change Avatar',
            'subtitle': 'Update your profile picture',
            'ontap': _pickImage,
          },
          {
            'icon': Icons.password,
            'title': 'Change Password',
            'subtitle': 'Request an email to reset your password',
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
            'subtitle': 'Light or dark mode',
          },
          {
            'icon': Icons.language,
            'title': 'Language',
            'subtitle': 'Change app language',
          },
          {
            'icon': Icons.notifications,
            'title': 'Notifications',
            'subtitle': 'Customize alert preferences',
          },
        ],
      },
      {
        'category': 'Privacy',
        'items': [
          {
            'icon': Icons.visibility,
            'title': 'Account Visibility',
            'subtitle': 'Who can see your profile',
          },
          {
            'icon': Icons.delete,
            'title': 'Delete Account',
            'subtitle': 'Permanently remove your data',
          },
        ],
      },
      {
        'category': 'Support',
        'items': [
          {
            'icon': Icons.help,
            'title': 'Help Center',
            'subtitle': 'FAQ and support resources',
          },
          {
            'icon': Icons.feedback,
            'title': 'Send Feedback',
            'subtitle': 'Help us improve',
          },
          {
            'icon': Icons.policy,
            'title': 'Terms & Policies',
            'subtitle': 'Privacy policy and terms of use',
          },
        ],
      },
    ];

    // Profile card
    if (loggedIn) {
      pageWidgets.add(
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              Stack(
                alignment: Alignment.center,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: ssbcGray,
                    backgroundImage:
                        user?.photoURL != null && user!.photoURL!.isNotEmpty
                            ? NetworkImage(
                              user.photoURL!,
                            ) //  Load Firebase profile picture
                            : const AssetImage('assets/user/ssbc-dove.png')
                                as ImageProvider, // Default image
                  ),

                  //  Show a loading spinner when uploading an image
                  if (_isUploading)
                    Positioned.fill(
                      child: Container(
                        color: Colors.black.withValues(
                          alpha: 0.3,
                        ), // Darken background
                        child: const Center(
                          child: CircularProgressIndicator(color: Colors.white),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.displayName ?? "(Please set your display name)",
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (loggedIn)
                    Text(
                      user?.email ?? "(Please set your display email)",
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

    // Generate categories and items from list
    for (var category in settingsCategories) {
      // Either show account or guest based on login status
      if ((category['category'] == 'Account' ||
              category['category'] == 'Privacy') &&
          !loggedIn)
        continue;
      if (category['category'] == 'Guest' && loggedIn) continue;

      pageWidgets.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Text(
            category['category'],
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
      );

      for (var item in category['items']) {
        pageWidgets.add(
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: ListTile(
              leading: Icon(item['icon'], color: ssbcGray),
              title: Text(item['title']),
              subtitle: Text(item['subtitle']),
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
              onTap: item['ontap'],
            ),
          ),
        );
      }

      pageWidgets.add(const SizedBox(height: 8));
    }

    // Add logout button
    if (loggedIn) {
      pageWidgets.add(
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              authService.signOut();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ssbcGray,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('Logout', style: TextStyle(fontSize: 16)),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: ssbcGray,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          "User Settings",
          style: TextStyle(color: Colors.white),
        ),
        centerTitle: true,
      ),
      backgroundColor: const Color.fromARGB(255, 245, 245, 245),
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
