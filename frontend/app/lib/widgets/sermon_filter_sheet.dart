import 'package:app/models/sermon_filter.dart';
import 'package:flutter/material.dart';

class SermonFilterSheet extends StatefulWidget {
  const SermonFilterSheet({super.key, required this.initialFilter});

  final SermonFilter initialFilter;

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
  State<SermonFilterSheet> createState() => _SermonFilterSheetState();
}

class _SermonFilterSheetState extends State<SermonFilterSheet> {
  late TextEditingController _searchController;
  late TextEditingController _speakerController;
  String? _ministry;
  bool _favoritesOnly = false;
  DateTime? _dateAfter;
  DateTime? _dateBefore;

  @override
  void initState() {
    super.initState();
    final filter = widget.initialFilter;
    _searchController = TextEditingController(text: filter.query ?? '');
    _speakerController = TextEditingController(text: filter.speaker ?? '');
    _ministry = filter.ministry;
    _favoritesOnly = filter.favoritesOnly;
    _dateAfter = filter.dateAfter;
    _dateBefore = filter.dateBefore;
  }

  @override
  void dispose() {
    _searchController.dispose();
    _speakerController.dispose();
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
                  'Filter Sermons',
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
                hintText: 'Title, summary, or description',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _speakerController,
              decoration: const InputDecoration(
                labelText: 'Speaker',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String?>(
              value: _ministry?.isNotEmpty == true ? _ministry : null,
              decoration: const InputDecoration(
                labelText: 'Ministry',
                prefixIcon: Icon(Icons.church),
              ),
              items: <DropdownMenuItem<String?>>[
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('All ministries'),
                ),
                ...SermonFilterSheet.ministryOptions.map(
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
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _DateField(
                    label: 'After',
                    value: _dateAfter,
                    onSelected: (date) => setState(() => _dateAfter = date),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _DateField(
                    label: 'Before',
                    value: _dateBefore,
                    onSelected: (date) => setState(() => _dateBefore = date),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _dateAfter = null;
                        _dateBefore = null;
                      });
                    },
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reset dates'),
                  ),
                ),
              ],
            ),
            SwitchListTile.adaptive(
              title: const Text('Favorites only'),
              subtitle: const Text('Show only sermons you have favorited'),
              value: _favoritesOnly,
              onChanged: (value) => setState(() => _favoritesOnly = value),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _searchController.clear();
                        _speakerController.clear();
                        _ministry = null;
                        _favoritesOnly = false;
                        _dateAfter = null;
                        _dateBefore = null;
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
    final filter = widget.initialFilter.copyWith(
      query:
          _searchController.text.trim().isNotEmpty
              ? _searchController.text.trim()
              : null,
      speaker:
          _speakerController.text.trim().isNotEmpty
              ? _speakerController.text.trim()
              : null,
      ministry: _ministry?.isNotEmpty == true ? _ministry : null,
      dateAfter: _dateAfter,
      dateBefore: _dateBefore,
      favoritesOnly: _favoritesOnly,
    );

    Navigator.of(context).pop(filter);
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onSelected,
  });

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onSelected;

  @override
  Widget build(BuildContext context) {
    final formatted = value != null ? _format(value!) : 'Any';
    return OutlinedButton(
      onPressed: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime(2000),
          lastDate: DateTime(2100),
        );
        onSelected(picked);
      },
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        alignment: Alignment.centerLeft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 4),
          Text(
            formatted,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  String _format(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}
