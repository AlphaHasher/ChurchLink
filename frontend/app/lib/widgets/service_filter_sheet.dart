import 'package:flutter/material.dart';

/// Filter options for service bulletins
class ServiceFilterOptions {
  final String? dayOfWeek; // null = all days
  final String?
  timeRange; // null = all times, 'morning', 'afternoon', 'evening'
  final String? titleQuery; // Search query for service titles

  const ServiceFilterOptions({this.dayOfWeek, this.timeRange, this.titleQuery});

  ServiceFilterOptions copyWith({
    String? dayOfWeek,
    String? timeRange,
    String? titleQuery,
  }) {
    return ServiceFilterOptions(
      dayOfWeek: dayOfWeek ?? this.dayOfWeek,
      timeRange: timeRange ?? this.timeRange,
      titleQuery: titleQuery ?? this.titleQuery,
    );
  }
}

/// Bottom sheet for filtering service bulletins
class ServiceFilterSheet extends StatefulWidget {
  const ServiceFilterSheet({super.key, required this.initialFilter});

  final ServiceFilterOptions initialFilter;

  @override
  State<ServiceFilterSheet> createState() => _ServiceFilterSheetState();
}

class _ServiceFilterSheetState extends State<ServiceFilterSheet> {
  late TextEditingController _searchController;
  String? _selectedDay;
  String? _selectedTimeRange;

  static const List<String> _daysOfWeek = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  static const Map<String, String> _timeRanges = {
    'morning': 'Morning (6AM - 12PM)',
    'afternoon': 'Afternoon (12PM - 6PM)',
    'evening': 'Evening (6PM - 12AM)',
  };

  @override
  void initState() {
    super.initState();
    final filter = widget.initialFilter;
    _searchController = TextEditingController(text: filter.titleQuery ?? '');
    _selectedDay = filter.dayOfWeek;
    _selectedTimeRange = filter.timeRange;
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
                  'Filter Services',
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

            // Search by title
            TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                labelText: 'Search',
                hintText: 'Service title',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 16),

            // Day of week filter
            DropdownButtonFormField<String?>(
              value: _selectedDay,
              decoration: const InputDecoration(
                labelText: 'Day of Week',
                prefixIcon: Icon(Icons.calendar_today),
              ),
              items: <DropdownMenuItem<String?>>[
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('All days'),
                ),
                ..._daysOfWeek.map(
                  (day) =>
                      DropdownMenuItem<String?>(value: day, child: Text(day)),
                ),
              ],
              onChanged: (value) {
                setState(() {
                  _selectedDay = value;
                });
              },
            ),
            const SizedBox(height: 16),

            // Time range filter
            DropdownButtonFormField<String?>(
              value: _selectedTimeRange,
              decoration: const InputDecoration(
                labelText: 'Time of Day',
                prefixIcon: Icon(Icons.access_time),
              ),
              items: <DropdownMenuItem<String?>>[
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('All times'),
                ),
                ..._timeRanges.entries.map(
                  (entry) => DropdownMenuItem<String?>(
                    value: entry.key,
                    child: Text(entry.value),
                  ),
                ),
              ],
              onChanged: (value) {
                setState(() {
                  _selectedTimeRange = value;
                });
              },
            ),
            const SizedBox(height: 24),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      // Reset all filters and close
                      Navigator.of(context).pop(const ServiceFilterOptions());
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
    final filter = ServiceFilterOptions(
      dayOfWeek: _selectedDay,
      timeRange: _selectedTimeRange,
      titleQuery: searchText.isNotEmpty ? searchText : null,
    );

    Navigator.of(context).pop(filter);
  }
}
