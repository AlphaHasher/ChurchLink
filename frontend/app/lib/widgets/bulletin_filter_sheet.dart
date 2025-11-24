import 'package:flutter/material.dart';
import 'package:app/models/bulletin.dart';
import 'package:app/models/ministry.dart';
import 'package:app/services/ministry_service.dart';

class BulletinFilterSheet extends StatefulWidget {
  const BulletinFilterSheet({super.key, required this.initialFilter});

  final BulletinFilter initialFilter;

  @override
  State<BulletinFilterSheet> createState() => _BulletinFilterSheetState();
}

class _BulletinFilterSheetState extends State<BulletinFilterSheet> {
  late TextEditingController _searchController;
  String? _ministry;
  List<Ministry> _ministries = [];
  bool _isLoadingMinistries = false;

  @override
  void initState() {
    super.initState();
    final filter = widget.initialFilter;
    _searchController = TextEditingController(text: '');
    _ministry = filter.ministry_id;
    _loadMinistries();
  }

  Future<void> _loadMinistries() async {
    setState(() => _isLoadingMinistries = true);
    try {
      final ministries = await MinistryService.getAllMinistries();
      if (mounted) {
        setState(() {
          _ministries = ministries;
        });
      }
    } catch (e) {
      print('Error loading ministries: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoadingMinistries = false);
      }
    }
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
                  'Filter Announcements',
                  style: theme.textTheme.titleMedium?.copyWith(
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
                hintText: 'Title',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String?>(
              initialValue: _ministry?.isNotEmpty == true ? _ministry : null,
              decoration: InputDecoration(
                labelText: 'Ministry',
                prefixIcon: const Icon(Icons.church),
                suffixIcon:
                    _isLoadingMinistries
                        ? const Padding(
                          padding: EdgeInsets.all(12.0),
                          child: SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                        : null,
              ),
              items: <DropdownMenuItem<String?>>[
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('All ministries'),
                ),
                ..._ministries.map(
                  (ministry) => DropdownMenuItem<String?>(
                    value: ministry.id, // Use ministry ID instead of name
                    child: Text(ministry.name), // Display ministry name
                  ),
                ),
              ],
              onChanged: (value) {
                setState(() {
                  _ministry = value;
                });
              },
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      // Reset filter to default and close sheet - this triggers immediate refresh
                      Navigator.of(context).pop(
                        BulletinFilter(
                          skip: 0,
                          limit: widget.initialFilter.limit,
                          published: widget.initialFilter.published,
                          weekStart: widget.initialFilter.weekStart,
                          weekEnd: widget.initialFilter.weekEnd,
                          upcomingOnly: widget.initialFilter.upcomingOnly,
                          // Clear user-controlled filters
                          query: null,
                          ministry_id: null,
                        ),
                      );
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
                    onPressed: _apply,
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

  void _apply() {
    final searchText = _searchController.text.trim();
    // Create new filter preserving system filters (weekStart, weekEnd, upcomingOnly, published)
    // but updating user-controlled filters (query, ministry)
    final filter = BulletinFilter(
      skip: 0, // Reset pagination when applying new filters
      limit: widget.initialFilter.limit,
      query: searchText.isNotEmpty ? searchText : null,
      ministry_id: _ministry?.isNotEmpty == true ? _ministry : null,
      published: widget.initialFilter.published,
      weekStart: widget.initialFilter.weekStart,
      weekEnd: widget.initialFilter.weekEnd,
      upcomingOnly: widget.initialFilter.upcomingOnly,
    );

    Navigator.of(context).pop(filter);
  }
}
