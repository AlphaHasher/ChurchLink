import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/event.dart';
import '../models/family_member.dart';
import '../models/event_registration_summary.dart';
import '../services/family_member_service.dart';
import '../services/event_registration_service.dart';
import '../providers/tab_provider.dart';
import 'user/family_members_page.dart';

class EventShowcase extends StatefulWidget {
  final Event event;

  const EventShowcase({super.key, required this.event});

  @override
  State<EventShowcase> createState() => _EventShowcaseState();
}

class _EventShowcaseState extends State<EventShowcase> {
  List<FamilyMember> _familyMembers = [];
  Set<String> _selectedRegistrants = {};
  bool _isRegistering = false;
  bool _isUserRegistered = false;
  Map<String, bool> _familyMemberRegistrations = {};
  EventRegistrationSummary? _registrationSummary;
  late Stream<User?> _authStateStream;

  @override
  void initState() {
    super.initState();
    // Listen to authentication state changes
    _authStateStream = FirebaseAuth.instance.authStateChanges();
    _authStateStream.listen((User? user) {
      if (user == null) {
        // User logged out, clear all family data
        if (mounted) {
          setState(() {
            _familyMembers = [];
            _familyMemberRegistrations = {};
            _isUserRegistered = false;
            _selectedRegistrants.clear();
          });
        }
      }
    });

    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    // Check if user is authenticated before loading any data
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      // User is not authenticated, don't load family data
      return;
    }

    await Future.wait([
      _loadFamilyMembers(),
      _checkRegistrationStatus(),
      _loadRegistrationDetails(),
    ]);
  }

  Future<void> _loadFamilyMembers() async {
    // Check authentication before loading family members
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      // Clear any existing family member data when user is not authenticated
      setState(() {
        _familyMembers = [];
        _familyMemberRegistrations = {};
      });
      return;
    }

    try {
      final members = await FamilyMemberService.getFamilyMembers();
      if (mounted) {
        setState(() {
          _familyMembers = members;
        });

        // Check registration status for each family member
        await _checkFamilyMemberRegistrations();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load family members: $e')),
        );
      }
    }
  }

  Future<void> _checkRegistrationStatus() async {
    // Check authentication before checking registration status
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _isUserRegistered = false);
      return;
    }

    try {
      final isRegistered = await EventRegistrationService.isUserRegistered(
        widget.event.id,
      );
      if (mounted) {
        setState(() => _isUserRegistered = isRegistered);
      }
    } catch (e) {
      debugPrint('Failed to check user registration status: $e');
    }
  }

  Future<void> _checkFamilyMemberRegistrations() async {
    // Check authentication before checking family member registrations
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _familyMemberRegistrations = {});
      return;
    }

    if (_familyMembers.isEmpty) {
      setState(() => _familyMemberRegistrations = {});
      return;
    }

    try {
      // Use new bulk endpoint for better performance
      final familyMemberIds = _familyMembers.map((m) => m.id).toList();
      final registrations =
          await EventRegistrationService.areFamilyMembersRegistered(
            eventId: widget.event.id,
            familyMemberIds: familyMemberIds,
          );

      if (mounted) {
        setState(() => _familyMemberRegistrations = registrations);
      }
    } catch (e) {
      debugPrint('Bulk check failed, falling back to individual checks: $e');

      // Fallback to individual checks if bulk endpoint fails
      final Map<String, bool> registrations = {};
      for (final member in _familyMembers) {
        try {
          final isRegistered =
              await EventRegistrationService.isFamilyMemberRegistered(
                eventId: widget.event.id,
                familyMemberId: member.id,
              );
          registrations[member.id] = isRegistered;
        } catch (e) {
          debugPrint('Failed to check registration for ${member.fullName}: $e');
          registrations[member.id] = false;
        }
      }
      if (mounted) {
        setState(() => _familyMemberRegistrations = registrations);
      }
    }
  }

  Future<void> _loadRegistrationDetails() async {
    try {
      final summary =
          await EventRegistrationService.getEventRegistrationSummary(
            widget.event.id,
          );
      setState(() => _registrationSummary = summary);
    } catch (e) {
      debugPrint('Failed to load registration summary: $e');
    }
  }

  Future<void> _handleRegistration() async {
    if (_selectedRegistrants.isEmpty) return;

    setState(() => _isRegistering = true);

    final registrationResults = <String, bool>{};
    final registrationErrors = <String, String>{};

    try {
      // Process each selected registrant
      for (final selectedId in _selectedRegistrants) {
        try {
          bool success;
          String registrantName;

          if (selectedId == 'self') {
            success = await EventRegistrationService.registerForEvent(
              eventId: widget.event.id,
            );
            registrantName = 'You';
          } else {
            final familyMember = _familyMembers.firstWhere(
              (member) => member.id == selectedId,
            );
            success = await EventRegistrationService.registerForEvent(
              eventId: widget.event.id,
              familyMemberId: familyMember.id,
            );
            registrantName = familyMember.fullName;
          }

          registrationResults[registrantName] = success;
          if (!success) {
            registrationErrors[registrantName] = 'Registration failed';
          }
        } catch (e) {
          final registrantName =
              selectedId == 'self'
                  ? 'You'
                  : _familyMembers
                      .firstWhere((m) => m.id == selectedId)
                      .fullName;
          registrationResults[registrantName] = false;
          registrationErrors[registrantName] = e.toString();
        }
      }

      // Show results to user
      final successCount =
          registrationResults.values.where((success) => success).length;
      final totalCount = registrationResults.length;

      if (mounted) {
        if (successCount == totalCount) {
          // All successful
          final names = registrationResults.keys
              .where((name) => registrationResults[name] == true)
              .join(', ');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '$names successfully registered for ${widget.event.name}!',
              ),
              backgroundColor: const Color.fromARGB(255, 142, 163, 168),
            ),
          );
        } else if (successCount > 0) {
          // Partial success
          final successNames = registrationResults.keys
              .where((name) => registrationResults[name] == true)
              .join(', ');
          final failedNames = registrationResults.keys
              .where((name) => registrationResults[name] == false)
              .join(', ');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Partial success: $successNames registered. Failed: $failedNames',
              ),
              backgroundColor: Colors.orange,
            ),
          );
        } else {
          // All failed
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('All registrations failed. Please try again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }

      // Refresh registration status
      await _checkRegistrationStatus();
      await _checkFamilyMemberRegistrations();
      await _loadRegistrationDetails();

      setState(() => _selectedRegistrants.clear());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Registration failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() => _isRegistering = false);
    }
  }

  Future<void> _handleUnregistration(
    String registrantId,
    String registrantName,
  ) async {
    // Show confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Confirm Unregistration'),
            content: Text(
              'Are you sure you want to unregister $registrantName from ${widget.event.name}?',
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                child: const Text(
                  'Unregister',
                  style: TextStyle(color: Colors.white),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
            ],
          ),
    );

    if (confirmed != true) return;

    setState(() => _isRegistering = true);

    try {
      bool success;

      if (registrantId == 'self') {
        success = await EventRegistrationService.unregisterFromEvent(
          eventId: widget.event.id,
        );
      } else {
        success = await EventRegistrationService.unregisterFromEvent(
          eventId: widget.event.id,
          familyMemberId: registrantId,
        );
      }

      if (success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '$registrantName successfully unregistered from ${widget.event.name}',
              ),
              backgroundColor: Colors.orange,
            ),
          );
        }

        // Refresh registration status
        await _checkRegistrationStatus();
        await _checkFamilyMemberRegistrations();
        await _loadRegistrationDetails();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Unregistration failed. Please try again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Unregistration failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() => _isRegistering = false);
    }
  }

  void _showRegistrationDialog() {
    // Check authentication before showing registration dialog
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please log in to register for events.'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: StatefulBuilder(
            builder: (BuildContext context, StateSetter setDialogState) {
              return ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: 400,
                  maxHeight: MediaQuery.of(context).size.height * 0.8,
                ),
                child: IntrinsicHeight(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Dialog Header
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: const BoxDecoration(
                          color: Color.fromARGB(255, 142, 163, 168),
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(12),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.person_add,
                              color: Colors.white,
                              size: 24,
                            ),
                            const SizedBox(width: 12),
                            const Text(
                              'Add form',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const Spacer(),
                            IconButton(
                              onPressed: () => Navigator.of(context).pop(),
                              icon: const Icon(
                                Icons.close,
                                color: Colors.white,
                              ),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                      ),

                      // Dialog Content
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Event Full Warning
                              if (!widget.event.hasSpots &&
                                  widget.event.spots != null) ...[
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.red[50],
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.red[200]!),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.event_busy,
                                        color: Colors.red,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text(
                                              'Event Full',
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                color: Colors.red,
                                              ),
                                            ),
                                            Text(
                                              'This event has reached its capacity of ${widget.event.spots} attendees.',
                                              style: const TextStyle(
                                                fontSize: 14,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 20),
                              ],

                              // Registration Form
                              if (widget.event.hasSpots ||
                                  widget.event.spots == null) ...[
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Expanded(
                                      child: Text(
                                        'Select People',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    ElevatedButton.icon(
                                      onPressed: () {
                                        Navigator.of(
                                          context,
                                        ).pop(); // Close dialog
                                        Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder:
                                                (context) =>
                                                    const FamilyMembersPage(),
                                          ),
                                        );
                                      },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color.fromARGB(
                                          255,
                                          142,
                                          163,
                                          168,
                                        ),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 16,
                                          vertical: 8,
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                        ),
                                      ),
                                      icon: const Icon(
                                        Icons.edit,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                      label: const Text(
                                        'Edit My Family',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.white,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                _buildDialogRegistrationForm(setDialogState),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildCurrentRegistrations() {
    // Don't show the registration container if data hasn't loaded yet
    if (_registrationSummary == null) {
      return const SizedBox.shrink();
    }

    return Card(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Registration Status',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 16),

            // Show only capacity information
            _buildCapacityInfo(),

            const SizedBox(height: 16),

            // Show only current user's family registrations
            _buildUserFamilyRegistrations(),
          ],
        ),
      ),
    );
  }

  Widget _buildCapacityInfo() {
    if (_registrationSummary == null) {
      return const CircularProgressIndicator();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total Registered:'),
              Text('${_registrationSummary!.totalRegistrations}'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUserFamilyRegistrations() {
    if (_registrationSummary == null ||
        _registrationSummary!.userRegistrations.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Your Registrations:',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        ...(_registrationSummary!.userRegistrations.map(
          (reg) => _buildUserRegistrationTile(reg),
        )),
      ],
    );
  }

  Widget _buildUserRegistrationTile(RegistrationEntry registration) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.blue[50],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(
            registration.personId == null
                ? Icons.person
                : Icons.family_restroom,
            color: Colors.blue[700],
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  registration.displayName,
                  style: TextStyle(
                    color: Colors.black87,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  'Registered ${_formatRegistrationDate(registration.registeredOn)}',
                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
          if (!_isRegistering)
            TextButton(
              onPressed:
                  () => _handleUnregistration(
                    registration.personId ?? 'self',
                    registration.displayName,
                  ),
              child: const Text('Remove'),
            ),
        ],
      ),
    );
  }

  // REMOVED: _buildRegistrationList() and _buildMainPageRegistrationTile() methods
  // These methods previously exposed other users' personal registration data
  // Replaced with privacy-compliant methods: _buildCapacityInfo() and _buildUserFamilyRegistrations()

  String _formatRegistrationDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'just now';
    }
  }

  /// Check if a family member is eligible for the event based on age and gender requirements
  bool _isEligibleForEvent(FamilyMember member) {
    // Check age requirements
    if (member.age < widget.event.minAge || member.age > widget.event.maxAge) {
      return false;
    }

    // Check gender requirements
    // Event gender can be "all", "male", "female", "M", or "F"
    if (widget.event.gender.toLowerCase() != 'all') {
      final eventGender = widget.event.gender.toLowerCase();
      final memberGender = member.gender.toLowerCase();

      // Handle different gender formats
      if (eventGender == 'male' || eventGender == 'm') {
        if (memberGender != 'm' && memberGender != 'male') {
          return false;
        }
      } else if (eventGender == 'female' || eventGender == 'f') {
        if (memberGender != 'f' && memberGender != 'female') {
          return false;
        }
      }
    }

    // Ministry requirements are not checked here since family members don't have ministry data
    // If needed in the future, add ministry field to FamilyMember model

    return true;
  }

  Widget _buildDialogRegistrationForm(StateSetter setDialogState) {
    // Check authentication before building registration form
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const Column(
        children: [
          Icon(Icons.person_off, size: 48, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            'Please log in to register for events.',
            style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
            textAlign: TextAlign.center,
          ),
        ],
      );
    }

    final availableRegistrants = <Map<String, String>>[];

    // Add self if not registered (Note: For current user, we would need to check their profile data)
    // For now, we'll assume the current user is always eligible unless we implement user profile validation
    if (!_isUserRegistered) {
      availableRegistrants.add({'id': 'self', 'name': 'Myself'});
    }

    // Add family members who are not registered and meet event requirements
    for (final member in _familyMembers) {
      final isRegistered = _familyMemberRegistrations[member.id] ?? false;
      if (!isRegistered && _isEligibleForEvent(member)) {
        availableRegistrants.add({'id': member.id, 'name': member.fullName});
      }
    }

    if (availableRegistrants.isEmpty) {
      return const Text(
        'All family members are already registered for this event.',
        style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Selection header with Select All/Deselect All
        Row(
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  onPressed: () {
                    setDialogState(() {
                      _selectedRegistrants.clear();
                    });
                  },
                  child: const Text('Clear', style: TextStyle(fontSize: 12)),
                ),
                TextButton(
                  onPressed: () {
                    setDialogState(() {
                      _selectedRegistrants.clear();
                      _selectedRegistrants.addAll(
                        availableRegistrants.map((r) => r['id']!),
                      );
                    });
                  },
                  child: const Text(
                    'Select All',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Checkbox list
        Container(
          constraints: const BoxConstraints(maxHeight: 180, minHeight: 60),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!),
            borderRadius: BorderRadius.circular(8),
          ),
          child:
              availableRegistrants.length <= 3
                  ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children:
                        availableRegistrants
                            .map(
                              (registrant) => _buildCheckboxTile(
                                registrant,
                                setDialogState,
                              ),
                            )
                            .toList(),
                  )
                  : Scrollbar(
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children:
                            availableRegistrants
                                .map(
                                  (registrant) => _buildCheckboxTile(
                                    registrant,
                                    setDialogState,
                                  ),
                                )
                                .toList(),
                      ),
                    ),
                  ),
        ),
        const SizedBox(height: 16),

        // Register button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed:
                _selectedRegistrants.isNotEmpty && !_isRegistering
                    ? () {
                      Navigator.of(context).pop(); // Close dialog
                      _handleRegistration();
                    }
                    : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color.fromARGB(255, 142, 163, 168),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child:
                _isRegistering
                    ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                    : Text(
                      _selectedRegistrants.length <= 1
                          ? 'Register'
                          : 'Register ${_selectedRegistrants.length} People',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
          ),
        ),
      ],
    );
  }

  Widget _buildCheckboxTile(
    Map<String, String> registrant,
    StateSetter setDialogState,
  ) {
    final isSelected = _selectedRegistrants.contains(registrant['id']);
    return CheckboxListTile(
      title: Text(registrant['name']!, style: const TextStyle(fontSize: 16)),
      value: isSelected,
      onChanged: (value) {
        setDialogState(() {
          if (value == true) {
            _selectedRegistrants.add(registrant['id']!);
          } else {
            _selectedRegistrants.remove(registrant['id']!);
          }
        });
      },
      activeColor: const Color.fromARGB(255, 142, 163, 168),
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
    );
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: ssbcGray,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          widget.event.name,
          style: const TextStyle(color: Colors.white),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            // Since we used pushAndRemoveUntil, we should always be able to pop
            // If not, ensure we go back to the Events tab
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              // Fallback: navigate to Events tab and then to home
              TabProvider.instance?.setTabByName('events');
              Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
            }
          },
        ),
      ),
      backgroundColor: const Color.fromARGB(255, 240, 240, 240),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeroImage(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildEventHeader(),
                  const SizedBox(height: 16),
                  _buildEventInfo(),
                  const SizedBox(height: 16),
                  _buildCurrentRegistrations(),
                  const SizedBox(height: 16),
                  _buildDescription(),
                  const SizedBox(height: 16),
                  _buildEventSpecs(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroImage() {
    return SizedBox(
      height: 250,
      width: double.infinity,
      child: Stack(
        children: [
          // Load image from uploads API endpoint
          // For now, always show placeholder until backend image serving is implemented
          _buildImagePlaceholder(),
          // Registration button positioned in bottom right
          Positioned(
            bottom: 16,
            right: 16,
            child: ElevatedButton.icon(
              onPressed: () {
                // Check authentication and available spots before showing dialog
                final user = FirebaseAuth.instance.currentUser;
                if (user == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Please log in to register for events.'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                  return;
                }
                if ((_registrationSummary?.availableSpots ?? 1) > 0) {
                  _showRegistrationDialog();
                }
              },
              icon: const Icon(Icons.person_add, size: 18),
              label: Text(
                (_registrationSummary?.availableSpots ?? 1) > 0
                    ? 'Register'
                    : 'Event Full',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    (_registrationSummary?.availableSpots ?? 1) > 0
                        ? const Color.fromARGB(255, 142, 163, 168)
                        : Colors.grey,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation:
                    (_registrationSummary?.availableSpots ?? 1) > 0 ? 4 : 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildImagePlaceholder() {
    return Container(
      width: double.infinity,
      height: double.infinity,
      color: Colors.grey[300],
      child: const Center(
        child: Icon(Icons.event, size: 80, color: Colors.grey),
      ),
    );
  }

  Widget _buildEventHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.event.name,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        if (widget.event.ruName != null && widget.event.ruName!.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            widget.event.ruName!,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: Colors.grey,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildEventInfo() {
    return Card(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildInfoRow(
              Icons.attach_money,
              'Charge',
              widget.event.isFree
                  ? 'FREE'
                  : '\$${widget.event.price.toStringAsFixed(2)}',
            ),
            const SizedBox(height: 12),
            _buildInfoRow(
              Icons.schedule,
              'Date & Time',
              widget.event.formattedDateTime,
            ),
            const SizedBox(height: 12),
            _buildInfoRow(Icons.location_on, 'Location', widget.event.location),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(icon, size: 20, color: ssbcGray),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDescription() {
    return Card(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Description',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              widget.event.description,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.black87,
                height: 1.4,
              ),
            ),
            if (widget.event.ruDescription != null &&
                widget.event.ruDescription!.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),
              Text(
                widget.event.ruDescription!,
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                  height: 1.4,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildEventSpecs() {
    final specs = <String>[];

    if (widget.event.minAge > 0 || widget.event.maxAge < 100) {
      specs.add('Ages: ${widget.event.minAge}-${widget.event.maxAge}');
    }

    if (widget.event.gender != 'all') {
      specs.add(
        'Gender: ${widget.event.gender[0].toUpperCase()}${widget.event.gender.substring(1)}',
      );
    }

    if (widget.event.rsvp) {
      specs.add('RSVP Required');
    }

    if (widget.event.recurring != null) {
      specs.add('Recurring: ${widget.event.recurring}');
    }

    if (specs.isEmpty) return const SizedBox.shrink();

    return Card(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Event Requirements',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            ...specs.map(
              (spec) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_circle,
                      size: 16,
                      color: Color.fromARGB(255, 142, 163, 168),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      spec,
                      style: const TextStyle(
                        fontSize: 16,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
