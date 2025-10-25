import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:app/pages/donation_success_page.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:app/models/event.dart';
import 'package:app/models/event_registration_summary.dart';
import 'package:app/models/profile_info.dart';
import 'package:app/caches/user_profile_cache.dart';
import 'package:app/services/family_member_service.dart';
import 'package:app/services/event_registration_service.dart';
import 'package:app/services/my_events_service.dart';
import 'package:app/providers/tab_provider.dart';
import 'package:app/widgets/bulk_event_registration_widget.dart';
import 'package:app/widgets/event_paypal_button.dart';
import 'package:app/pages/payment_success_page.dart';
import 'package:app/pages/user/family_members_page.dart';
import 'package:app/helpers/asset_helper.dart';

class EventShowcase extends StatefulWidget {
  final Event event;

  const EventShowcase({super.key, required this.event});

  @override
  State<EventShowcase> createState() => _EventShowcaseState();
}

class _EventShowcaseState extends State<EventShowcase> {
  EventRegistrationSummary? _registrationSummary;
  ProfileInfo? _currentUserProfile;
  late Stream<User?> _authStateStream;
  bool _isInMyEvents = false;
  String? _myEventsScope;
  bool _isLoadingMyEventsStatus = false;
  bool _isRegistering = false;

  // Missing member variables
  List<dynamic> _familyMembers = [];
  Map<String, dynamic> _familyMemberRegistrations = {};
  bool _isUserRegistered = false;
  final Set<String> _selectedRegistrants = {};

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
            _currentUserProfile = null;
            _selectedRegistrants.clear();
            _isInMyEvents = false;
            _myEventsScope = null;
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
      _loadCurrentUserProfile(),
      _loadFamilyMembers(),
      _checkRegistrationStatus(),
      _loadRegistrationDetails(),
      _checkMyEventsStatus(),
    ]);
  }

  Future<void> _loadCurrentUserProfile() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _currentUserProfile = null);
      return;
    }

    try {
      final profile = await UserProfileCache.read(user.uid);
      debugPrint(
        '🔍 [EventShowcase] Loaded user profile: ${profile?.toJson()}',
      );
      if (mounted) {
        setState(() => _currentUserProfile = profile);
      }
    } catch (e) {
      debugPrint('❌ [EventShowcase] Failed to load user profile: $e');
      if (mounted) {
        setState(() => _currentUserProfile = null);
      }
    }
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
      final familyMemberIds =
          _familyMembers.map((m) => m.id.toString()).toList();
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

    // Prepare registration data for bulk registration
    final registrations = <Map<String, dynamic>>[];

    for (final selectedId in _selectedRegistrants) {
      if (selectedId == 'self') {
        // Current user registration
        registrations.add({
          'family_member_id': null, // null indicates current user
          'name': 'You', // Will be replaced by backend with actual user name
        });
      } else {
        // Family member registration
        final familyMember = _familyMembers.firstWhere(
          (member) => member.id == selectedId,
        );
        registrations.add({
          'family_member_id': familyMember.id,
          'name': familyMember.fullName,
        });
      }
    }

    // Show bulk registration dialog
    _showBulkRegistrationDialog(registrations);
  }

  Future<void> _checkMyEventsStatus() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() {
        _isInMyEvents = false;
        _myEventsScope = null;
      });
      return;
    }

    setState(() => _isLoadingMyEventsStatus = true);

    try {
      final result = await MyEventsService.checkEventInMyEvents(
        eventId: widget.event.id,
      );

      if (mounted) {
        setState(() {
          _isInMyEvents = result['inMyEvents'] as bool;
          _myEventsScope = result['scope'] as String?;
          _isLoadingMyEventsStatus = false;
        });
      }
    } catch (e) {
      debugPrint('Failed to check My Events status: $e');
      if (mounted) {
        setState(() => _isLoadingMyEventsStatus = false);
      }
    }
  }

  Future<void> _addToMyEvents({required String scope}) async {
    setState(() => _isLoadingMyEventsStatus = true);

    try {
      final success = await MyEventsService.addToMyEvents(
        eventId: widget.event.id,
        scope: scope,
      );

      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              scope == 'series'
                  ? 'Added recurring event to My Events'
                  : 'Added event to My Events',
            ),
          ),
        );
        await _checkMyEventsStatus();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to add to My Events'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoadingMyEventsStatus = false);
      }
    }
  }

  void _showBulkRegistrationDialog(List<Map<String, dynamic>> registrations) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder:
          (dialogContext) => AlertDialog(
            title: Text('Register for ${widget.event.name}'),
            content: SizedBox(
              width: double.maxFinite,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  // Make dialog at most 80% of screen height to avoid overflow
                  maxHeight: MediaQuery.of(dialogContext).size.height * 0.8,
                ),
                child: BulkEventRegistrationWidget(
                  event: widget.event,
                  registrations: registrations,
                  navigateOnPayAtDoor:
                      true, // Enable direct navigation for pay-at-door
                  onSuccess: (String paymentType) async {
                    debugPrint(
                      '[EventShowcase] Success callback called with paymentType: $paymentType',
                    );

                    // For pay-at-door, navigation is handled directly by the widget
                    // For other payment types, show snackbar (using dialogContext) and close dialog
                    if (paymentType != 'door') {
                      final names = registrations
                          .map((r) => r['name'])
                          .join(', ');
                      ScaffoldMessenger.of(dialogContext).showSnackBar(
                        SnackBar(
                          content: Text('$names registered successfully!'),
                          backgroundColor: const Color.fromARGB(
                            255,
                            142,
                            163,
                            168,
                          ),
                          duration: const Duration(seconds: 4),
                        ),
                      );

                      if (Navigator.of(dialogContext).canPop()) {
                        Navigator.of(dialogContext).pop();
                      }
                    }

                    // Refresh data in background for all payment types
                    debugPrint(
                      '[EventShowcase] Refreshing registration data in background',
                    );
                    _refreshRegistrationData();
                  },
                  onPaymentSuccess: (String paymentId, String payerId) async {
                    // For PayPal payments, navigate to payment success page using dialogContext
                    Navigator.of(dialogContext).push(
                      MaterialPageRoute(
                        builder:
                            (context) => PaymentSuccessPage(
                              paymentId: paymentId,
                              payerId: payerId,
                              eventId: widget.event.id,
                              eventName: widget.event.name,
                            ),
                      ),
                    );

                    // Also refresh registration status after payment success
                    // Use a delay to let the payment complete
                    Future.delayed(const Duration(seconds: 2), () async {
                      if (mounted) {
                        await _checkRegistrationStatus();
                        await _checkFamilyMemberRegistrations();
                        await _loadRegistrationDetails();
                        if (mounted) {
                          setState(() => _selectedRegistrants.clear());
                        }
                      }
                    });
                  },
                  onCancel: () {
                    if (Navigator.of(dialogContext).canPop()) {
                      Navigator.of(dialogContext).pop();
                    }
                  },
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  if (Navigator.of(dialogContext).canPop()) {
                    Navigator.of(dialogContext).pop();
                  }
                },
                child: const Text('Cancel'),
              ),
            ],
          ),
    );
  }

  Future<void> _removeFromMyEvents() async {
    setState(() => _isLoadingMyEventsStatus = true);

    try {
      final success = await MyEventsService.removeFromMyEvents(
        eventId: widget.event.id,
        scope: _myEventsScope,
      );

      if (success && mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Removed from My Events')));
        await _checkMyEventsStatus();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to remove from My Events'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoadingMyEventsStatus = false);
      }
    }
  }

  Future<void> _switchMyEventsScope(String newScope) async {
    setState(() => _isLoadingMyEventsStatus = true);

    try {
      final removeSuccess = await MyEventsService.removeFromMyEvents(
        eventId: widget.event.id,
        scope: _myEventsScope,
      );

      if (removeSuccess) {
        final addSuccess = await MyEventsService.addToMyEvents(
          eventId: widget.event.id,
          scope: newScope,
        );

        if (addSuccess && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                newScope == 'series'
                    ? 'Switched to recurring'
                    : 'Switched to one-time',
              ),
            ),
          );
          await _checkMyEventsStatus();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error switching scope: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoadingMyEventsStatus = false);
      }
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

        // Refresh registration status and reload family members to update availability
        await _loadRegistrationDetails();
        await _checkRegistrationStatus();
        await _checkFamilyMemberRegistrations();
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

  // helper methods removed: _handleBulkRegistration and _showFallbackSuccessMessage

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

    // Reload family list before showing dialog to ensure it's up to date
    _loadFamilyMembers().then((_) {
      if (!mounted) return;
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
                                'Event Registration',
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
                                    widget.event.spots != null &&
                                    widget.event.spots! > 0) ...[
                                  Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: Colors.red[50],
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: Colors.red[200]!,
                                      ),
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
                                  _buildPersonSelectionStep(setDialogState),
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
    });
  }

  Widget _buildCurrentRegistrations() {
    // Don't show the registration container if data hasn't loaded yet
    if (_registrationSummary == null) {
      return const SizedBox.shrink();
    }
    // If RSVP is not required AND the event is free, show a compact message
    // and then render different watch controls depending on recurring vs
    // non-recurring. Also show Donate when allowed.
    if (!widget.event.rsvp && widget.event.isFree) {
      return Card(
        color: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'No RSVP Required',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              const Text(
                'This event does not require RSVP.',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 12),

              // If the event is free but accepts donations, offer a Donate button
              if (widget.event.allowsDonations) ...[
                const Text(
                  'You can Support this Event with a Donation:',
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 12),
                EventPayPalButton(
                  event: widget.event,
                  onPaymentSuccess: () async {
                    // Refresh registration and family data
                    await _loadRegistrationDetails();
                    await _checkRegistrationStatus();
                    await _checkFamilyMemberRegistrations();
                    if (mounted) setState(() {});

                    // Navigate to a Thank You / Donation Success page for donations on no-RSVP events
                    if (mounted) {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder:
                              (context) => DonationSuccessPage(
                                eventName: widget.event.name,
                              ),
                        ),
                      );
                    }
                  },
                  onPaymentError: (err) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Donation failed: $err')),
                      );
                    }
                  },
                ),
              ],
            ],
          ),
        ),
      );
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
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
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

    // Local references to theme text styles and color scheme
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;

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
              Text(
                'Total Registered:',
                style: tt.labelLarge?.copyWith(color: cs.onPrimary),
              ),
              Text(
                '${_registrationSummary!.totalRegistrations}',
                style: tt.labelLarge?.copyWith(color: cs.onPrimary),
              ),
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
    final scopeLabel =
        registration.scope == 'series' ? 'Recurring' : 'One-time';

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color.fromARGB(255, 142, 163, 168),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.person, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      registration.displayName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        scopeLabel,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  'Registered ${_formatRegistrationDate(registration.registeredOn)}',
                  style: const TextStyle(fontSize: 11, color: Colors.white),
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
              child: const Text(
                'Remove',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
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

  /// Check if a family member is eligible for the event based on gender and age requirements
  bool _isFamilyMemberEligibleForEvent(dynamic member) {
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

  /// Check if the current user is eligible for the event based on gender and age requirements
  bool _isCurrentUserEligibleForEvent() {
    debugPrint(
      '🔍 [EventShowcase] Checking user eligibility for event: ${widget.event.name}',
    );
    debugPrint(
      '🔍 [EventShowcase] Event gender requirement: "${widget.event.gender}"',
    );
    debugPrint(
      '🔍 [EventShowcase] Event age requirement: ${widget.event.minAge}-${widget.event.maxAge}',
    );
    debugPrint(
      '🔍 [EventShowcase] User profile loaded: ${_currentUserProfile != null}',
    );

    // Check gender requirements first
    // Event gender can be "all", "male", "female", "M", or "F"
    final eventGender = widget.event.gender.toLowerCase();

    // If event is open to all genders, we still need to check age if profile exists
    if (eventGender != 'all') {
      // For gender-restricted events, we need profile data
      if (_currentUserProfile == null) {
        debugPrint(
          '❌ [EventShowcase] Gender-restricted event but no user profile - blocking registration',
        );
        return false;
      }

      debugPrint(
        '🔍 [EventShowcase] User gender: "${_currentUserProfile!.gender}"',
      );

      final userGender = _currentUserProfile!.gender?.toLowerCase();

      debugPrint(
        '🔍 [EventShowcase] Comparing - Event: "$eventGender" vs User: "$userGender"',
      );

      // If user has no gender set in their profile, block registration for gender-restricted events
      if (userGender == null) {
        debugPrint(
          '❌ [EventShowcase] Gender-restricted event but user has no gender set - blocking registration',
        );
        return false;
      }

      // Handle different gender formats
      if (eventGender == 'male' || eventGender == 'm') {
        if (userGender != 'm' && userGender != 'male') {
          debugPrint(
            '❌ [EventShowcase] User gender mismatch - event requires male, user is $userGender',
          );
          return false;
        }
      } else if (eventGender == 'female' || eventGender == 'f') {
        if (userGender != 'f' && userGender != 'female') {
          debugPrint(
            '❌ [EventShowcase] User gender mismatch - event requires female, user is $userGender',
          );
          return false;
        }
      }
    }

    // Check age requirements if profile is available
    if (_currentUserProfile?.birthday != null) {
      final userAge = _calculateAge(_currentUserProfile!.birthday!);
      debugPrint('🔍 [EventShowcase] User age: $userAge');

      if (userAge < widget.event.minAge || userAge > widget.event.maxAge) {
        debugPrint(
          '❌ [EventShowcase] User age mismatch - event requires ${widget.event.minAge}-${widget.event.maxAge}, user is $userAge',
        );
        return false;
      }
    } else if (_currentUserProfile != null) {
      // Profile exists but no birthday - for age-restricted events, this could be an issue
      debugPrint(
        '⚠️ [EventShowcase] User profile exists but no birthday set - cannot validate age',
      );
      // For now, we'll allow registration, but this could be made stricter if needed
    } else {
      // No profile at all
      if (eventGender != 'all') {
        // Already handled above
      } else {
        debugPrint(
          '⚠️ [EventShowcase] No user profile but event is open to all genders - allowing registration',
        );
      }
    }

    debugPrint('✅ [EventShowcase] User is eligible for this event');
    return true;
  }

  /// Calculate age from birthday (same logic as FamilyMember.age)
  int _calculateAge(DateTime birthday) {
    final now = DateTime.now();
    int age = now.year - birthday.year;
    if (now.month < birthday.month ||
        (now.month == birthday.month && now.day < birthday.day)) {
      age--;
    }
    return age;
  }

  Widget _buildPersonSelectionStep(StateSetter setDialogState) {
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

    debugPrint('🔍 [EventShowcase] Building registration form...');
    debugPrint('🔍 [EventShowcase] User registered: $_isUserRegistered');

    // Add self if not registered AND meets event requirements (gender filtering)
    if (!_isUserRegistered && _isCurrentUserEligibleForEvent()) {
      debugPrint('✅ [EventShowcase] Adding "Myself" option - user is eligible');
      availableRegistrants.add({'id': 'self', 'name': 'Myself'});
    } else if (!_isUserRegistered) {
      debugPrint(
        '❌ [EventShowcase] NOT adding "Myself" option - user not eligible',
      );
    } else {
      debugPrint(
        'ℹ️ [EventShowcase] NOT adding "Myself" option - user already registered',
      );
    }

    // Add family members who are not registered and meet event requirements
    for (final member in _familyMembers) {
      final isRegistered = _familyMemberRegistrations[member.id] ?? false;
      if (!isRegistered && _isFamilyMemberEligibleForEvent(member)) {
        availableRegistrants.add({'id': member.id, 'name': member.fullName});
      }
    }

    if (availableRegistrants.isEmpty) {
      // Check why no registrants are available
      final isGenderRestricted = widget.event.gender.toLowerCase() != 'all';
      final isAgeRestricted =
          widget.event.minAge > 0 || widget.event.maxAge < 150;
      final userNeedsProfile =
          !_isUserRegistered &&
          _currentUserProfile == null &&
          (isGenderRestricted || isAgeRestricted);

      if (userNeedsProfile) {
        String requirements = '';
        if (isGenderRestricted && isAgeRestricted) {
          requirements = 'gender and age information';
        } else if (isGenderRestricted) {
          requirements = 'gender information';
        } else {
          requirements = 'age information';
        }

        return Column(
          children: [
            Icon(Icons.person_off, size: 48, color: Colors.orange),
            const SizedBox(height: 16),
            Text(
              'Complete your profile to register for this event.',
              style: const TextStyle(
                color: Colors.orange,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'This event requires $requirements. Go to Profile → Edit Profile to complete your profile.',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            if (isAgeRestricted) ...[
              const SizedBox(height: 4),
              Text(
                'Age requirement: ${widget.event.minAge}-${widget.event.maxAge} years',
                style: const TextStyle(color: Colors.grey, fontSize: 11),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        );
      }

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
          child: Scrollbar(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children:
                    availableRegistrants
                        .map(
                          (registrant) =>
                              _buildCheckboxTile(registrant, setDialogState),
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

  // Helper method to refresh registration data in background
  void _refreshRegistrationData() {
    // Run data refresh in background without blocking UI
    Future.delayed(Duration(milliseconds: 500), () async {
      try {
        if (mounted) {
          await _checkRegistrationStatus();
          await _checkFamilyMemberRegistrations();
          await _loadRegistrationDetails();

          if (mounted) {
            setState(() => _selectedRegistrants.clear());
            debugPrint('[EventShowcase] Background data refresh completed');
          }
        }
      } catch (e) {
        debugPrint('[EventShowcase] Error during background data refresh: $e');
      }
    });
  }

  String _formatMinistries(List<String> ministries) {
    if (ministries.isEmpty) {
      return '';
    }

    // If only one ministry, use the current format with "'s Ministry"
    if (ministries.length == 1) {
      return "${ministries.first}'s Ministry";
    }

    // If multiple ministries, format as comma-separated list with "'s Ministry" added to each
    return ministries.map((m) => "$m's Ministry").join(', ');
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
              Navigator.of(
                context,
              ).pushNamedAndRemoveUntil('/', (route) => false);
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
    // Hero image currently uses placeholder; no local theme vars required here

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
                if ((_registrationSummary?.availableSpots ?? 1) > 0 ||
                    (_registrationSummary?.availableSpots ?? 1) == -1) {
                  // Allow unlimited spots
                  _showRegistrationDialog();
                }
              },
              icon: const Icon(Icons.person_add, size: 18),
              label: Text(
                ((_registrationSummary?.availableSpots ?? 1) > 0 ||
                        (_registrationSummary?.availableSpots ?? 1) == -1)
                    ? 'Register'
                    : 'Event Full',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    ((_registrationSummary?.availableSpots ?? 1) > 0 ||
                            (_registrationSummary?.availableSpots ?? 1) == -1)
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
                    ((_registrationSummary?.availableSpots ?? 1) > 0 ||
                            (_registrationSummary?.availableSpots ?? 1) == -1)
                        ? 4
                        : 0,
              ),
            ),
          ),
          _buildEventThumb(),
          // Action buttons positioned in bottom right
          Positioned(bottom: 16, right: 16, child: _buildActionButtons()),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    final cs = Theme.of(context).colorScheme;
    final user = FirebaseAuth.instance.currentUser;

    if (user == null) {
      return ElevatedButton.icon(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please log in to register for events.'),
              backgroundColor: Colors.orange,
            ),
          );
        },
        icon: const Icon(Icons.login, size: 18),
        label: const Text(
          'Log In',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color.fromARGB(255, 142, 163, 168),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          elevation: 4,
        ),
      );
    }

    if (widget.event.rsvp) {
      return _buildRSVPButtons(cs);
    } else {
      return _buildWatchButtons(cs);
    }
  }

  Widget _buildRSVPButtons(ColorScheme cs) {
    if (_registrationSummary == null ||
        _registrationSummary!.userRegistrations.isEmpty) {
      return ElevatedButton.icon(
        onPressed:
            ((_registrationSummary?.availableSpots ?? 1) > 0 ||
                    (_registrationSummary?.availableSpots ?? 1) == -1)
                ? _showRegistrationDialog
                : null,
        icon: const Icon(Icons.person_add, size: 18),
        label: Text(
          ((_registrationSummary?.availableSpots ?? 1) > 0 ||
                  (_registrationSummary?.availableSpots ?? 1) == -1)
              ? 'Register'
              : 'Event Full',
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color.fromARGB(255, 142, 163, 168),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          elevation: 4,
        ),
      );
    } else {
      return ElevatedButton.icon(
        onPressed: _showRegistrationDialog,
        icon: const Icon(Icons.edit, size: 18),
        label: const Text(
          'Change Registration',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color.fromARGB(255, 142, 163, 168),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          elevation: 4,
        ),
      );
    }
  }

  Widget _buildWatchButtons(ColorScheme cs) {
    if (_isLoadingMyEventsStatus) {
      return const SizedBox(
        width: 40,
        height: 40,
        child: CircularProgressIndicator(
          strokeWidth: 3,
          valueColor: AlwaysStoppedAnimation<Color>(
            Color.fromARGB(255, 142, 163, 168),
          ),
        ),
      );
    }

    // The Event model uses a nullable String for `recurring`. Consider an
    // event recurring when the field is present and != 'never'.
    if (widget.event.recurring != null &&
        widget.event.recurring != 'never' &&
        widget.event.recurring!.isNotEmpty) {
      if (_isInMyEvents) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ElevatedButton(
              onPressed:
                  () => _switchMyEventsScope(
                    _myEventsScope == 'occurrence' ? 'series' : 'occurrence',
                  ),
              style: ElevatedButton.styleFrom(
                backgroundColor: cs.secondary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 4,
              ),
              child: Text(
                _myEventsScope == 'occurrence'
                    ? 'Switch to Recurring'
                    : 'Switch to One Time',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _removeFromMyEvents,
              style: ElevatedButton.styleFrom(
                backgroundColor: cs.error,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 4,
              ),
              child: const Text(
                'Remove',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      } else {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ElevatedButton(
              onPressed: () => _addToMyEvents(scope: 'occurrence'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromARGB(255, 142, 163, 168),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 4,
              ),
              child: const Text(
                'Add One Time',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () => _addToMyEvents(scope: 'series'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color.fromARGB(255, 142, 163, 168),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 4,
              ),
              child: const Text(
                'Add Recurring',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      }
    } else {
      if (_isInMyEvents) {
        return ElevatedButton(
          onPressed: _removeFromMyEvents,
          style: ElevatedButton.styleFrom(
            backgroundColor: cs.error,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            elevation: 4,
          ),
          child: const Text(
            'Remove from My Events',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
          ),
        );
      } else {
        return ElevatedButton(
          onPressed: () => _addToMyEvents(scope: 'occurrence'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color.fromARGB(255, 142, 163, 168),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            elevation: 4,
          ),
          child: const Text(
            'Add to My Events',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
          ),
        );
      }
    }
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

  Widget _buildEventThumb() {
    final imageUrl =
        widget.event.imageUrl != null && widget.event.imageUrl!.isNotEmpty
            ? AssetHelper.getPublicUrl(widget.event.imageUrl!)
            : null;

    if (imageUrl == null) {
      return _buildImagePlaceholder();
    } else {
      return SizedBox.expand(
        child: Image.network(
          imageUrl,
          fit: BoxFit.cover,
          // While loading, show the placeholder (keeps the card pretty)
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            return _buildImagePlaceholder();
          },
          // On error (404, invalid URL, etc.), show the placeholder
          errorBuilder: (context, error, stackTrace) {
            return _buildImagePlaceholder();
          },
        ),
      );
    }
  }

  Widget _buildEventHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.event.name,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
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
            // Show ministry line directly under location when available
            if (widget.event.ministry.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildSvgInfoRow(
                'assets/nav_icons/Home.svg',
                'Ministry',
                _formatMinistries(widget.event.ministry),
              ),
            ],
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
              Text(value, style: const TextStyle(fontSize: 16)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSvgInfoRow(String assetPath, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SvgPicture.asset(
          assetPath,
          width: 20,
          height: 20,
          colorFilter: const ColorFilter.mode(Colors.grey, BlendMode.srcIn),
        ),
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
              Text(value, style: const TextStyle(fontSize: 16)),
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
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              widget.event.description,
              style: const TextStyle(fontSize: 16, height: 1.4),
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
    final cs = Theme.of(context).colorScheme;
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

    if (widget.event.recurring != null &&
        widget.event.recurring != 'never' &&
        widget.event.recurring!.isNotEmpty) {
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
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            ...specs.map(
              (spec) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, size: 16, color: cs.primary),
                    const SizedBox(width: 8),
                    Text(spec, style: const TextStyle(fontSize: 16)),
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
