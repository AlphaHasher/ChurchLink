import 'package:flutter/material.dart';

class TimeFormComponent extends StatelessWidget {
  final Map<String, dynamic> field;
  final String? value;
  final ValueChanged<String?> onChanged;

  const TimeFormComponent({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });

  TimeOfDay? _parseTimeOfDay(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final s = raw.trim();
    final m24 = RegExp(r"^([01]?\d|2[0-3]):([0-5]\d)$");
    final m12 = RegExp(r"^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$");
    var match = m24.firstMatch(s);
    if (match != null) {
      final h = int.tryParse(match.group(1)!);
      final m = int.tryParse(match.group(2)!);
      if (h != null && m != null) return TimeOfDay(hour: h, minute: m);
    }
    match = m12.firstMatch(s);
    if (match != null) {
      var h = int.tryParse(match.group(1)!);
      final m = int.tryParse(match.group(2)!);
      final ampm = match.group(3)!.toUpperCase();
      if (h != null && m != null) {
        if (ampm == 'AM') {
          if (h == 12) h = 0;
        } else {
          if (h != 12) h = h + 12;
        }
        return TimeOfDay(hour: h, minute: m);
      }
    }
    return null;
  }

  String _formatHHMM(TimeOfDay t) {
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  int? _hhmmToMinutes(String? hhmm) {
    if (hhmm == null || hhmm.trim().isEmpty) return null;
    final m = RegExp(r'^([01]?\d|2[0-3]):([0-5]\d)$').firstMatch(hhmm.trim());
    if (m == null) return null;
    final h = int.tryParse(m.group(1)!);
    final min = int.tryParse(m.group(2)!);
    if (h == null || min == null) return null;
    return h * 60 + min;
  }

  @override
  Widget build(BuildContext context) {
    final label = (field['label'] ?? field['name'] ?? '').toString();
    final minTime = (field['minTime'] ?? field['min'])?.toString();
    final maxTime = (field['maxTime'] ?? field['max'])?.toString();

    return FormField<String>(
      initialValue: value,
      validator: (val) {
        final req = field['required'] == true;
        if (req && (val == null || val.trim().isEmpty)) return 'Required';
        if (val == null || val.trim().isEmpty) return null;
        if (_hhmmToMinutes(val) == null) return 'Invalid time';
        final vMin = _hhmmToMinutes(minTime);
        final vMax = _hhmmToMinutes(maxTime);
        final v = _hhmmToMinutes(val)!;
        if (vMin != null && v < vMin) {
          return 'Must be on or after $minTime';
        }
        if (vMax != null && v > vMax) {
          return 'Must be on or before $maxTime';
        }
        return null;
      },
      builder: (state) {
        final initialTod = _parseTimeOfDay(state.value) ?? TimeOfDay.now();
        final display =
            (state.value != null && state.value!.isNotEmpty)
                ? state.value!
                : 'Select time';
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              title: Text(label),
              subtitle: Text(display),
              onTap: () async {
                final picked = await showTimePicker(
                  context: context,
                  initialTime: initialTod,
                );
                if (picked != null) {
                  final formatted = _formatHHMM(picked);
                  onChanged(formatted);
                  state.didChange(formatted);
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
  }
}
