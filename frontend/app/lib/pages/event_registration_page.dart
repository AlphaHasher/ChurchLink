import 'package:flutter/material.dart';
import '../models/event.dart';
import '../models/family_member.dart';
import '../models/event_registration_summary.dart';
import '../services/family_member_service.dart';
import '../services/event_registration_service.dart';
import 'user/family_member_form.dart';
import '../models/profile_info.dart';
import '../caches/user_profile_cache.dart';
import 'package:firebase_auth/firebase_auth.dart';

class EventRegistrationPage extends StatefulWidget {
  final Event event;
  final bool isUpdate;
  final List<RegistrationEntry>? existingRegistrations;

  const EventRegistrationPage({
    super.key,
    required this.event,
    this.isUpdate = false,
    this.existingRegistrations,
  });

  @override
  State<EventRegistrationPage> createState() => _EventRegistrationPageState();
}

class _EventRegistrationPageState extends State<EventRegistrationPage> {
  List<FamilyMember> _allFamilyMembers = [];
  List<FamilyMember> _eligibleFamilyMembers = [];
  final Map<String, FamilyMember?> _selectedPeople = {};
  final Map<String, String> _personScopes =
      {}; // Track scope for each person: "series" or "occurrence"
  final Set<String> _initialSelectedPeopleIds = {};
  bool _isLoading = true;
  bool _isSubmitting = false;
  final Set<String> _invalidPeople = {};
  ProfileInfo? _currentUserProfile;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);

    try {
      // Load current user profile
      final currentUser = FirebaseAuth.instance.currentUser;
      if (currentUser != null) {
        _currentUserProfile = await UserProfileCache.read(currentUser.uid);
      }

      _allFamilyMembers = await FamilyMemberService.getFamilyMembers();

      _eligibleFamilyMembers =
          _allFamilyMembers
              .where((member) => _isEligibleForEvent(member))
              .toList();

      if (widget.isUpdate && widget.existingRegistrations != null) {
        for (final reg in widget.existingRegistrations!) {
          final String personKey;
          if (reg.personId == null) {
            personKey = 'self';
            _selectedPeople['self'] = null;
            _initialSelectedPeopleIds.add('self');
          } else {
            final member = _allFamilyMembers.firstWhere(
              (m) => m.id == reg.personId,
              orElse:
                  () => FamilyMember(
                    id: '',
                    firstName: '',
                    lastName: '',
                    gender: 'M',
                    dateOfBirth: DateTime.now(),
                    createdOn: DateTime.now(),
                  ),
            );
            if (member.id.isNotEmpty) {
              personKey = member.id;
              _selectedPeople[member.id] = member;
              _initialSelectedPeopleIds.add(member.id);
              _validatePerson(member.id, member);
            } else {
              continue;
            }
          }
          // Initialize scope from existing registration
          _personScopes[personKey] = reg.scope;
        }
      }

      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
      _showError('Failed to load family members: $e');
    }
  }

  bool _isEligibleForEvent(FamilyMember member) {
    if (member.age < widget.event.minAge || member.age > widget.event.maxAge) {
      return false;
    }

    if (widget.event.gender.toLowerCase() != 'all') {
      final eventGender = widget.event.gender.toLowerCase();
      final memberGender = member.gender.toLowerCase();

      if (eventGender == 'male' || eventGender == 'm') {
        if (memberGender != 'm' && memberGender != 'male') return false;
      } else if (eventGender == 'female' || eventGender == 'f') {
        if (memberGender != 'f' && memberGender != 'female') return false;
      }
    }

    return true;
  }

  void _validatePerson(String id, FamilyMember? member) {
    if (member == null) {
      _invalidPeople.remove(id);
      return;
    }

    if (!_isEligibleForEvent(member)) {
      _invalidPeople.add(id);
    } else {
      _invalidPeople.remove(id);
    }
  }

  bool _hasChanges() {
    final currentIds = _selectedPeople.keys.toSet();

    // Check if people selection changed
    if (currentIds.length != _initialSelectedPeopleIds.length) {
      return true;
    }
    if (!currentIds.every((id) => _initialSelectedPeopleIds.contains(id))) {
      return true;
    }

    // Check if scope changed for any existing person
    if (widget.isUpdate && widget.existingRegistrations != null) {
      for (final id in currentIds.intersection(_initialSelectedPeopleIds)) {
        final currentScope = _personScopes[id] ?? 'series';
        try {
          final existingReg = widget.existingRegistrations!.firstWhere(
            (r) => (r.personId ?? 'self') == id,
          );
          if (existingReg.scope != currentScope) {
            return true; // Scope changed
          }
        } catch (e) {
          // Person not found in existing registrations, skip
          continue;
        }
      }
    }

    return false;
  }

  Future<void> _handleSubmit() async {
    // For create mode, require at least one person
    // For update mode, allow empty (which means canceling all registrations)
    if (!widget.isUpdate && _selectedPeople.isEmpty) {
      _showError('Please select at least one person to register');
      return;
    }

    if (_invalidPeople.isNotEmpty) {
      _showError('Some selected people are not eligible for this event');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      if (widget.isUpdate) {
        await _handleUpdate();
      } else {
        await _handleCreate();
      }

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _showError('Failed to submit registration: $e');
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _handleCreate() async {
    final results = <String, bool>{};

    for (final entry in _selectedPeople.entries) {
      try {
        bool success;
        final scope = _personScopes[entry.key] ?? 'series'; // Default to series

        if (entry.key == 'self') {
          success = await EventRegistrationService.registerForEvent(
            eventId: widget.event.id,
            scope: scope,
          );
        } else {
          success = await EventRegistrationService.registerForEvent(
            eventId: widget.event.id,
            familyMemberId: entry.key,
            scope: scope,
          );
        }
        results[entry.key] = success;
      } catch (e) {
        results[entry.key] = false;
      }
    }

    final successCount = results.values.where((s) => s).length;
    final totalCount = results.length;

    if (successCount == totalCount) {
      _showSuccess('Successfully registered $successCount people');
    } else {
      _showError('Partial success: $successCount/$totalCount registered');
    }
  }

  Future<void> _handleUpdate() async {
    final existingIds =
        widget.existingRegistrations!.map((r) => r.personId ?? 'self').toSet();
    final selectedIds = _selectedPeople.keys.toSet();

    final toAdd = selectedIds.difference(existingIds);
    final toRemove = existingIds.difference(selectedIds);

    // Check for scope changes (person exists but scope changed)
    final toUpdate = <String>[];
    for (final id in selectedIds.intersection(existingIds)) {
      final currentScope = _personScopes[id] ?? 'series';
      final existingReg = widget.existingRegistrations!.firstWhere(
        (r) => (r.personId ?? 'self') == id,
      );
      if (existingReg.scope != currentScope) {
        toUpdate.add(id);
      }
    }

    // Remove registrations
    for (final id in toRemove) {
      try {
        if (id == 'self') {
          await EventRegistrationService.unregisterFromEvent(
            eventId: widget.event.id,
            scope: null, // Remove all scopes
          );
        } else {
          await EventRegistrationService.unregisterFromEvent(
            eventId: widget.event.id,
            familyMemberId: id,
            scope: null, // Remove all scopes
          );
        }
      } catch (e) {
        debugPrint('Failed to remove $id: $e');
      }
    }

    // Update registrations (remove old scope, add new scope)
    for (final id in toUpdate) {
      try {
        final newScope = _personScopes[id] ?? 'series';
        final existingReg = widget.existingRegistrations!.firstWhere(
          (r) => (r.personId ?? 'self') == id,
        );

        // Remove old scope registration
        if (id == 'self') {
          await EventRegistrationService.unregisterFromEvent(
            eventId: widget.event.id,
            scope: existingReg.scope,
          );
          // Add new scope registration
          await EventRegistrationService.registerForEvent(
            eventId: widget.event.id,
            scope: newScope,
          );
        } else {
          await EventRegistrationService.unregisterFromEvent(
            eventId: widget.event.id,
            familyMemberId: id,
            scope: existingReg.scope,
          );
          // Add new scope registration
          await EventRegistrationService.registerForEvent(
            eventId: widget.event.id,
            familyMemberId: id,
            scope: newScope,
          );
        }
      } catch (e) {
        debugPrint('Failed to update scope for $id: $e');
      }
    }

    // Add new registrations
    for (final id in toAdd) {
      try {
        final scope = _personScopes[id] ?? 'series';
        if (id == 'self') {
          await EventRegistrationService.registerForEvent(
            eventId: widget.event.id,
            scope: scope,
          );
        } else {
          await EventRegistrationService.registerForEvent(
            eventId: widget.event.id,
            familyMemberId: id,
            scope: scope,
          );
        }
      } catch (e) {
        debugPrint('Failed to add $id: $e');
      }
    }

    if (_selectedPeople.isEmpty) {
      _showSuccess('All registrations canceled successfully');
    } else {
      _showSuccess('Registration updated successfully');
    }
  }

  void _removePerson(String id) {
    setState(() {
      _selectedPeople.remove(id);
      _invalidPeople.remove(id);
    });
  }

  void _showSelectPeopleDialog() {
    showDialog(
      context: context,
      builder:
          (context) => _SelectPeopleDialog(
            event: widget.event,
            eligibleMembers: _eligibleFamilyMembers,
            allMembers: _allFamilyMembers,
            selectedIds: _selectedPeople.keys.toSet(),
            onSelectionChanged: (selected) {
              setState(() {
                _selectedPeople.clear();

                for (final id in selected) {
                  if (id == 'self') {
                    _selectedPeople['self'] = null;
                  } else {
                    final member = _allFamilyMembers.firstWhere(
                      (m) => m.id == id,
                    );
                    _selectedPeople[id] = member;
                    _validatePerson(id, member);
                  }

                  // Initialize scope if not already set (default to 'series' for recurring events, 'occurrence' for non-recurring)
                  if (!_personScopes.containsKey(id)) {
                    final isRecurringEvent =
                        widget.event.recurring != null &&
                        widget.event.recurring != 'never';
                    _personScopes[id] =
                        isRecurringEvent ? 'series' : 'occurrence';
                  }
                }
              });
            },
            onFamilyMembersUpdated: () async {
              // Reload family members in the parent
              await _loadInitialData();
            },
          ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isUpdate ? 'Update Registration' : 'Register for Event',
        ),
      ),
      body:
          _isLoading
              ? const Center(child: CircularProgressIndicator())
              : SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildEventSummaryCard(),
                    const SizedBox(height: 24),
                    Text(
                      'Registered People',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_selectedPeople.isEmpty)
                      Card(
                        color: widget.isUpdate ? Colors.orange[50] : null,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              if (widget.isUpdate)
                                Icon(
                                  Icons.warning_amber,
                                  color: Colors.orange[800],
                                  size: 24,
                                ),
                              if (widget.isUpdate) const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  widget.isUpdate
                                      ? 'No people selected. Updating will cancel all registrations for this event.'
                                      : 'No people selected yet. Use the buttons below to add people.',
                                  style: TextStyle(
                                    color:
                                        widget.isUpdate
                                            ? Colors.orange[900]
                                            : Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6),
                                    fontStyle: FontStyle.italic,
                                    fontWeight:
                                        widget.isUpdate
                                            ? FontWeight.w500
                                            : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ..._buildPersonCards(),
                    const SizedBox(height: 24),
                    _buildActionButtons(),
                    const SizedBox(height: 24),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ElevatedButton(
                          onPressed:
                              _isSubmitting ||
                                      (widget.isUpdate && !_hasChanges()) ||
                                      (!widget.isUpdate &&
                                          _selectedPeople.isEmpty)
                                  ? null
                                  : _handleSubmit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color.fromARGB(
                              255,
                              142,
                              163,
                              168,
                            ),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 4,
                          ),
                          child:
                              _isSubmitting
                                  ? const CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  )
                                  : Text(
                                    widget.isUpdate
                                        ? 'Update Registration'
                                        : 'Complete Registration',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                        ),
                        if (!widget.isUpdate && _selectedPeople.isEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              'Please select at least one person to register',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: Theme.of(context).colorScheme.error,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    _buildPaymentPlaceholder(),
                  ],
                ),
              ),
    );
  }

  Widget _buildEventSummaryCard() {
    final cs = Theme.of(context).colorScheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 4,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Event Image
          SizedBox(
            height: 180,
            width: double.infinity,
            child: _buildEventThumb(),
          ),
          // Event Details
          Container(
            color: cs.primaryContainer,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.event.name,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: cs.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.schedule,
                      size: 16,
                      color: cs.onPrimaryContainer,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      widget.event.formattedDateTime,
                      style: TextStyle(color: cs.onPrimaryContainer),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      Icons.location_on,
                      size: 16,
                      color: cs.onPrimaryContainer,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        widget.event.location,
                        style: TextStyle(color: cs.onPrimaryContainer),
                      ),
                    ),
                  ],
                ),
                if (!widget.event.isFree) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.attach_money,
                        size: 16,
                        color: cs.onPrimaryContainer,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '\$${widget.event.price.toStringAsFixed(2)} per person',
                        style: TextStyle(
                          color: cs.onPrimaryContainer,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
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

  Widget _buildEventThumb() {
    if (widget.event.imageUrl == null ||
        widget.event.imageUrl!.trim().isEmpty) {
      return _buildImagePlaceholder();
    } else {
      final url = StrapiHelper.getTrueImageURL(widget.event.imageUrl!);

      return Image.network(
        url,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return _buildImagePlaceholder();
        },
        errorBuilder: (context, error, stackTrace) {
          return _buildImagePlaceholder();
        },
      );
    }
  }

  List<Widget> _buildPersonCards() {
    return _selectedPeople.entries.map((entry) {
      final isInvalid = _invalidPeople.contains(entry.key);
      final isSelf = entry.key == 'self';

      // Build name and age/gender info
      String name;
      String? ageGenderInfo;

      if (isSelf && _currentUserProfile != null) {
        name =
            '${_currentUserProfile!.firstName} ${_currentUserProfile!.lastName} (Myself)';
        int? age;
        if (_currentUserProfile!.birthday != null) {
          final now = DateTime.now();
          age = now.year - _currentUserProfile!.birthday!.year;
          if (now.month < _currentUserProfile!.birthday!.month ||
              (now.month == _currentUserProfile!.birthday!.month &&
                  now.day < _currentUserProfile!.birthday!.day)) {
            age--;
          }
        }
        final gender =
            _currentUserProfile!.gender == "M"
                ? "Male"
                : _currentUserProfile!.gender == "F"
                ? "Female"
                : "Unknown";
        ageGenderInfo =
            age != null ? 'Age: $age • Gender: $gender' : 'Gender: $gender';
      } else if (isSelf) {
        name = 'You (Myself)';
      } else {
        name = entry.value!.fullName;
        ageGenderInfo =
            'Age: ${entry.value!.age} • Gender: ${entry.value!.gender == "M" ? "Male" : "Female"}';
      }

      final isRecurring = _personScopes[entry.key] == 'series';
      final isRecurringEvent =
          widget.event.recurring != null && widget.event.recurring != 'never';

      String? errorMessage;
      if (isInvalid && !isSelf) {
        final member = entry.value!;
        if (member.age < widget.event.minAge ||
            member.age > widget.event.maxAge) {
          errorMessage =
              'Age requirement: ${widget.event.minAge}-${widget.event.maxAge}';
        } else if (widget.event.gender.toLowerCase() != 'all') {
          errorMessage = 'Gender requirement: ${widget.event.gender}';
        }
      }

      return Card(
        color: isInvalid ? Colors.red[50] : null,
        margin: const EdgeInsets.only(bottom: 8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor:
                        isInvalid
                            ? Colors.red
                            : Theme.of(context).colorScheme.primary,
                    child:
                        isSelf
                            ? const Icon(Icons.person, color: Colors.white)
                            : Text(
                              entry.value!.firstName.isNotEmpty
                                  ? entry.value!.firstName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 20,
                              ),
                            ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        if (ageGenderInfo != null) ...[
                          Text(
                            ageGenderInfo,
                            style: const TextStyle(fontSize: 14),
                          ),
                        ],
                        if (errorMessage != null)
                          Text(
                            errorMessage,
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.red),
                    onPressed: () => _removePerson(entry.key),
                  ),
                ],
              ),
              // Recurring checkbox - only show for recurring events
              if (isRecurringEvent) ...[
                const SizedBox(height: 8),
                CheckboxListTile(
                  dense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                  title: Row(
                    children: [
                      Icon(
                        Icons.repeat,
                        size: 18,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Register Recurring',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  subtitle: Text(
                    isRecurring
                        ? 'Registered for all future occurrences'
                        : 'Registered for this occurrence only',
                    style: TextStyle(
                      fontSize: 12,
                      color:
                          isRecurring ? Colors.green[700] : Colors.orange[700],
                    ),
                  ),
                  value: isRecurring,
                  onChanged: (value) {
                    setState(() {
                      _personScopes[entry.key] =
                          value == true ? 'series' : 'occurrence';
                    });
                  },
                ),
              ],
            ],
          ),
        ),
      );
    }).toList();
  }

  Widget _buildActionButtons() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _showSelectPeopleDialog,
        icon: const Icon(Icons.group_add),
        label: const Text(
          'Select People to Register',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color.fromARGB(255, 142, 163, 168),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 4,
        ),
      ),
    );
  }

  Widget _buildPaymentPlaceholder() {
    if (widget.event.isFree) return const SizedBox.shrink();

    return Card(
      color: Colors.amber[50],
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.info_outline, color: Colors.amber[900]),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Payment Coming Soon',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.amber[900],
                    ),
                  ),
                  Text(
                    'Total: \$${(widget.event.price * _selectedPeople.length).toStringAsFixed(2)}',
                    style: TextStyle(color: Colors.amber[900]),
                  ),
                  Text(
                    'Payment functionality will be added in a future update.',
                    style: TextStyle(fontSize: 12, color: Colors.amber[900]),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectPeopleDialog extends StatefulWidget {
  final Event event;
  final List<FamilyMember> eligibleMembers;
  final List<FamilyMember> allMembers;
  final Set<String> selectedIds;
  final Function(Set<String>) onSelectionChanged;
  final Future<void> Function() onFamilyMembersUpdated;

  const _SelectPeopleDialog({
    required this.event,
    required this.eligibleMembers,
    required this.allMembers,
    required this.selectedIds,
    required this.onSelectionChanged,
    required this.onFamilyMembersUpdated,
  });

  @override
  State<_SelectPeopleDialog> createState() => _SelectPeopleDialogState();
}

class _SelectPeopleDialogState extends State<_SelectPeopleDialog> {
  late Set<String> _tempSelection;
  late List<FamilyMember> _eligibleMembers;
  late List<FamilyMember> _allMembers;
  bool _isAddingMember = false;

  @override
  void initState() {
    super.initState();
    _tempSelection = Set.from(widget.selectedIds);
    _eligibleMembers = List.from(widget.eligibleMembers);
    _allMembers = List.from(widget.allMembers);
  }

  bool _isEligibleForEvent(FamilyMember member) {
    if (member.age < widget.event.minAge || member.age > widget.event.maxAge) {
      return false;
    }

    if (widget.event.gender.toLowerCase() != 'all') {
      final eventGender = widget.event.gender.toLowerCase();
      final memberGender = member.gender.toLowerCase();

      if (eventGender == 'male' || eventGender == 'm') {
        if (memberGender != 'm' && memberGender != 'male') return false;
      } else if (eventGender == 'female' || eventGender == 'f') {
        if (memberGender != 'f' && memberGender != 'female') return false;
      }
    }

    return true;
  }

  Future<void> _handleAddFamilyMember() async {
    setState(() => _isAddingMember = true);

    try {
      final result = await Navigator.push<bool>(
        context,
        MaterialPageRoute(builder: (context) => const FamilyMemberForm()),
      );

      if (result == true && mounted) {
        // Notify parent to reload family members
        await widget.onFamilyMembersUpdated();

        // Reload the family members from the service
        final updatedMembers = await FamilyMemberService.getFamilyMembers();

        if (mounted) {
          setState(() {
            _allMembers = updatedMembers;
            _eligibleMembers =
                updatedMembers
                    .where((member) => _isEligibleForEvent(member))
                    .toList();
            _isAddingMember = false;
          });

          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Family member added successfully!')),
          );
        }
      } else if (mounted) {
        setState(() => _isAddingMember = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isAddingMember = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add family member: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Select People'),
      content: SizedBox(
        width: double.maxFinite,
        child: ListView(
          shrinkWrap: true,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: ElevatedButton.icon(
                onPressed: _isAddingMember ? null : _handleAddFamilyMember,
                icon:
                    _isAddingMember
                        ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                        : const Icon(Icons.person_add, size: 18),
                label: const Text(
                  'Add New Family Member',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color.fromARGB(255, 142, 163, 168),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    vertical: 12,
                    horizontal: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
            CheckboxListTile(
              title: const Text('Myself'),
              value: _tempSelection.contains('self'),
              onChanged: (value) {
                setState(() {
                  if (value == true) {
                    _tempSelection.add('self');
                  } else {
                    _tempSelection.remove('self');
                  }
                });
              },
            ),
            const Divider(),
            ..._eligibleMembers.map(
              (member) => CheckboxListTile(
                title: Text(member.fullName),
                subtitle: Text(
                  'Age: ${member.age} • Gender: ${member.gender == "M" ? "Male" : "Female"}',
                ),
                value: _tempSelection.contains(member.id),
                onChanged: (value) {
                  setState(() {
                    if (value == true) {
                      _tempSelection.add(member.id);
                    } else {
                      _tempSelection.remove(member.id);
                    }
                  });
                },
              ),
            ),
            // Show ineligible members section
            if (_allMembers
                .where((m) => !_isEligibleForEvent(m))
                .isNotEmpty) ...[
              const Divider(thickness: 2),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
                child: Text(
                  'Ineligible for this event',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                    fontSize: 12,
                  ),
                ),
              ),
              ..._allMembers.where((m) => !_isEligibleForEvent(m)).map((
                member,
              ) {
                String reason = '';
                if (member.age < widget.event.minAge ||
                    member.age > widget.event.maxAge) {
                  reason =
                      ' (Age ${member.age} not in range: ${widget.event.minAge}-${widget.event.maxAge})';
                } else if (widget.event.gender.toLowerCase() != 'all') {
                  final memberGender = member.gender == "M" ? "Male" : "Female";
                  reason = ' (Event requires: ${widget.event.gender})';
                }

                return ListTile(
                  enabled: false,
                  title: Text(
                    member.fullName,
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  subtitle: Text(
                    'Age: ${member.age} • Gender: ${member.gender == "M" ? "Male" : "Female"}$reason',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            widget.onSelectionChanged(_tempSelection);
            Navigator.of(context).pop();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color.fromARGB(255, 142, 163, 168),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: const Text('Confirm'),
        ),
      ],
    );
  }
}
