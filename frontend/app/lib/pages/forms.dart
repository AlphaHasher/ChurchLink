// ignore_for_file: unnecessary_underscores

import 'package:app/helpers/api_client.dart';
import 'package:app/components/auth_popup.dart';
import 'package:app/pages/form_submit.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class Forms extends StatefulWidget {
  const Forms({super.key});

  @override
  State<Forms> createState() => _FormsState();
}

class _FormsState extends State<Forms> {
  bool _isLoading = true;
  String? _error;
  List<dynamic> _forms = [];
  List<dynamic> _filteredForms = [];
  String _searchQuery = '';
  String? _selectedMinistry;

  @override
  void initState() {
    super.initState();
    _maybeLoad();
  }

  void _maybeLoad() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() {
        _isLoading = false;
        _forms = [];
      });
      return;
    }

    await _loadForms();
  }

  Future<void> _loadForms() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Call server-side public endpoint which only returns visible, non-expired forms.
      final response = await api.get('/v1/forms/public');
      if (response.statusCode == 200) {
        final raw = response.data as List<dynamic>;
        setState(() {
          _forms = raw;
          _applyFilters();
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load forms (${response.statusCode})';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Error loading forms: $e';
        _isLoading = false;
      });
    }
  }

  void _applyFilters() {
    List<dynamic> filtered = _forms;

    // Apply search query filter
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered.where((form) {
        final title = (form['title'] ?? '').toString().toLowerCase();
        final description = (form['description'] ?? '').toString().toLowerCase();
        return title.contains(query) || description.contains(query);
      }).toList();
    }

    // Apply ministry filter
    if (_selectedMinistry != null && _selectedMinistry!.isNotEmpty) {
      filtered = filtered.where((form) {
        final ministries = form['ministries'] as List<dynamic>?;
        if (ministries == null || ministries.isEmpty) return false;
        return ministries.any((m) => 
          m.toString().toLowerCase() == _selectedMinistry!.toLowerCase()
        );
      }).toList();
    }

    _filteredForms = filtered;
  }

  Set<String> _getAvailableMinistries() {
    final Set<String> ministries = {};
    for (final form in _forms) {
      final formMinistries = form['ministries'] as List<dynamic>?;
      if (formMinistries != null) {
        for (final ministry in formMinistries) {
          if (ministry != null && ministry.toString().isNotEmpty) {
            ministries.add(ministry.toString());
          }
        }
      }
    }
    return ministries;
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _FormFilterSheet(
        searchQuery: _searchQuery,
        selectedMinistry: _selectedMinistry,
        availableMinistries: _getAvailableMinistries().toList()..sort(),
        onApply: (query, ministry) {
          setState(() {
            _searchQuery = query;
            _selectedMinistry = ministry;
            _applyFilters();
          });
          Navigator.pop(context);
        },
        onClear: () {
          setState(() {
            _searchQuery = '';
            _selectedMinistry = null;
            _applyFilters();
          });
          Navigator.pop(context);
        },
      ),
    );
  }

  bool get _hasActiveFilters =>
      _searchQuery.isNotEmpty || _selectedMinistry != null;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    return Scaffold(
      key: const ValueKey('screen-forms'),
      appBar: AppBar(
        title: const Text('Forms'),
        backgroundColor: Colors.black,
        actions: [
          if (user != null)
            Stack(
              children: [
                IconButton(
                  icon: const Icon(Icons.filter_list),
                  onPressed: _showFilterSheet,
                  tooltip: 'Filter Forms',
                ),
                if (_hasActiveFilters)
                  Positioned(
                    right: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 8,
                        minHeight: 8,
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: user == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.lock_outline,
                        size: 64,
                        color: Colors.grey,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Please sign in to view your forms.',
                        style: TextStyle(fontSize: 16),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () async {
                          await AuthPopup.show(context);
                          // After popup closes, try to load forms (user may have logged in)
                          _maybeLoad();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.black,
                        ),
                        child: const Text('Log In'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadForms,
                  child: _isLoading
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            SizedBox(height: 200),
                            Center(child: CircularProgressIndicator()),
                          ],
                        )
                          : _error != null
                              ? ListView(
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  children: [
                                    SizedBox(
                                      height: 200,
                                      child: Center(child: Text(_error!)),
                                    ),
                                  ],
                                )
                              : _filteredForms.isEmpty
                                  ? ListView(
                                      physics:
                                          const AlwaysScrollableScrollPhysics(),
                                      children: [
                                        const SizedBox(height: 200),
                                        Center(
                                          child: Column(
                                            children: [
                                              Icon(
                                                Icons.inbox_outlined,
                                                size: 64,
                                                color: Colors.grey[600],
                                              ),
                                              const SizedBox(height: 16),
                                              Text(
                                                _hasActiveFilters
                                                    ? 'No forms match your filters.'
                                                    : 'No forms available.',
                                              ),
                                              if (_hasActiveFilters)
                                                Padding(
                                                  padding: const EdgeInsets.only(
                                                      top: 12),
                                                  child: TextButton.icon(
                                                    onPressed: () {
                                                      setState(() {
                                                        _searchQuery = '';
                                                        _selectedMinistry = null;
                                                        _applyFilters();
                                                      });
                                                    },
                                                    icon: const Icon(Icons.clear),
                                                    label: const Text(
                                                        'Clear Filters'),
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    )
                                  : ListView.builder(
                                      physics:
                                          const AlwaysScrollableScrollPhysics(),
                                      itemCount: _filteredForms.length,
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 8.0),
                                      itemBuilder: (context, index) {
                                        final f = _filteredForms[index]
                                            as Map<String, dynamic>;
                                        final title = f['title'] ?? 'Untitled';
                                        final desc = f['description'] ?? '';
                                        final ministries =
                                            f['ministries'] as List<dynamic>?;
                                        return Card(
                                          margin: const EdgeInsets.symmetric(
                                              vertical: 8.0, horizontal: 0),
                                          child: ListTile(
                                            contentPadding:
                                                const EdgeInsets.all(16.0),
                                            title: Text(
                                              title,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .titleMedium
                                                  ?.copyWith(
                                                      fontWeight:
                                                          FontWeight.bold),
                                            ),
                                            subtitle: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                if (desc.isNotEmpty)
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                            top: 8.0),
                                                    child: Text(desc),
                                                  ),
                                                if (ministries != null &&
                                                    ministries.isNotEmpty)
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                            top: 8.0),
                                                    child: Wrap(
                                                      spacing: 6,
                                                      runSpacing: 6,
                                                      children: ministries
                                                          .map(
                                                            (m) => Chip(
                                                              label: Text(
                                                                m.toString(),
                                                                style: const TextStyle(
                                                                    fontSize:
                                                                        11),
                                                              ),
                                                              materialTapTargetSize:
                                                                  MaterialTapTargetSize
                                                                      .shrinkWrap,
                                                              padding:
                                                                  EdgeInsets
                                                                      .zero,
                                                              visualDensity:
                                                                  VisualDensity
                                                                      .compact,
                                                            ),
                                                          )
                                                          .toList(),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                            onTap: () async {
                                              // Open the form submission page
                                              final result =
                                                  await Navigator.of(context)
                                                      .push(
                                                MaterialPageRoute(
                                                  builder: (_) =>
                                                      FormSubmitPage(form: f),
                                                ),
                                              );
                                              // If the user returned from the form page (submission or server-side state change),
                                              // reload the list so expired / hidden forms are removed.
                                              if (result != null) {
                                                _loadForms();
                                              }
                                            },
                                          ),
                                        );
                                      },
                                    ),
                ),
        ),
      ),
    );
  }
}

class _FormFilterSheet extends StatefulWidget {
  const _FormFilterSheet({
    required this.searchQuery,
    required this.selectedMinistry,
    required this.availableMinistries,
    required this.onApply,
    required this.onClear,
  });

  final String searchQuery;
  final String? selectedMinistry;
  final List<String> availableMinistries;
  final void Function(String query, String? ministry) onApply;
  final VoidCallback onClear;

  @override
  State<_FormFilterSheet> createState() => _FormFilterSheetState();
}

class _FormFilterSheetState extends State<_FormFilterSheet> {
  late TextEditingController _searchController;
  String? _selectedMinistry;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: widget.searchQuery);
    _selectedMinistry = widget.selectedMinistry;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: MediaQuery.of(context).viewInsets,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Filter Forms',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                labelText: 'Search',
                hintText: 'Search by title or description',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String?>(
              value: _selectedMinistry,
              decoration: const InputDecoration(
                labelText: 'Ministry',
                prefixIcon: Icon(Icons.church),
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('All ministries'),
                ),
                ...widget.availableMinistries.map(
                  (ministry) => DropdownMenuItem<String?>(
                    value: ministry,
                    child: Text(ministry),
                  ),
                ),
              ],
              onChanged: (value) {
                setState(() {
                  _selectedMinistry = value;
                });
              },
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      _searchController.clear();
                      setState(() {
                        _selectedMinistry = null;
                      });
                      widget.onClear();
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.clear_all),
                    label: const Text('Clear All'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      widget.onApply(
                        _searchController.text.trim(),
                        _selectedMinistry,
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 2,
                    ),
                    icon: const Icon(Icons.check),
                    label: const Text(
                      'Apply Filters',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}