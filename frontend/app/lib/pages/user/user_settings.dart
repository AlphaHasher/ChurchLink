import 'package:app/pages/user/edit_profile.dart';
import 'package:app/pages/user/guest_settings.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../../firebase/firebase_auth_service.dart';

//avatar
import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:image_picker/image_picker.dart';

class UserSettings extends StatefulWidget {
  const UserSettings({super.key});

  @override
  State<UserSettings> createState() => _UserSettingsState();
}

class _UserSettingsState extends State<UserSettings> {
  final FirebaseAuthService _authService = FirebaseAuthService();
  User? _user;
  bool _isUploading = false; 

  @override
  void initState() {
    super.initState();
    _fetchUser();
  }

  void _fetchUser() async {
    User? currentUser = FirebaseAuth.instance.currentUser;
    setState(() {
      _user = currentUser;
    });
  }

  // -------------------------------------------------------------
// 🔹 Avatar Management Section
// This section handles:
// ✅ Fetching the current user
// ✅ Uploading a new avatar to Cloudinary - NEED CLOUDINARY ACCOUNT - API - AND CREATE 'UPLOAD PRESENT'
// ✅ Deleting the old avatar before uploading a new one
// ✅ Updating the user's avatar in Firebase Authentication
// ✅ Displaying a loading indicator while uploading
// -------------------------------------------------------------

  Future<void> _deleteOldImage(String imageUrl) async {
    // Extract public ID from Cloudinary URL
    Uri uri = Uri.parse(imageUrl);
    String fileName = uri.pathSegments.last.split('.').first; // Extract public ID

    // 🔹 Cloudinary API delete request
    Uri deleteUri = Uri.parse("https://api.cloudinary.com/v1_1/dh2msfer1/image/destroy");

    var response = await http.post(
      deleteUri,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "public_id": fileName,
        "api_key": "582998399417464",
      }),
    );

    if (response.statusCode == 200) {
      print("Old avatar deleted successfully!");
    } else {
      print("Failed to delete old avatar: ${response.body}");
    }
  }

  Future<void> _changeAvatar() async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);

    if (image == null) return;

    setState(() {
      _isUploading = true; // Show loading indicator
    });

    User? user = FirebaseAuth.instance.currentUser;

    //  Delete Old Avatar if Exists
    if (user?.photoURL != null) {
      await _deleteOldImage(user!.photoURL!);
    }

    File file = File(image.path);
    Uri uri = Uri.parse("https://api.cloudinary.com/v1_1/dh2msfer1/image/upload");

    var request = http.MultipartRequest("POST", uri)
      ..fields['upload_preset'] = "user_avatars"
      ..files.add(await http.MultipartFile.fromPath('file', file.path));

    var response = await request.send();
    var responseData = await response.stream.bytesToString();
    var jsonData = jsonDecode(responseData);

    String imageUrl = jsonData['secure_url']; // Get new image URL

    //  Save the New Image URL to Firebase Authentication
    await user?.updatePhotoURL(imageUrl);
    await user?.reload(); // Refresh user data

    setState(() {
      _isUploading = false; // Hide loading indicator
      _user = FirebaseAuth.instance.currentUser; // Refresh user state
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("Profile picture updated!")),
    );
  }

// -------------------------------------------------------------
// 🔹 END Avatar Management Section
// -------------------------------------------------------------


  
  final List<Map<String, dynamic>> _settingsCategories = [
    {
      'category': 'Account',
      'items': [
        {'icon': Icons.account_circle, 'title': 'Edit Profile', 'subtitle': 'Name, email, phone number'},
        {'icon': Icons.image, 'title': 'Change Avatar', 'subtitle': 'Update your profile picture'},
        {'icon': Icons.password, 'title': 'Change Password', 'subtitle': 'Update your password'},
      ]
    },
    {
      'category': 'Preferences',
      'items': [
        {'icon': Icons.dark_mode, 'title': 'Theme', 'subtitle': 'Light or dark mode'},
        {'icon': Icons.language, 'title': 'Language', 'subtitle': 'Change app language'},
        {'icon': Icons.notifications, 'title': 'Notifications', 'subtitle': 'Customize alert preferences'},
      ]
    },
    {
      'category': 'Privacy',
      'items': [
        {'icon': Icons.visibility, 'title': 'Account Visibility', 'subtitle': 'Who can see your profile'},
        {'icon': Icons.delete, 'title': 'Delete Account', 'subtitle': 'Permanently remove your data'},
      ]
    },
    {
      'category': 'Support',
      'items': [
        {'icon': Icons.help, 'title': 'Help Center', 'subtitle': 'FAQ and support resources'},
        {'icon': Icons.feedback, 'title': 'Send Feedback', 'subtitle': 'Help us improve'},
        {'icon': Icons.policy, 'title': 'Terms & Policies', 'subtitle': 'Privacy policy and terms of use'},
      ]
    },
    {
      'category': 'LogOut',
      'items': [
        {'icon': Icons.account_circle, 'title': 'Log Out'}
      ]
    },
  ];

  @override
  Widget build(BuildContext context) {
    List<Widget> pageWidgets = [];
    const Color SSBC_GRAY = Color.fromARGB(255, 142, 163, 168);

    // Profile card
    pageWidgets.add(
      Container(
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            // -------------------------------------------------------------
            // 🔹 UI Components for Avatar
            // This part ensures:
            // ✅ The avatar is displayed correctly
            // ✅ A loading animation is shown during uploads
            // -------------------------------------------------------------

            Stack(
              alignment: Alignment.center,
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: Colors.grey[300],
                  backgroundImage: _user != null && _user!.photoURL != null
                      ? NetworkImage(_user!.photoURL!) // 🔹 Show uploaded avatar
                      : null,
                  child: _user == null || _user!.photoURL == null
                      ? Icon(Icons.person, size: 40, color: Colors.white) // Default avatar
                      : null,
                ),

                // 🔹 Show loading animation when uploading
                if (_isUploading)
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withOpacity(0.3), // Dim background
                      child: Center(
                        child: CircularProgressIndicator(color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),

            // -------------------------------------------------------------
            // 🔹 END UI Components for Avatar
            // -------------------------------------------------------------
            
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _user != null ? _user!.displayName ?? 'Guest User' : 'Guest User',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _user != null ? _user!.email ?? 'guest@example.com' : 'guest@example.com',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );

    pageWidgets.add(const SizedBox(height: 16));

    // Logout Button
    pageWidgets.add(
      ElevatedButton(
        onPressed: () async {
          await _authService.signOut();
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => GuestSettings()),
          );
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: SSBC_GRAY,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: const Text(
          'Logout',
          style: TextStyle(fontSize: 16),
        ),
      ),
    );

    pageWidgets.add(const SizedBox(height: 16));

    // Generate categories and items from list
    for (var category in _settingsCategories) {
      pageWidgets.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Text(
            category['category'],
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
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
              leading: Icon(
                item['icon'],
                color: SSBC_GRAY,
              ),
              title: Text(item['title']),
              subtitle: item.containsKey('subtitle') ? Text(item['subtitle']) : null,
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
              onTap: () async {
                if (item['title'] == 'Edit Profile' && _user != null) {
                  User? updatedUser = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => EditProfileScreen(user: _user!),
                    ),
                  );

                  if (updatedUser != null) {
                    setState(() {
                      _user = updatedUser; // Update UI after editing profile
                    });
                  }
                }

                if (item['title'] == 'Change Avatar' && _user != null && !_isUploading) {
                  await _changeAvatar();
                }
              },
            ),
          ),
        );
      }

      pageWidgets.add(const SizedBox(height: 8));
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: SSBC_GRAY,
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
          children: pageWidgets,
        ),
      ),
    );
  } 
}



