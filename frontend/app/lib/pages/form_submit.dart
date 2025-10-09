import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/form_localization_helper.dart';
import 'package:app/pages/forms/checkbox_form_component.dart';
import 'package:app/pages/forms/date_form_component.dart';
import 'package:app/pages/forms/email_form_component.dart';
import 'package:app/pages/forms/number_form_component.dart';
import 'package:app/pages/forms/price_form_component.dart';
import 'package:app/pages/forms/radio_form_component.dart';
import 'package:app/pages/forms/select_form_component.dart';
import 'package:app/pages/forms/static_form_component.dart';
import 'package:app/pages/forms/switch_form_component.dart';
import 'package:app/pages/forms/text_form_component.dart';
import 'package:app/pages/forms/textarea_form_component.dart';
import 'package:app/pages/forms/time_form_component.dart';
import 'package:app/pages/forms/phone_form_component.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class FormSubmitPage extends StatefulWidget {
  final Map<String, dynamic> form;

  const FormSubmitPage({super.key, required this.form});

  @override
  State<FormSubmitPage> createState() => _FormSubmitPageState();
}

class _FormSubmitPageState extends State<FormSubmitPage> {
  final _scaffoldFormKey = GlobalKey<FormState>();
  final Map<String, dynamic> _values = {};
  bool _submitting = false;
  String? _error;
  late Map<String, dynamic> _form; // local, refreshable copy of the form
  int _formInstanceId = 0; // bump to reset Form state after refresh
  bool _isDirty = false; // tracks whether user has typed/changed anything
  List<String> _availableLocales = <String>[];
  late String _activeLocale;

  @override
  void initState() {
    super.initState();
    _form = Map<String, dynamic>.from(widget.form);
    _setupLocales();
  }

  @override
  void didUpdateWidget(covariant FormSubmitPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!mapEquals(oldWidget.form, widget.form)) {
      setState(() {
        _form = Map<String, dynamic>.from(widget.form);
        _setupLocales(preferredLocale: _activeLocale);
      });
    }
  }

  // Helper to extract field list from form
  List<Map<String, dynamic>> get _fields {
    final data = _form['data'];
    if (data is List) return List<Map<String, dynamic>>.from(data);
    return [];
  }

  String get _defaultLocale => FormLocalizationHelper.defaultLocale(_form);

  void _setupLocales({String? preferredLocale}) {
    final localeState = FormLocalizationHelper.initializeLocales(
      _form,
      preferredLocale: preferredLocale,
    );
    _availableLocales = List<String>.from(localeState.locales);
    _activeLocale = localeState.activeLocale;
  }

  String? _getLocalizedString(Map<String, dynamic> source, String key) {
    return FormLocalizationHelper.getLocalizedString(
      source,
      key,
      activeLocale: _activeLocale,
      defaultLocale: _defaultLocale,
    );
  }

  Map<String, dynamic> _localizedField(Map<String, dynamic> field) {
    return FormLocalizationHelper.localizedField(
      field,
      activeLocale: _activeLocale,
      defaultLocale: _defaultLocale,
    );
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

  void _updateValue(String fieldName, dynamic value) {
    setState(() {
      _values[fieldName] = value;
      if (!_isDirty) {
        _isDirty = true;
      }
    });
  }

  bool _hasAnyInput() {
    if (_isDirty) return true;
    for (final entry in _values.entries) {
      final v = entry.value;
      if (v == null) continue;
      if (v is String && v.trim().isEmpty) continue;
      if (v is List && v.isEmpty) continue;
      if (v is Map && v.isEmpty) continue;
      // any other non-null value counts as input
      return true;
    }
    return false;
  }

  Future<void> _reloadForm() async {
    try {
      final String slug = (_form['slug']?.toString() ?? '').trim();
      final String id = _form['id']?.toString() ?? '';
      dynamic response;
      if (slug.isNotEmpty && slug.toLowerCase() != 'null') {
        response = await api.get('/v1/forms/slug/$slug');
      } else if (id.isNotEmpty) {
        response = await api.get('/v1/forms/$id');
      }
      if (response != null && (response.statusCode == 200)) {
        final data = response.data;
        if (data is Map) {
          setState(() {
            _form = Map<String, dynamic>.from(data);
            _values.clear();
            _error = null;
            _formInstanceId++;
            _isDirty = false;
            _setupLocales(preferredLocale: _activeLocale);
          });
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Form reloaded. All inputs were cleared.'),
            ),
          );
          return;
        }
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Failed to reload form${response?.statusCode != null ? ' (${response.statusCode})' : ''}',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error reloading form: $e')));
    }
  }

  Future<void> _confirmAndReload() async {
    if (!_hasAnyInput()) {
      await _reloadForm();
      return;
    }
    final confirm = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Text('Reload form?'),
            content: const Text(
              'Reloading will fetch the latest form and clear all data you\'ve entered. Continue?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Reload'),
              ),
            ],
          ),
    );
    if (confirm == true) {
      await _reloadForm();
    }
  }

  Widget _buildField(Map<String, dynamic> f) {
    if (!_isVisible(f)) return const SizedBox.shrink();
    final field = _localizedField(f);
    final type = (field['type'] ?? f['type'] ?? 'text').toString();
    final fieldName =
        (field['name'] ??
                f['name'] ??
                f['key'] ??
                f['id'] ??
                f['label'] ??
                UniqueKey().toString())
            .toString();
    final labelText =
        (field['label'] ?? f['label'] ?? f['name'] ?? fieldName).toString();
    final placeholder =
        (field['placeholder'] ?? field['hint'] ?? f['placeholder'] ?? f['hint'])
            ?.toString();
    final helperText =
        (field['helpText'] ??
                field['helperText'] ??
                field['description'] ??
                f['helperText'] ??
                f['description'])
            ?.toString();
    final inlineLabel =
        (field['inlineLabel'] ??
                field['inline_label'] ??
                field['inline'] ??
                f['inlineLabel'] ??
                f['inline_label'] ??
                f['inline'])
            ?.toString();
    final requiredField = (field['required'] ?? f['required']) == true;
    switch (type) {
      case 'static':
        return StaticFormComponent(
          field: field,
          labelOverride: labelText,
          helperOverride: helperText,
        );
      case 'price':
        return const PriceFormComponent();
      case 'textarea':
        return TextareaFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: _values[fieldName]?.toString(),
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v ?? '',
        );
      case 'email':
        return EmailFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: _values[fieldName]?.toString(),
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v ?? '',
        );
      case 'tel':
        final current = _values[fieldName];
        final initialPhone = current is String ? current : null;
        return PhoneFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: initialPhone,
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v ?? '',
        );
      case 'number':
        final current = _values[fieldName];
        num? initial;
        if (current is num) {
          initial = current;
        } else if (current is String) {
          initial = double.tryParse(current);
        }
        final allowedValuesSource = f['allowedValues'] ?? f['allowed'];
        final allowedValues = <num>[];
        if (allowedValuesSource is List) {
          for (final item in allowedValuesSource) {
            if (item is num) {
              allowedValues.add(item);
            } else if (item is String) {
              final parsed = double.tryParse(item);
              if (parsed != null) allowedValues.add(parsed);
            }
          }
        } else if (allowedValuesSource is String) {
          final parts = allowedValuesSource.split(',');
          for (final part in parts) {
            final parsed = double.tryParse(part.trim());
            if (parsed != null) allowedValues.add(parsed);
          }
        }
        num? parseNum(dynamic raw) {
          if (raw is num) return raw;
          if (raw is String) return double.tryParse(raw.trim());
          return null;
        }
        final minValue = parseNum(f['min'] ?? f['minimum']);
        final maxValue = parseNum(f['max'] ?? f['maximum']);
        final stepValue = parseNum(f['step']);
        return NumberFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: initial,
          min: minValue,
          max: maxValue,
          step: stepValue,
          allowedValues: allowedValues.isEmpty ? const <num>[] : allowedValues,
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v,
        );
      case 'checkbox':
        return CheckboxFormComponent(
          label: labelText,
          inlineLabel: inlineLabel?.isNotEmpty == true ? inlineLabel : null,
          helperText: helperText,
          requiredField: requiredField,
          value: _values[fieldName] == true,
          onChanged: (val) => _updateValue(fieldName, val),
          onSaved: (val) => _values[fieldName] = val,
        );
      case 'switch':
        return SwitchFormComponent(
          label: labelText,
          inlineLabel: inlineLabel?.isNotEmpty == true ? inlineLabel : null,
          helperText: helperText,
          requiredField: requiredField,
          value: _values[fieldName] == true,
          onChanged: (val) => _updateValue(fieldName, val),
          onSaved: (val) => _values[fieldName] = val,
        );
      case 'select':
        final rawOptions =
            (field['options'] ??
                    field['choices'] ??
                    f['options'] ??
                    f['choices'] ??
                    const <dynamic>[])
                as List;
        final opts =
            rawOptions
                .map((opt) {
                  if (opt is Map) {
                    final value =
                        (opt['value'] ?? opt['id'] ?? opt['label'] ?? '')
                            .toString();
                    final label =
                        (opt['label'] ??
                                opt['value'] ??
                                opt['id'] ??
                                f['label'] ??
                                '')
                            .toString();
                    return SelectOption(value: value, label: label);
                  }
                  final value = opt?.toString() ?? '';
                  return SelectOption(value: value, label: value);
                })
                .where((opt) => opt.value.isNotEmpty || opt.label.isNotEmpty)
                .toList();
        final multiple = (field['multiple'] ?? f['multiple']) == true;
        return SelectFormComponent(
          label: labelText,
          placeholder:
              (field['buttonLabel'] ?? f['buttonLabel'] ?? placeholder)
                  ?.toString(),
          helperText: helperText,
          requiredField: requiredField,
          options: opts,
          multiple: multiple,
          value: _values[fieldName],
          onChanged: (selection) => _updateValue(fieldName, selection),
          onSaved: (selection) {
            if (multiple) {
              final list =
                  (selection as List?)
                      ?.map((e) => e.toString())
                      .where((e) => e.isNotEmpty)
                      .toList() ??
                  <String>[];
              _values[fieldName] = list;
            } else {
              _values[fieldName] = selection?.toString();
            }
          },
        );
      case 'radio':
        return RadioFormComponent(
          field: field,
          value: _values[fieldName]?.toString(),
          onChanged: (v) => _updateValue(fieldName, v),
        );
      case 'date':
        return DateFormComponent(
          field: field,
          value: _values[fieldName],
          onChanged: (val) => _updateValue(fieldName, val),
        );
      case 'time':
        return TimeFormComponent(
          field: field,
          value: _values[fieldName]?.toString(),
          onChanged: (val) => _updateValue(fieldName, val),
        );
      default:
        return TextFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: _values[fieldName]?.toString(),
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v ?? '',
        );
    }
  }

  Future<void> _submit() async {
    if (!_scaffoldFormKey.currentState!.validate()) return;
    _scaffoldFormKey.currentState!.save();

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
    final title =
        _getLocalizedString(_form, 'title') ?? _form['title'] ?? 'Form';
    final description =
        _getLocalizedString(_form, 'description') ?? _form['description'] ?? '';
    final String slug = (_form['slug']?.toString() ?? '').trim();
    final bool canSubmit = slug.isNotEmpty && slug.toLowerCase() != 'null';
    final List<Map<String, dynamic>> visibleFields =
        _fields
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
              if (_availableLocales.length > 1)
                Align(
                  alignment: Alignment.centerRight,
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _activeLocale,
                      onChanged: (value) {
                        if (value == null) return;
                        setState(() {
                          _activeLocale = value;
                        });
                      },
                      items:
                          _availableLocales
                              .map(
                                (locale) => DropdownMenuItem<String>(
                                  value: locale,
                                  child: Text(locale.toUpperCase()),
                                ),
                              )
                              .toList(),
                    ),
                  ),
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
                  key: _scaffoldFormKey,
                  child: RefreshIndicator(
                    onRefresh: _confirmAndReload,
                    child: ListView.separated(
                      key: Key('form-instance-$_formInstanceId'),
                      physics: const AlwaysScrollableScrollPhysics(),
                      itemCount: visibleFields.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final f = visibleFields[index];
                        return _buildField(f);
                      },
                    ),
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
