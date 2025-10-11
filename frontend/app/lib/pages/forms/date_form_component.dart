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

  String _formatSubmissionDate(DateTime date) {
    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  DateTime _clampDate(DateTime value, DateTime? min, DateTime? max) {
    var result = value;
    if (min != null && result.isBefore(min)) {
      result = min;
    }
    if (max != null && result.isAfter(max)) {
      result = max;
    }
    return result;
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
            return '$label end date must be on or after start date';
          }
          if (minD != null && fromD.isBefore(minD)) {
            return '$label start date must be on or after ${minD.toIso8601String().split('T').first}';
          }
          if (maxD != null && toD.isAfter(maxD)) {
            return '$label end date must be on or before ${maxD.toIso8601String().split('T').first}';
          }
          return null;
        },
        builder: (state) {
          final v = state.value ?? current;
          final sFrom = v?['from']?.toString();
          final sTo = v?['to']?.toString();
          final formattedFrom = _formatDisplayDate(sFrom);
          final formattedTo = _formatDisplayDate(sTo);
          var minD = _parseDateOnly(field['minDate']?.toString());
          var maxD = _parseDateOnly(field['maxDate']?.toString());
          if (minD != null && maxD != null && minD.isAfter(maxD)) {
            maxD = null;
          }
          final hasRange = formattedFrom != null && formattedTo != null;
          DateTimeRange? initialRange;
          final parsedFrom = _parseDateOnly(sFrom);
          final parsedTo = _parseDateOnly(sTo);
          if (parsedFrom != null) {
            final start = _clampDate(parsedFrom, minD, maxD);
            final end = parsedTo != null ? _clampDate(parsedTo, minD, maxD) : start;
            initialRange = DateTimeRange(start: start, end: end);
          }
          var firstDate = minD ?? DateTime(1900);
          var lastDate = maxD ?? DateTime(2100);
          if (firstDate.isAfter(lastDate)) {
            firstDate = DateTime(1900);
            lastDate = DateTime(2100);
          }
          final hasError = state.hasError;
          final borderColor =
              hasError ? Colors.red.shade400 : Colors.grey.shade300;
          final backgroundColor = hasError ? Colors.red.withOpacity(0.05) : null;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                decoration: BoxDecoration(
                  color: backgroundColor,
                  border: Border.all(color: borderColor),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListTile(
                  title: Text(label),
                  subtitle: Text(
                    hasRange
                        ? '$formattedFrom → $formattedTo'
                        : 'Select date range',
                  ),
                  onTap: () async {
                    final res = await showDateRangePicker(
                      context: context,
                      firstDate: firstDate,
                      lastDate: lastDate,
                      initialDateRange: initialRange,
                    );
                    if (res != null) {
                      final startDate = DateTime(
                        res.start.year,
                        res.start.month,
                        res.start.day,
                      );
                      final endDate = DateTime(
                        res.end.year,
                        res.end.month,
                        res.end.day,
                      );
                      final newVal = {
                        'from': _formatSubmissionDate(startDate),
                        'to': _formatSubmissionDate(endDate),
                      };
                      onChanged(newVal);
                      state.didChange(newVal);
                    }
                  },
                ),
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
            return '$label must be on or after ${minD.toIso8601String().split('T').first}';
          }
          if (maxD != null && d.isAfter(maxD)) {
            return '$label must be on or before ${maxD.toIso8601String().split('T').first}';
          }
          return null;
        },
        builder:
            (state) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Builder(
                  builder: (context) {
                    final hasError = state.hasError;
                    final borderColor =
                        hasError ? Colors.red.shade400 : Colors.grey.shade300;
                    final backgroundColor =
                        hasError ? Colors.red.withOpacity(0.05) : null;
                    final effectiveValue = state.value ?? current;
                    var minD = _parseDateOnly(field['minDate']?.toString());
                    var maxD = _parseDateOnly(field['maxDate']?.toString());
                    if (minD != null && maxD != null && minD.isAfter(maxD)) {
                      maxD = null;
                    }
                    var firstDate = minD ?? DateTime(1900);
                    var lastDate = maxD ?? DateTime(2100);
                    if (firstDate.isAfter(lastDate)) {
                      firstDate = DateTime(1900);
                      lastDate = DateTime(2100);
                    }
                    final initialCandidate =
                        _parseDateOnly(effectiveValue) ?? DateTime.now();
                    final initialDate = _clampDate(initialCandidate, firstDate, lastDate);
                    return Container(
                      decoration: BoxDecoration(
                        color: backgroundColor,
                        border: Border.all(color: borderColor),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: ListTile(
                        title: Text(label),
                        subtitle: Text(
                          _formatDisplayDate(effectiveValue) ?? 'Select date',
                        ),
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: initialDate,
                            firstDate: firstDate,
                            lastDate: lastDate,
                          );
                          if (picked != null) {
                            final normalized = DateTime(
                              picked.year,
                              picked.month,
                              picked.day,
                            );
                            final stored = _formatSubmissionDate(normalized);
                            onChanged(stored);
                            state.didChange(stored);
                          }
                        },
                      ),
                    );
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
