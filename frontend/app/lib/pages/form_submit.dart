import 'package:app/helpers/api_client.dart';
import 'package:flutter/material.dart';

class FormSubmitPage extends StatefulWidget {
  final Map<String, dynamic> form;

  const FormSubmitPage({super.key, required this.form});

  @override
  State<FormSubmitPage> createState() => _FormSubmitPageState();
}

class _FormSubmitPageState extends State<FormSubmitPage> {
  final _formKey = GlobalKey<FormState>();
  final Map<String, dynamic> _values = {};
  bool _submitting = false;
  String? _error;

  // Helper to extract field list from form
  List<Map<String, dynamic>> get _fields {
    final data = widget.form['data'];
    if (data is List) return List<Map<String, dynamic>>.from(data);
    return [];
  }

  // Basic visibleIf evaluator similar to web: `name op value` where op in == != >= <= > <
  bool _isVisible(Map<String, dynamic> f) {
    final raw = (f['visibleIf'] ?? '').toString().trim();
    if (raw.isEmpty) return true;
    final reg = RegExp(r'^\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)\s*$');
    final m = reg.firstMatch(raw);
    if (m == null) return true;
    final name = m.group(1)!;
    final op = m.group(2)!;
    final rhsRaw = m.group(3)!;
    final lhs = _values[name];
    dynamic rhs;
    final s = rhsRaw.trim();
    if ((s.startsWith("'") && s.endsWith("'")) ||
        (s.startsWith('"') && s.endsWith('"'))) {
      rhs = s.substring(1, s.length - 1);
    } else if (s.toLowerCase() == 'true' || s.toLowerCase() == 'false') {
      rhs = s.toLowerCase() == 'true';
    } else {
      rhs = double.tryParse(s) ?? s; // fallback to string
    }
    int cmp(dynamic a, dynamic b) {
      if (a is num && b is num) return a.compareTo(b);
      return a.toString().compareTo(b.toString());
    }

    switch (op) {
      case '==':
        return lhs == rhs;
      case '!=':
        return lhs != rhs;
      case '>=':
        return cmp(lhs, rhs) >= 0;
      case '<=':
        return cmp(lhs, rhs) <= 0;
      case '>':
        return cmp(lhs, rhs) > 0;
      case '<':
        return cmp(lhs, rhs) < 0;
      default:
        return true;
    }
  }

  bool _hasPricing() {
    for (final f in _fields) {
      final type = (f['type'] ?? 'text').toString();
      if (type == 'price') return true;
      if ((type == 'checkbox' || type == 'switch') && (f['price'] != null)) {
        return true;
      }
      if (type == 'radio' || type == 'select') {
        final options = (f['options'] ?? f['choices'] ?? []) as List?;
        if (options != null &&
            options.any((o) => (o is Map && o['price'] != null))) {
          return true;
        }
      }
      if (type == 'date') {
        final pricing = f['pricing'];
        if (pricing is Map && (pricing['enabled'] == true)) return true;
      }
    }
    return false;
  }

  double _weekdayPrice(Map<String, dynamic> pricing, DateTime d) {
    final specific =
        (pricing['specificDates'] as List?)?.cast<Map<String, dynamic>>();
    if (specific != null) {
      final key =
          "${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";
      for (final item in specific) {
        if (item['date'] == key && item['price'] is num) {
          return (item['price'] as num).toDouble();
        }
      }
    }
    final dow = d.weekday % 7; // Dart: Mon=1..Sun=7; mod7 -> Sun=0..Sat=6
    final overrides = pricing['weekdayOverrides'];
    if (overrides is Map) {
      // keys might be strings '0'..'6' or ints
      final dynamic v = overrides[dow.toString()] ?? overrides[dow];
      if (v is num) return v.toDouble();
    }
    final base = pricing['basePerDay'];
    if (base is num) return base.toDouble();
    return 0.0;
  }

  double _computeTotal() {
    double total = 0.0;
    for (final f in _fields) {
      if (!_isVisible(f)) continue;
      final type = (f['type'] ?? 'text').toString();
      final name =
          (f['name'] ?? f['key'] ?? f['id'] ?? f['label'] ?? '').toString();
      final val = _values[name];
      if (type == 'price') {
        final amt = f['amount'];
        if (amt is num) total += amt.toDouble();
      } else if (type == 'checkbox' || type == 'switch') {
        if ((val == true) && f['price'] is num) {
          total += (f['price'] as num).toDouble();
        }
      } else if (type == 'radio') {
        final options = (f['options'] ?? f['choices'] ?? []) as List?;
        if (options != null) {
          final opt = options.cast<Map>().firstWhere(
            (o) =>
                (o['value'] ?? o['id'] ?? o['label']).toString() ==
                (val?.toString() ?? ''),
            orElse: () => {},
          );
          final p = opt['price'];
          if (p is num) total += p.toDouble();
        }
      } else if (type == 'select') {
        final options = (f['options'] ?? f['choices'] ?? []) as List?;
        final multiple = f['multiple'] == true;
        if (options != null) {
          if (multiple && val is List) {
            for (final v in val) {
              final opt = options.cast<Map>().firstWhere(
                (o) =>
                    (o['value'] ?? o['id'] ?? o['label']).toString() ==
                    v.toString(),
                orElse: () => {},
              );
              final p = opt['price'];
              if (p is num) total += p.toDouble();
            }
          } else if (val is String) {
            final opt = options.cast<Map>().firstWhere(
              (o) => (o['value'] ?? o['id'] ?? o['label']).toString() == val,
              orElse: () => {},
            );
            final p = opt['price'];
            if (p is num) total += p.toDouble();
          }
        }
      } else if (type == 'date') {
        final pricing = f['pricing'];
        if (pricing is Map && pricing['enabled'] == true) {
          if (f['mode'] == 'range') {
            if (val is Map && val['from'] != null && val['to'] != null) {
              final from = DateTime.tryParse(val['from'].toString());
              final to = DateTime.tryParse(val['to'].toString());
              if (from != null && to != null) {
                for (
                  DateTime d = DateTime(from.year, from.month, from.day);
                  !d.isAfter(DateTime(to.year, to.month, to.day));
                  d = d.add(const Duration(days: 1))
                ) {
                  total += _weekdayPrice(pricing.cast<String, dynamic>(), d);
                }
              }
            } else if (val is Map && val['from'] != null) {
              final from = DateTime.tryParse(val['from'].toString());
              if (from != null) {
                total += _weekdayPrice(pricing.cast<String, dynamic>(), from);
              }
            }
          } else {
            final d = val is String ? DateTime.tryParse(val) : null;
            if (d != null) {
              total += _weekdayPrice(pricing.cast<String, dynamic>(), d);
            }
          }
        }
      }
    }
    return total;
  }

  // Parse a time string that may be in "HH:MM" (24h) or "h:MM AM/PM" to TimeOfDay.
  TimeOfDay? _parseTimeOfDay(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final s = raw.trim();
    // 24-hour HH:MM
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
          if (h == 12) h = 0; // 12 AM -> 00
        } else {
          if (h != 12) h = h + 12; // add 12 for PM except 12 PM
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

  Widget _buildField(Map<String, dynamic> f) {
    if (!_isVisible(f)) return const SizedBox.shrink();
    final type = (f['type'] ?? 'text').toString();
    final fieldName =
        (f['name'] ??
                f['key'] ??
                f['id'] ??
                f['label'] ??
                UniqueKey().toString())
            .toString();
    final label = f['label'] ?? f['name'] ?? '';
    final required = f['required'] == true;

    switch (type) {
      case 'static':
        final as = (f['as'] ?? 'p').toString();
        TextStyle style = const TextStyle(fontSize: 14);
        if (as == 'h1') {
          style = const TextStyle(fontSize: 22, fontWeight: FontWeight.bold);
        } else if (as == 'h2') {
          style = const TextStyle(fontSize: 18, fontWeight: FontWeight.w600);
        } else if (as == 'small') {
          style = const TextStyle(fontSize: 12, color: Colors.grey);
        }
        final content = (f['content'] ?? label ?? '').toString();
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6.0),
          child: Text(content, style: style),
        );

      case 'price':
        return const SizedBox.shrink();

      case 'textarea':
        return TextFormField(
          initialValue: _values[fieldName]?.toString(),
          decoration: InputDecoration(labelText: label),
          maxLines: 4,
          validator:
              required
                  ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
                  : null,
          onSaved: (v) => _values[fieldName] = v ?? '',
        );

      case 'email':
        return TextFormField(
          initialValue: _values[fieldName]?.toString(),
          decoration: InputDecoration(labelText: label),
          keyboardType: TextInputType.emailAddress,
          validator: (v) {
            if (required && (v == null || v.trim().isEmpty)) return 'Required';
            if (v != null &&
                v.isNotEmpty &&
                !RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").hasMatch(v))
              return 'Invalid email';
            return null;
          },
          onSaved: (v) => _values[fieldName] = v ?? '',
        );

      case 'number':
        return TextFormField(
          initialValue: _values[fieldName]?.toString(),
          decoration: InputDecoration(labelText: label),
          keyboardType: TextInputType.number,
          validator: (v) {
            if (required && (v == null || v.trim().isEmpty)) return 'Required';
            if (v != null && v.isNotEmpty && double.tryParse(v) == null)
              return 'Invalid number';
            if (v != null && v.isNotEmpty) {
              final n = double.tryParse(v);
              if (n != null) {
                final min = (f['min'] is num) ? (f['min'] as num).toDouble() : null;
                final max = (f['max'] is num) ? (f['max'] as num).toDouble() : null;
                if (min != null && n < min) {
                  final dec = min.truncateToDouble() == min ? 0 : 2;
                  return 'Must be ≥ ${min.toStringAsFixed(dec)}';
                }
                if (max != null && n > max) {
                  final dec = max.truncateToDouble() == max ? 0 : 2;
                  return 'Must be ≤ ${max.toStringAsFixed(dec)}';
                }
                if (f['allowedValues'] is String) {
                  final allowed = (f['allowedValues'] as String)
                      .split(',')
                      .map((s) => s.trim())
                      .where((s) => s.isNotEmpty)
                      .map((s) => double.tryParse(s))
                      .where((x) => x != null)
                      .map((x) => x!)
                      .toList();
                  if (allowed.isNotEmpty && !allowed.contains(n)) {
                    final fmt = allowed
                        .map((x) => x.truncateToDouble() == x ? x.toStringAsFixed(0) : x.toString())
                        .join(', ');
                    return 'Must be one of: $fmt';
                  }
                }
              }
            }
            return null;
          },
          onSaved:
              (v) =>
                  _values[fieldName] =
                      v != null && v.isNotEmpty ? double.tryParse(v) : null,
        );

      case 'checkbox':
        final bool current = _values[fieldName] == true;
        return CheckboxListTile(
          value: current,
          title: Text(label),
          controlAffinity: ListTileControlAffinity.leading,
          onChanged: (val) => setState(() => _values[fieldName] = val ?? false),
        );

      case 'switch':
        final bool current = _values[fieldName] == true;
        return SwitchListTile(
          value: current,
          title: Text(label),
          onChanged: (val) => setState(() => _values[fieldName] = val),
        );

      case 'select':
        final List options = f['options'] ?? f['choices'] ?? [];
        final bool multiple = f['multiple'] == true;
        if (multiple) {
          final List<String> current =
              (_values[fieldName] as List?)
                  ?.map((e) => e.toString())
                  .toList() ??
              [];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if ((label?.toString() ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(label.toString()),
                ),
              Wrap(
                spacing: 6,
                runSpacing: -8,
                children:
                    current.isEmpty
                        ? [const Chip(label: Text('None selected'))]
                        : current.map((v) => Chip(label: Text(v))).toList(),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () async {
                    final selected = Set<String>.from(current);
                    final updated = await showDialog<List<String>>(
                      context: context,
                      builder: (ctx) {
                        return AlertDialog(
                          title: Text('Select ${label.toString()}'),
                          content: SizedBox(
                            width: double.maxFinite,
                            child: ListView(
                              shrinkWrap: true,
                              children:
                                  options.map<Widget>((opt) {
                                    final val =
                                        (opt is Map
                                                ? (opt['value'] ??
                                                    opt['id'] ??
                                                    opt['label'])
                                                : opt)
                                            .toString();
                                    final display =
                                        (opt is Map
                                                ? (opt['label'] ??
                                                    opt['value'] ??
                                                    opt['id'] ??
                                                    opt)
                                                : opt)
                                            .toString();
                                    final checked = selected.contains(val);
                                    return CheckboxListTile(
                                      value: checked,
                                      title: Text(display),
                                      onChanged: (v) {
                                        if (v == true) {
                                          selected.add(val);
                                        } else {
                                          selected.remove(val);
                                        }
                                        // ignore: invalid_use_of_protected_member
                                        (ctx as Element).markNeedsBuild();
                                      },
                                    );
                                  }).toList(),
                            ),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx),
                              child: const Text('Cancel'),
                            ),
                            ElevatedButton(
                              onPressed:
                                  () => Navigator.pop(ctx, selected.toList()),
                              child: const Text('OK'),
                            ),
                          ],
                        );
                      },
                    );
                    if (updated != null)
                      setState(() => _values[fieldName] = updated);
                  },
                  child: const Text('Choose'),
                ),
              ),
            ],
          );
        } else {
          final current = _values[fieldName]?.toString();
          return DropdownButtonFormField<String>(
            initialValue: current?.isNotEmpty == true ? current : null,
            decoration: InputDecoration(labelText: label.toString()),
            validator:
                required
                    ? (v) => (v == null || v.isEmpty) ? 'Required' : null
                    : null,
            items:
                options.map<DropdownMenuItem<String>>((opt) {
                  final val =
                      (opt is Map
                              ? (opt['value'] ?? opt['id'] ?? opt['label'])
                              : opt)
                          .toString();
                  final display =
                      (opt is Map
                              ? (opt['label'] ??
                                  opt['value'] ??
                                  opt['id'] ??
                                  opt)
                              : opt)
                          .toString();
                  return DropdownMenuItem<String>(
                    value: val,
                    child: Text(display),
                  );
                }).toList(),
            onChanged: (v) => setState(() => _values[fieldName] = v),
          );
        }

      case 'radio':
        final List options = f['options'] ?? f['choices'] ?? [];
        final String? current = _values[fieldName]?.toString();
        return FormField<String>(
          initialValue: current,
          validator:
              required
                  ? (v) => (v == null || v.isEmpty) ? 'Required' : null
                  : null,
          builder:
              (state) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (label.isNotEmpty) Text(label),
                  ...options.map<Widget>((opt) {
                    final val =
                        opt is Map
                            ? (opt['value'] ?? opt['id'] ?? opt['label'])
                            : opt;
                    final display =
                        opt is Map
                            ? (opt['label'] ??
                                opt['value'] ??
                                opt['id'] ??
                                opt.toString())
                            : opt.toString();
                    return ListTile(
                      leading: Radio<String>(
                        value: val.toString(),
                        groupValue: state.value,
                        onChanged: (v) {
                          state.didChange(v);
                          _values[fieldName] = v;
                        },
                      ),
                      title: Text(display.toString()),
                      onTap: () {
                        state.didChange(val.toString());
                        _values[fieldName] = val.toString();
                      },
                    );
                  }),
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

      case 'date':
        final mode = (f['mode'] ?? 'single').toString();
        if (mode == 'range') {
          final Map<String, dynamic>? current = (_values[fieldName] as Map?)?.cast<String, dynamic>();
          return FormField<Map<String, dynamic>>(
            initialValue: current,
            validator: (val) {
              final req = f['required'] == true;
              DateTime? parseDateOnly(String? iso) {
                if (iso == null || iso.isEmpty) return null;
                final d = DateTime.tryParse(iso);
                if (d == null) return null;
                return DateTime(d.year, d.month, d.day);
              }
              final minD = parseDateOnly(f['minDate']?.toString());
              final maxD = parseDateOnly(f['maxDate']?.toString());
              final fromD = parseDateOnly(val?['from']?.toString());
              final toD = parseDateOnly(val?['to']?.toString());
              if (req && (fromD == null || toD == null)) return 'Required';
              if (fromD == null || toD == null) return null;
              if (toD.isBefore(fromD)) return 'End date must be on or after start date';
              if (minD != null && fromD.isBefore(minD)) return 'Start must be on or after ${minD.toIso8601String().split('T').first}';
              if (maxD != null && toD.isAfter(maxD)) return 'End must be on or before ${maxD.toIso8601String().split('T').first}';
              return null;
            },
            builder: (state) {
              final v = state.value ?? current;
              final sFrom = v?['from']?.toString();
              final sTo = v?['to']?.toString();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ListTile(
                    title: Text(label),
                    subtitle: Text(
                      sFrom != null && sTo != null
                          ? '${sFrom.split('T').first} → ${sTo.split('T').first}'
                          : 'Select date range',
                    ),
                    onTap: () async {
                      final initial = DateTime.now();
                      final res = await showDateRangePicker(
                        context: context,
                        firstDate: DateTime(1900),
                        lastDate: DateTime(2100),
                        initialDateRange: (sFrom != null && sTo != null)
                            ? DateTimeRange(
                                start: DateTime.tryParse(sFrom) ?? initial,
                                end: DateTime.tryParse(sTo) ?? initial,
                              )
                            : null,
                      );
                      if (res != null) {
                        final newVal = {
                          'from': DateTime(res.start.year, res.start.month, res.start.day).toIso8601String(),
                          'to': DateTime(res.end.year, res.end.month, res.end.day).toIso8601String(),
                        };
                        setState(() => _values[fieldName] = newVal);
                        state.didChange(newVal);
                      }
                    },
                  ),
                  if (state.hasError)
                    Padding(
                      padding: const EdgeInsets.only(left: 12.0, top: 4),
                      child: Text(state.errorText ?? '', style: TextStyle(color: Colors.red[700], fontSize: 12)),
                    ),
                ],
              );
            },
          );
        } else {
          final String? current = _values[fieldName]?.toString();
          return FormField<String>(
            initialValue: current,
            validator: (val) {
              final req = f['required'] == true;
              if (req && (val == null || val.trim().isEmpty)) return 'Required';
              if (val == null || val.trim().isEmpty) return null;
              DateTime? parseDateOnly(String? iso) {
                if (iso == null || iso.isEmpty) return null;
                final d = DateTime.tryParse(iso);
                if (d == null) return null;
                return DateTime(d.year, d.month, d.day);
              }
              final d = parseDateOnly(val);
              if (d == null) return 'Invalid date';
              final minD = parseDateOnly(f['minDate']?.toString());
              final maxD = parseDateOnly(f['maxDate']?.toString());
              if (minD != null && d.isBefore(minD)) return 'Must be on or after ${minD.toIso8601String().split('T').first}';
              if (maxD != null && d.isAfter(maxD)) return 'Must be on or before ${maxD.toIso8601String().split('T').first}';
              return null;
            },
            builder: (state) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ListTile(
                  title: Text(label),
                  subtitle: Text(state.value ?? 'Select date'),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.tryParse(state.value ?? '') ?? DateTime.now(),
                      firstDate: DateTime(1900),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) {
                      final d = DateTime(picked.year, picked.month, picked.day).toIso8601String();
                      setState(() => _values[fieldName] = d);
                      state.didChange(d);
                    }
                  },
                ),
                if (state.hasError)
                  Padding(
                    padding: const EdgeInsets.only(left: 12.0, top: 4),
                    child: Text(state.errorText ?? '', style: TextStyle(color: Colors.red[700], fontSize: 12)),
                  ),
              ],
            ),
          );
        }

      case 'time':
        final String? currentRaw = _values[fieldName]?.toString();
        final minTime = (f['minTime'] ?? f['min'])?.toString();
        final maxTime = (f['maxTime'] ?? f['max'])?.toString();
        return FormField<String>(
          initialValue: currentRaw,
          validator: (val) {
            final req = f['required'] == true;
            if (req && (val == null || val.trim().isEmpty)) return 'Required';
            if (val == null || val.trim().isEmpty) return null;
            if (_hhmmToMinutes(val) == null) return 'Invalid time';
            final vMin = _hhmmToMinutes(minTime);
            final vMax = _hhmmToMinutes(maxTime);
            final v = _hhmmToMinutes(val)!;
            if (vMin != null && v < vMin) return 'Must be on or after ${minTime}';
            if (vMax != null && v > vMax) return 'Must be on or before ${maxTime}';
            return null;
          },
          builder: (state) {
            final initialTod = _parseTimeOfDay(state.value) ?? TimeOfDay.now();
            final display = (state.value != null && state.value!.isNotEmpty) ? state.value! : 'Select time';
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
                      final value = _formatHHMM(picked);
                      setState(() => _values[fieldName] = value);
                      state.didChange(value);
                    }
                  },
                ),
                if (state.hasError)
                  Padding(
                    padding: const EdgeInsets.only(left: 12.0, top: 4),
                    child: Text(state.errorText ?? '', style: TextStyle(color: Colors.red[700], fontSize: 12)),
                  ),
              ],
            );
          },
        );

      default:
        // default to simple text input
        return TextFormField(
          initialValue: _values[fieldName]?.toString(),
          decoration: InputDecoration(labelText: label),
          validator:
              required
                  ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
                  : null,
          onSaved: (v) => _values[fieldName] = v ?? '',
        );
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final slugRaw = widget.form['slug'];
      final String slug =
          (slugRaw is String ? slugRaw : slugRaw?.toString() ?? '').trim();
      if (slug.isEmpty || slug.toLowerCase() == 'null') {
        setState(() {
          _error =
              'This form is not publicly available (missing slug). Please contact the administrator.';
        });
        return;
      }

      final response = await api.post(
        '/v1/forms/slug/$slug/responses',
        data: _values,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Response submitted')));
        Navigator.of(context).pop(true);
      } else {
        setState(() {
          _error = 'Failed to submit (${response.statusCode})';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Error submitting response: $e';
      });
    } finally {
      setState(() {
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.form['title'] ?? 'Form';
    final description = widget.form['description'] ?? '';
    final String slug = (widget.form['slug']?.toString() ?? '').trim();
    final bool canSubmit = slug.isNotEmpty && slug.toLowerCase() != 'null';
  final List<Map<String, dynamic>> visibleFields = _fields
    .where(_isVisible)
    .where((f) => (f['type'] ?? 'text').toString() != 'price')
    .toList();
    final bool showPricing = _hasPricing();
    final double total = _computeTotal();

    return Scaffold(
      appBar: AppBar(title: Text(title), backgroundColor: Colors.black),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            children: [
              if (description.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Text(description),
                ),
              if (!canSubmit)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF3CD),
                    border: Border.all(color: const Color(0xFFFFEEBA)),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'This form is not publicly available (missing slug). You can view it, but submissions are disabled.',
                    style: TextStyle(color: Color(0xFF856404)),
                  ),
                ),
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView.separated(
                    itemCount: visibleFields.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final f = visibleFields[index];
                      return _buildField(f);
                    },
                  ),
                ),
              ),
              if (showPricing)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8.0, top: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Estimated Total:',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text('\$${total.toStringAsFixed(2)}'),
                    ],
                  ),
                ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitting || !canSubmit ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                  ),
                  child:
                      _submitting
                          ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                          : const Text('Submit'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
