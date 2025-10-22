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
import 'package:app/services/form_payment_service.dart';
import 'package:app/widgets/form_payment_widget.dart';
import 'package:app/widgets/form_payment_summary.dart';
import 'package:app/widgets/form_payment_selector_widget.dart';
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
  bool _showPaymentSection = false; // Track if payment section should be visible
  List<String> _availablePaymentMethods = []; // Store available payment methods

  @override
  void initState() {
    super.initState();
    _form = Map<String, dynamic>.from(widget.form);
    _setupLocales();
    _loadPaymentConfig();
  }

  @override
  void didUpdateWidget(covariant FormSubmitPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!mapEquals(oldWidget.form, widget.form)) {
      setState(() {
        _form = Map<String, dynamic>.from(widget.form);
        _setupLocales(preferredLocale: _activeLocale);
      });
      _loadPaymentConfig();
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
    int? _asInt(dynamic raw) {
      if (raw is int) return raw;
      if (raw is num) return raw.toInt();
      if (raw is String) return int.tryParse(raw.trim());
      return null;
    }
    Widget widget;
    switch (type) {
      case 'static':
        widget = StaticFormComponent(
          field: field,
          labelOverride: labelText,
          helperOverride: helperText,
        );
        break;
      case 'price':
        widget = const PriceFormComponent();
        break;
      case 'textarea':
        widget = TextareaFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: _values[fieldName]?.toString(),
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v ?? '',
          minLength: _asInt(field['minLength'] ?? f['minLength']),
          maxLength: _asInt(field['maxLength'] ?? f['maxLength']),
        );
        break;
      case 'email':
        widget = EmailFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: _values[fieldName]?.toString(),
          onChanged: (v) {
            final trimmed = v.trim();
            _updateValue(fieldName, trimmed.isEmpty ? null : trimmed);
          },
          onSaved: (v) {
            final trimmed = (v ?? '').trim();
            _values[fieldName] = trimmed.isEmpty ? null : trimmed;
          },
          minLength: _asInt(field['minLength'] ?? f['minLength']),
          maxLength: _asInt(field['maxLength'] ?? f['maxLength']),
        );
        break;
      case 'tel':
        final current = _values[fieldName];
        final initialPhone = current is String ? current : null;
        widget = PhoneFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: initialPhone,
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v ?? '',
        );
        break;
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
        widget = NumberFormComponent(
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
        break;
      case 'checkbox':
        widget = CheckboxFormComponent(
          label: labelText,
          inlineLabel: inlineLabel?.isNotEmpty == true ? inlineLabel : null,
          helperText: helperText,
          requiredField: requiredField,
          value: _values[fieldName] == true,
          onChanged: (val) => _updateValue(fieldName, val),
          onSaved: (val) => _values[fieldName] = val,
        );
        break;
      case 'switch':
        widget = SwitchFormComponent(
          label: labelText,
          inlineLabel: inlineLabel?.isNotEmpty == true ? inlineLabel : null,
          helperText: helperText,
          requiredField: requiredField,
          value: _values[fieldName] == true,
          onChanged: (val) => _updateValue(fieldName, val),
          onSaved: (val) => _values[fieldName] = val,
        );
        break;
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
        widget = SelectFormComponent(
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
        break;
      case 'radio':
        widget = RadioFormComponent(
          field: field,
          value: _values[fieldName]?.toString(),
          onChanged: (v) => _updateValue(fieldName, v),
        );
        break;
      case 'date':
        widget = DateFormComponent(
          field: field,
          value: _values[fieldName],
          onChanged: (val) => _updateValue(fieldName, val),
        );
        break;
      case 'time':
        widget = TimeFormComponent(
          field: field,
          value: _values[fieldName]?.toString(),
          onChanged: (val) => _updateValue(fieldName, val),
        );
        break;
      default:
        widget = TextFormComponent(
          label: labelText,
          placeholder: placeholder,
          helperText: helperText,
          requiredField: requiredField,
          initialValue: _values[fieldName]?.toString(),
          onChanged: (v) => _updateValue(fieldName, v),
          onSaved: (v) => _values[fieldName] = v ?? '',
          minLength: _asInt(field['minLength'] ?? f['minLength']),
          maxLength: _asInt(field['maxLength'] ?? f['maxLength']),
        );
    }

    return _wrapWithRequiredBadge(widget, requiredField);
  }

  Widget _wrapWithRequiredBadge(Widget child, bool requiredField) {
    if (!requiredField) return child;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        Positioned(
          top: 4,
          right: 0,
          child: IgnorePointer(
            child: Text(
              '*',
              style: TextStyle(
                color: Colors.red[600],
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }

  bool _requiresPayment() {
    return FormPaymentService.formRequiresPayment(_form);
  }

  Future<void> _loadPaymentConfig() async {
    if (!_requiresPayment()) return;
    
    // Get available payment methods from form configuration
    setState(() {
      _availablePaymentMethods = FormPaymentService.getAvailablePaymentMethods(_form);
    });
  }

  void _handlePaymentRequired() {
    final total = _computeTotal();
    if (total > 0) {
      setState(() {
        _showPaymentSection = true;
      });
    } else {
      // No payment needed, submit directly
      _submitDirectly();
    }
  }

  void _onPaymentSuccess() {
    setState(() {
      _showPaymentSection = false;
    });
    
    // Show success message
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payment completed successfully! Your form has been submitted.'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop(true);
    }
  }

  void _onPaymentError(String error) {
    setState(() {
      _error = 'Payment failed: $error';
      _showPaymentSection = false;
    });
  }

  void _onPaymentCancel() {
    setState(() {
      _showPaymentSection = false;
      _error = null;
    });
  }

  Widget _buildDoorPaymentWidget(double total) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              const Icon(Icons.store, size: 48),
              const SizedBox(height: 8),
              const Text(
                'Pay at Door',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text('Total: \$${total.toStringAsFixed(2)}'),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _onPaymentCancel,
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        try {
                          final result = await FormPaymentService.completeDoorPayment(
                            formSlug: (_form['slug']?.toString() ?? '').trim(),
                            formResponse: _values,
                            paymentAmount: total,
                          );
                          if (result != null && result['success'] == true) {
                            _onPaymentSuccess();
                          } else {
                            _onPaymentError('Failed to submit form with door payment');
                          }
                        } catch (e) {
                          _onPaymentError('Error: $e');
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                      ),
                      child: const Text('Submit Form'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final formState = _scaffoldFormKey.currentState;
    if (formState == null) return;

    final isValid = formState.validate();
    if (!isValid) {
      setState(() {
        _error = 'Please fix the highlighted fields before submitting.';
      });
      if (mounted) {
        final messenger = ScaffoldMessenger.of(context);
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Please fix the highlighted fields before submitting.'),
          ),
        );
      }
      return;
    }

    formState.save();

    // Check if payment is required
    if (_requiresPayment()) {
      _handlePaymentRequired();
    } else {
      _submitDirectly();
    }
  }

  Future<void> _submitDirectly() async {
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

      // Locally check visibility and expiry before attempting to submit.
      try {
        final visibleFlag = widget.form.containsKey('visible') ? (widget.form['visible'] == true) : false;
        if (!visibleFlag) {
          if (!mounted) return;
            await showDialog<void>(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              title: const Text('Form unavailable'),
              content: const Text('This form is not available for public viewing.'),
              actions: [
                TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Ok')),
              ],
            ),
          );
          if (!mounted) return;
          Navigator.of(context).pop(false);
          return;
        }

        final expiresRaw = widget.form['expires_at'] ?? widget.form['expiresAt'] ?? widget.form['expires'];
        if (expiresRaw != null) {
          final expires = DateTime.tryParse(expiresRaw.toString());
          if (expires == null || !expires.isAfter(DateTime.now())) {
            if (!mounted) return;
            await showDialog<void>(
              context: context,
              barrierDismissible: false,
              builder: (ctx) => AlertDialog(
                title: const Text('Form unavailable'),
                content: const Text('This form has expired and is no longer accepting responses.'),
                actions: [
                  TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Ok')),
                ],
              ),
            );
            if (!mounted) return;
            Navigator.of(context).pop(false);
            return;
          }
        }
      } catch (_) {
        // If anything goes wrong during local checks, proceed to call the server which will provide authoritative reason.
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
        // Map server detail to friendly message when possible
        final detail = response.data is Map ? (response.data['detail'] ?? response.data['message']) : null;
        final detailStr = detail is String ? detail.toLowerCase() : null;
        String msg = 'Failed to submit (${response.statusCode})';
        if (detailStr != null) {
          if (detailStr.contains('expired')) msg = 'This form has expired and is no longer accepting responses.';
          else if (detailStr.contains('not available') || detailStr.contains('not visible')) msg = 'This form is not available for public viewing.';
          else if (detailStr.contains('not found')) msg = 'Form not found.';
        }
        // Show blocking dialog with Ok to return to list
        if (!mounted) return;
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            title: const Text('Form unavailable'),
            content: Text(msg),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                },
                child: const Text('Ok'),
              ),
            ],
          ),
        );
        Navigator.of(context).pop(false);
      }
    } catch (e) {
      // Network or other error: show dialog and go back
      final msg = 'Error submitting response: $e';
      if (mounted) {
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            title: const Text('Submission failed'),
            content: Text(msg),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Ok'),
              ),
            ],
          ),
        );
        Navigator.of(context).pop(false);
      }
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
      key: const ValueKey('screen-form_submit'),
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
              
              // Show payment summary when there's pricing
              if (showPricing && total > 0)
                FormPaymentSummary(
                  form: _form,
                  values: _values,
                ),
              
              // Show payment widget when payment is required and total > 0
              if (_showPaymentSection && total > 0) 
                _availablePaymentMethods.length > 1
                    ? FormPaymentSelectorWidget(
                        formSlug: (_form['slug']?.toString() ?? '').trim(),
                        formTitle: title,
                        formResponse: _values,
                        totalAmount: total,
                        paymentMethods: _availablePaymentMethods,
                        onPaymentSuccess: _onPaymentSuccess,
                        onPaymentError: _onPaymentError,
                        onPaymentCancel: _onPaymentCancel,
                      )
                    : _availablePaymentMethods.contains('paypal')
                        ? FormPaymentWidget(
                            formSlug: (_form['slug']?.toString() ?? '').trim(),
                            formTitle: title,
                            formResponse: _values,
                            totalAmount: total,
                            onPaymentSuccess: _onPaymentSuccess,
                            onPaymentError: _onPaymentError,
                            onPaymentCancel: _onPaymentCancel,
                          )
                        : _buildDoorPaymentWidget(total),
                
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              
              // Only show submit button if not showing payment section
              if (!_showPaymentSection)
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
                            : Text(_requiresPayment() && total > 0 
                                ? (_availablePaymentMethods.length > 1 
                                    ? 'Choose Payment Method' 
                                    : _availablePaymentMethods.contains('door') 
                                        ? 'Continue to Payment' 
                                        : 'Continue to Payment')
                                : 'Submit'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
