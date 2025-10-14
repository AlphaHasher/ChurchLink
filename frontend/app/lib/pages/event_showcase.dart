import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/event.dart';
import '../models/event_registration_summary.dart';
import '../services/event_registration_service.dart';
import '../services/my_events_service.dart';
import '../providers/tab_provider.dart';
import 'event_registration_page.dart';
import '../helpers/asset_helper.dart'; 

class EventShowcase extends StatefulWidget {
  final Event event;

  const EventShowcase({super.key, required this.event});

  @override
  State<EventShowcase> createState() => _EventShowcaseState();
}

class _EventShowcaseState extends State<EventShowcase> {
  EventRegistrationSummary? _registrationSummary;
  late Stream<User?> _authStateStream;
  bool _isInMyEvents = false;
  String? _myEventsScope;
  bool _isLoadingMyEventsStatus = false;
  bool _isRegistering = false;

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
      _loadRegistrationDetails(),
      _checkMyEventsStatus(),
    ]);
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

  Future<void> _removeFromMyEvents() async {
    setState(() => _isLoadingMyEventsStatus = true);

    try {
      final success = await MyEventsService.removeFromMyEvents(
        eventId: widget.event.id,
        scope: _myEventsScope,
      );

      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Removed from My Events')),
        );
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
    final cs = Theme.of(context).colorScheme;
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
                style: ElevatedButton.styleFrom(backgroundColor: cs.error),
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

    Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (context) => EventRegistrationPage(
          event: widget.event,
          isUpdate: _registrationSummary!.userRegistrations.isNotEmpty,
          existingRegistrations: _registrationSummary?.userRegistrations,
        ),
      ),
    ).then((result) {
      if (result == true) {
        _loadInitialData();
      }
    });
  }

  Widget _buildCurrentRegistrations() {
    // Don't show the registration container if data hasn't loaded yet
    if (_registrationSummary == null) {
      return const SizedBox.shrink();
    }

    return Card(
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
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    if (_registrationSummary == null) {
      return const CircularProgressIndicator();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.primary,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total Registered:', style: tt.labelLarge?.copyWith(color: cs.onPrimary)),
              Text('${_registrationSummary!.totalRegistrations}', style: tt.labelLarge?.copyWith(color: cs.onPrimary)),
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
    final scopeLabel = registration.scope == 'series' ? 'Recurring' : 'One-time';

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color.fromARGB(255, 142, 163, 168),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.person,
            color: Colors.white,
            size: 20,
          ),
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
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.25),
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
                  style: const TextStyle(
                    fontSize: 11,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          if (!_isRegistering)
            TextButton(
              style: TextButton.styleFrom(
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              ),
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



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('screen-showcase'),
      appBar: AppBar(
        //backgroundColor: cs.surface,
        //foregroundColor: cs.onSurface,
        title: Text(
          widget.event.name,
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
    final cs = Theme.of(context).colorScheme;
    final imageUrl = widget.event.imageUrl != null && widget.event.imageUrl!.isNotEmpty
        ? AssetHelper.getAssetUrl(widget.event.imageUrl!)
        : null;

    return SizedBox(
      height: 250,
      width: double.infinity,
      child: Stack(
        children: [
          // Load image from uploads API endpoint
          // For now, always show placeholder until backend image serving is implemented
          _buildEventThumb(),
          // Action buttons positioned in bottom right
          Positioned(
            bottom: 16,
            right: 16,
            child: _buildActionButtons(),
          ),
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
        label: const Text('Log In', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
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
            (_registrationSummary?.availableSpots ?? 1) > 0
                ? _showRegistrationDialog
                : null,
        icon: const Icon(Icons.person_add, size: 18),
        label: Text(
          (_registrationSummary?.availableSpots ?? 1) > 0
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
          valueColor: AlwaysStoppedAnimation<Color>(Color.fromARGB(255, 142, 163, 168)),
        ),
      );
    }

    if (widget.event.recurring != null) {
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
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 4,
              ),
              child: Text(
                _myEventsScope == 'occurrence'
                    ? 'Switch to Recurring'
                    : 'Switch to One Time',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _removeFromMyEvents,
              style: ElevatedButton.styleFrom(
                backgroundColor: cs.error,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
    final imageUrl = widget.event.imageUrl != null && widget.event.imageUrl!.isNotEmpty
        ? AssetHelper.getAssetUrl(widget.event.imageUrl!)
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
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
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
                "${widget.event.ministry.first}'s Ministry",
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(icon, size: 20, color: cs.primary),
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
                  //color: Colors.grey,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(fontSize: 16),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSvgInfoRow(String assetPath, String label, String value) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SvgPicture.asset(
          assetPath,
          width: 20,
          height: 20,
          colorFilter: ColorFilter.mode(cs.primary, BlendMode.srcIn),
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
                  //color: Colors.grey,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(fontSize: 16),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDescription() {
    return Card(
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
              ),
            ),
            const SizedBox(height: 8),
            Text(
              widget.event.description,
              style: const TextStyle(
                fontSize: 16,
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
    final cs = Theme.of(context).colorScheme;

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
              ),
            ),
            const SizedBox(height: 8),
            ...specs.map(
              (spec) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Icon(
                      Icons.check_circle,
                      size: 16,
                      color: cs.primary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      spec,
                      style: const TextStyle(
                        fontSize: 16,
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
