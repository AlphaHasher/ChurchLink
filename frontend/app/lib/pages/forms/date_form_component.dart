import 'package:flutter/material.dart';

class DateFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;

  const DateFormComponent({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });

  DateTime? _parseDateOnly(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso);
    if (d == null) return null;
    return DateTime(d.year, d.month, d.day);
  }

  String? _formatDisplayDate(String? iso) {
    final parsed = _parseDateOnly(iso);
    if (parsed == null) return null;
    final day = parsed.day.toString();
    final month = parsed.month.toString();
    final year = parsed.year.toString();
    return '$day/$month/$year';
  }

  @override
  Widget build(BuildContext context) {
    final label = (field['label'] ?? field['name'] ?? '').toString();
    final mode = (field['mode'] ?? 'single').toString();

    if (mode == 'range') {
      final Map<String, dynamic>? current =
          (value as Map?)?.cast<String, dynamic>();
      return FormField<Map<String, dynamic>>(
        initialValue: current,
        validator: (val) {
          final req = field['required'] == true;
          final minD = _parseDateOnly(field['minDate']?.toString());
          final maxD = _parseDateOnly(field['maxDate']?.toString());
          final fromD = _parseDateOnly(val?['from']?.toString());
          final toD = _parseDateOnly(val?['to']?.toString());
          if (req && (fromD == null || toD == null)) return 'Required';
          if (fromD == null || toD == null) return null;
          if (toD.isBefore(fromD)) {
            return 'End date must be on or after start date';
          }
          if (minD != null && fromD.isBefore(minD)) {
            return 'Start must be on or after ${minD.toIso8601String().split('T').first}';
          }
          if (maxD != null && toD.isAfter(maxD)) {
            return 'End must be on or before ${maxD.toIso8601String().split('T').first}';
          }
          return null;
        },
        builder: (state) {
          final v = state.value ?? current;
          final sFrom = v?['from']?.toString();
          final sTo = v?['to']?.toString();
          final formattedFrom = _formatDisplayDate(sFrom);
          final formattedTo = _formatDisplayDate(sTo);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListTile(
                title: Text(label),
                subtitle: Text(
                  formattedFrom != null && formattedTo != null
                      ? '$formattedFrom → $formattedTo'
                      : 'Select date range',
                ),
                onTap: () async {
                  final initial = DateTime.now();
                  final res = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(1900),
                    lastDate: DateTime(2100),
                    initialDateRange:
                        (sFrom != null && sTo != null)
                            ? DateTimeRange(
                              start: DateTime.tryParse(sFrom) ?? initial,
                              end: DateTime.tryParse(sTo) ?? initial,
                            )
                            : null,
                  );
                  if (res != null) {
                    final newVal = {
                      'from':
                          DateTime(
                            res.start.year,
                            res.start.month,
                            res.start.day,
                          ).toIso8601String(),
                      'to':
                          DateTime(
                            res.end.year,
                            res.end.month,
                            res.end.day,
                          ).toIso8601String(),
                    };
                    onChanged(newVal);
                    state.didChange(newVal);
                  }
                },
              ),
              if (state.hasError)
                Padding(
                  padding: const EdgeInsets.only(left: 12.0, top: 4),
                  child: Text(
                    state.errorText ?? '',
                    style: TextStyle(color: Colors.red[700], fontSize: 12),
                  ),
                ),
            ],
          );
        },
      );
    } else {
      final String? current = value?.toString();
      return FormField<String>(
        initialValue: current,
        validator: (val) {
          final req = field['required'] == true;
          if (req && (val == null || val.trim().isEmpty)) return 'Required';
          if (val == null || val.trim().isEmpty) return null;
          final d = _parseDateOnly(val);
          if (d == null) return 'Invalid date';
          final minD = _parseDateOnly(field['minDate']?.toString());
          final maxD = _parseDateOnly(field['maxDate']?.toString());
          if (minD != null && d.isBefore(minD)) {
            return 'Must be on or after ${minD.toIso8601String().split('T').first}';
          }
          if (maxD != null && d.isAfter(maxD)) {
            return 'Must be on or before ${maxD.toIso8601String().split('T').first}';
          }
          return null;
        },
        builder:
            (state) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ListTile(
                  title: Text(label),
                  subtitle: Text(
                    _formatDisplayDate(state.value) ?? 'Select date',
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate:
                          DateTime.tryParse(state.value ?? '') ??
                          DateTime.now(),
                      firstDate: DateTime(1900),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) {
                      final d =
                          DateTime(
                            picked.year,
                            picked.month,
                            picked.day,
                          ).toIso8601String();
                      onChanged(d);
                      state.didChange(d);
                    }
                  },
                ),
                if (state.hasError)
                  Padding(
                    padding: const EdgeInsets.only(left: 12.0, top: 4),
                    child: Text(
                      state.errorText ?? '',
                      style: TextStyle(color: Colors.red[700], fontSize: 12),
                    ),
                  ),
              ],
            ),
      );
    }
  }
}
