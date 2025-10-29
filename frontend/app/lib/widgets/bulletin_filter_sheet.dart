import 'package:flutter/material.dart';
import 'package:app/models/bulletin.dart';

class BulletinFilterSheet extends StatefulWidget {
  const BulletinFilterSheet({super.key, required this.initialFilter});

  final BulletinFilter initialFilter;

  static const List<String> ministryOptions = <String>[
    'Adults',
    'Youth',
    'Kids',
    'Worship',
    'Family',
    'Education',
    'Outreach',
  ];

  @override
  State<BulletinFilterSheet> createState() => _BulletinFilterSheetState();
}

class _BulletinFilterSheetState extends State<BulletinFilterSheet> {
  late TextEditingController _searchController;
  String? _ministry;

  @override
  void initState() {
    super.initState();
    final filter = widget.initialFilter;
    _searchController = TextEditingController(text: '');
    _ministry = filter.ministry;
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
                hintText: 'Headline',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String?>(
              initialValue: _ministry?.isNotEmpty == true ? _ministry : null,
              decoration: const InputDecoration(
                labelText: 'Ministry',
                prefixIcon: Icon(Icons.church),
              ),
              items: <DropdownMenuItem<String?>>[
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('All ministries'),
                ),
                ...BulletinFilterSheet.ministryOptions.map(
                  (ministry) => DropdownMenuItem<String?>(
                    value: ministry,
                    child: Text(ministry),
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
                  child: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _searchController.clear();
                        _ministry = null;
                      });
                    },
                    child: const Text('Clear'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _apply,
                    child: const Text('Apply'),
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
      ministry: _ministry?.isNotEmpty == true ? _ministry : null,
      published: widget.initialFilter.published,
      weekStart: widget.initialFilter.weekStart,
      weekEnd: widget.initialFilter.weekEnd,
      upcomingOnly: widget.initialFilter.upcomingOnly,
    );

    Navigator.of(context).pop(filter);
  }
}
