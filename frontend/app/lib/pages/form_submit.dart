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
import 'package:app/helpers/form_submission_helper.dart';
import 'package:app/helpers/payment_stores/form_pending_store.dart';
import 'package:app/pages/forms/form_paypal_page.dart';
import 'package:app/pages/forms/price_label_form_component.dart';
import 'package:app/models/form.dart';
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
  FormPaymentType? _selectedPaymentType;
  List<String> _availableLocales = <String>[];
  late String _activeLocale;

  @override
  void initState() {
    super.initState();
    _form = Map<String, dynamic>.from(widget.form);
    _setupLocales();
    _initializeDefaultValues();
  }

  void _initializeDefaultValues() {
    for (final field in _fields) {
      final type = (field['type'] ?? 'text').toString();
      final fieldName =
          (field['name'] ?? field['key'] ?? field['id'] ?? '').toString();
      if (fieldName.isEmpty) continue;

      if (type == 'switch' || type == 'checkbox') {
        final defaultValue =
            field['default'] ?? field['defaultValue'] ?? field['value'];
        if (defaultValue is bool) {
          _values[fieldName] = defaultValue;
        }
      } else if (type == 'radio' || type == 'select') {
        final defaultValue = field['default'] ?? field['defaultValue'];
        if (defaultValue != null) {
          _values[fieldName] = defaultValue;
        }
      } else if (type == 'date' || type == 'time') {
        final defaultValue = field['default'] ?? field['defaultValue'];
        if (defaultValue != null) {
          _values[fieldName] = defaultValue;
        }
      } else if (type == 'number') {
        final defaultValue = field['default'] ?? field['defaultValue'];
        if (defaultValue != null) {
          _values[fieldName] = defaultValue;
        }
      } else if (type == 'phone') {
        final defaultValue = field['default'] ?? field['defaultValue'];
        if (defaultValue != null) {
          _values[fieldName] = defaultValue;
        }
      } else {
        final defaultValue =
            field['default'] ?? field['defaultValue'] ?? field['value'];
        if (defaultValue != null) {
          _values[fieldName] = defaultValue.toString();
        }
      }
    }
  }

  @override
  void didUpdateWidget(covariant FormSubmitPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!mapEquals(oldWidget.form, widget.form)) {
      setState(() {
        _form = Map<String, dynamic>.from(widget.form);
        _setupLocales();
        _values.clear();
        _initializeDefaultValues();
        _error = null;
        _formInstanceId++;
        _isDirty = false;
        _selectedPaymentType = null;
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

  Map<String, dynamic> _localizedField(Map<String, dynamic> field) {
    return FormLocalizationHelper.localizedField(
      field,
      activeLocale: _activeLocale,
      defaultLocale: _defaultLocale,
    );
  }

  String? _getLocalizedString(Map<String, dynamic> source, String key) {
    return FormLocalizationHelper.getLocalizedString(
      source,
      key,
      activeLocale: _activeLocale,
      defaultLocale: _defaultLocale,
    );
  }

  bool _isVisible(Map<String, dynamic> field) {
    final hidden = field['hidden'];
    if (hidden == true) return false;

    final invisible = field['invisible'];
    if (invisible == true) return false;

    final visibleIf = field['visibleIf'];
    if (visibleIf == null) return true; // no condition, visible

    try {
      if (visibleIf is Map) {
        // If there's a "field" key, treat it as item-visibility-of-single field,
        // otherwise treat each key as requiring that we look up another field's
        // value and compare to one or more expected values.
        if (visibleIf.containsKey('field')) {
          final condFieldName = visibleIf['field']?.toString() ?? '';
          final condValue = _values[condFieldName];

          final equalsValue = visibleIf['equals'] ?? visibleIf['value'];
          if (equalsValue == null) return true;
          if (equalsValue is List) {
            return equalsValue.contains(condValue);
          }
          return condValue == equalsValue;
        }

        for (final entry in visibleIf.entries) {
          final key = entry.key.toString();
          final expected = entry.value;
          final actual = _values[key];

          if (expected is List) {
            if (!expected.contains(actual)) return false;
          } else {
            if (actual != expected) return false;
          }
        }
        return true;
      }

      if (visibleIf is List) {
        for (final clause in visibleIf) {
          if (clause is! Map) continue;
          final fieldName = clause['field']?.toString();
          if (fieldName == null || fieldName.isEmpty) continue;

          final actual = _values[fieldName];
          final equalsValue = clause['equals'] ?? clause['value'];
          if (equalsValue != null) {
            if (equalsValue is List) {
              if (!equalsValue.contains(actual)) return false;
            } else {
              if (actual != equalsValue) return false;
            }
          }

          final notEqualsValue = clause['notEquals'] ?? clause['notEqual'];
          if (notEqualsValue != null) {
            if (notEqualsValue is List) {
              if (notEqualsValue.contains(actual)) return false;
            } else {
              if (actual == notEqualsValue) return false;
            }
          }

          final operator = clause['operator']?.toString();
          final compareTo = clause['compareTo'];
          if (operator != null && compareTo != null) {
            final lhs = actual;
            final rhs = compareTo;

            int? asInt(dynamic raw) {
              if (raw is int) return raw;
              if (raw is num) return raw.toInt();
              if (raw is String) return int.tryParse(raw.trim());
              return null;
            }

            double? asDouble(dynamic raw) {
              if (raw is double) return raw;
              if (raw is num) return raw.toDouble();
              if (raw is String) return double.tryParse(raw.trim());
              return null;
            }

            final lhsNum = asDouble(lhs) ?? asInt(lhs)?.toDouble();
            final rhsNum = asDouble(rhs) ?? asInt(rhs)?.toDouble();
            if (lhsNum != null && rhsNum != null) {
              bool cmp(double a, double b) {
                switch (operator) {
                  case '>':
                    return a > b;
                  case '>=':
                    return a >= b;
                  case '<':
                    return a < b;
                  case '<=':
                    return a <= b;
                  case '==':
                  case '=':
                    return a == b;
                  case '!=':
                    return a != b;
                  default:
                    return true;
                }
              }

              if (!cmp(lhsNum, rhsNum)) return false;
            }
          }
        }
        return true;
      }
    } catch (e) {
      return true;
    }

    return true;
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

  Map<String, bool> _getAvailablePaymentMethods(String slug) {
    bool allowPayPal = false;
    bool allowDoor = false;
    bool foundPriceFields = false;

    for (final f in _fields) {
      final type = (f['type'] ?? 'text').toString();
      if (type != 'price') continue;
      if (!_isVisible(f)) continue;
      foundPriceFields = true;

      final paymentMethods = f['paymentMethods'];
      if (paymentMethods is Map) {
        final allowPayPalRaw = paymentMethods['allowPayPal'];
        final allowInPersonRaw = paymentMethods['allowInPerson'];

        if (allowPayPalRaw != false) {
          // undefined or true -> PayPal allowed
          allowPayPal = true;
        }
        if (allowInPersonRaw == true) {
          allowDoor = true;
        }
      } else {
        // No explicit config: default to PayPal allowed.
        allowPayPal = true;
      }
    }

    // If at least one price field exists but no methods were explicitly set,
    // fall back to the legacy behavior:
    //  - In preview (no slug) -> PayPal only
    //  - In public forms (slug present) -> both PayPal and door
    if (foundPriceFields && !allowPayPal && !allowDoor) {
      if (slug.isEmpty) {
        allowPayPal = true;
      } else {
        allowPayPal = true;
        allowDoor = true;
      }
    }

    return <String, bool>{'allowPayPal': allowPayPal, 'allowDoor': allowDoor};
  }

  List<FormPaymentOption> _buildPaymentOptions(Map<String, bool> methods) {
    final options = <FormPaymentOption>[];
    if (methods['allowPayPal'] == true) {
      options.add(FormPaymentOption.paypal);
    }
    if (methods['allowDoor'] == true) {
      options.add(FormPaymentOption.door);
    }
    return options;
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
            _selectedPaymentType = null;
            _setupLocales();
            _initializeDefaultValues();
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to reload form: $e')));
      }
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
              'You have started filling out this form. Reloading will clear your '
              'current answers. Are you sure you want to reload?',
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
                f['helpText'] ??
                f['helperText'] ??
                f['description'])
            ?.toString();
    final requiredField = (field['required'] ?? f['required']) == true;
    final inlineLabel =
        (field['inlineLabel'] ??
                field['inline_label'] ??
                field['inline'] ??
                f['inlineLabel'] ??
                f['inline_label'] ??
                f['inline'])
            ?.toString();

    int? asInt(dynamic raw) {
      if (raw is int) return raw;
      if (raw is num) return raw.toInt();
      if (raw is String) return int.tryParse(raw.trim());
      return null;
    }

    Widget widget;
    switch (type) {
      case 'static':
        // For static fields, content comes from 'content' field, not 'label'
        final staticContent =
            (field['content'] ??
                    f['content'] ??
                    field['text'] ??
                    f['text'] ??
                    field['label'] ??
                    f['label'] ??
                    'Static Text')
                .toString();
        widget = StaticFormComponent(
          field: field,
          labelOverride: staticContent,
          helperOverride: helperText,
        );
        break;
      case 'price':
        widget = const PriceFormComponent();
        break;
      case 'pricelabel':
        final amountRaw = field['amount'] ?? f['amount'];
        double amount = 0.0;
        if (amountRaw is num) {
          amount = amountRaw.toDouble();
        } else if (amountRaw is String) {
          final parsed = double.tryParse(amountRaw.trim());
          if (parsed != null) {
            amount = parsed;
          }
        }
        widget = PriceLabelFormComponent(label: labelText, amount: amount);
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
          minLength: asInt(field['minLength'] ?? f['minLength']),
          maxLength: asInt(field['maxLength'] ?? f['maxLength']),
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
          minLength: asInt(field['minLength'] ?? f['minLength']),
          maxLength: asInt(field['maxLength'] ?? f['maxLength']),
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
          onText: (field['onText'] ?? f['onText'])?.toString(),
          offText: (field['offText'] ?? f['offText'])?.toString(),
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
          onChanged: (v) {
            final trimmed = v.trim();
            _updateValue(fieldName, trimmed.isEmpty ? null : trimmed);
          },
          onSaved: (v) {
            final trimmed = (v ?? '').trim();
            _values[fieldName] = trimmed.isEmpty ? null : trimmed;
          },
        );
        break;
    }

    if (requiredField &&
        type != 'checkbox' &&
        type != 'switch' &&
        type != 'static') {
      widget = Stack(
        clipBehavior: Clip.none,
        children: [
          widget,
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

    return widget;
  }

  Future<void> _startPayPalFlow(
    String slug,
    Map<String, dynamic> answers,
  ) async {
    try {
      final order = await FormSubmissionHelper.createFormPaymentOrder(
        slug,
        answers,
      );
      final String orderId = order.orderId;

      String? approvalUrl;
      final links = (order.paypal['links'] as List?) ?? const [];
      for (final link in links) {
        if (link is Map) {
          final rel = link['rel']?.toString();
          final href = link['href']?.toString();
          if (href != null &&
              (rel == 'approve' ||
                  rel == 'approval_url' ||
                  rel == 'payer-action')) {
            approvalUrl = href;
            break;
          }
        }
      }
      if (approvalUrl == null && links.isNotEmpty) {
        final first = links.first;
        if (first is Map && first['href'] != null) {
          approvalUrl = first['href'].toString();
        }
      }

      if (approvalUrl == null) {
        setState(() {
          _error = 'Failed to initiate PayPal payment (no approval URL).';
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to initiate PayPal payment.')),
        );
        return;
      }

      await FormPendingStore.savePending(
        slug: slug,
        orderId: orderId,
        answers: answers,
      );

      if (!mounted) return;

      final result = await Navigator.of(context).push<FormPaypalResult>(
        MaterialPageRoute(
          builder:
              (_) => FormPaypalWebViewPage(
                slug: slug,
                orderId: orderId,
                approveUrl: approvalUrl!,
              ),
        ),
      );

      if (!mounted || result == null) {
        return;
      }

      if (result.state == FormPaypalFlowState.cancelled) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment cancelled. No changes were made.'),
          ),
        );
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Finalizing your submission…')),
      );

      final pending = await FormPendingStore.loadPending(
        slug: slug,
        orderId: orderId,
      );

      if (pending == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'We could not find your pending answers for this payment.',
            ),
          ),
        );
        return;
      }

      final captureResp =
          await FormSubmissionHelper.captureAndSubmitFormPayment(
            slug,
            orderId,
            pending,
          );

      if (!mounted) return;

      await FormPendingStore.clearPending(slug: slug, orderId: orderId);

      String message;
      switch (captureResp.status) {
        case CaptureAndSubmitFormStatus.capturedAndSubmitted:
          message = 'Thank you! Your form has been submitted.';
          break;
        case CaptureAndSubmitFormStatus.alreadyCaptured:
        case CaptureAndSubmitFormStatus.alreadyProcessed:
          message =
              'Your payment was already processed. Your form response is saved.';
          break;
      }

      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'There was a problem starting or finishing the PayPal payment.',
          ),
        ),
      );
    }
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
            content: Text(
              'Please fix the highlighted fields before submitting.',
            ),
          ),
        );
      }
      return;
    }

    formState.save();

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
        final visibleFlag =
            widget.form.containsKey('visible')
                ? (widget.form['visible'] == true)
                : false;
        if (!visibleFlag) {
          if (!mounted) return;
          await showDialog<void>(
            context: context,
            barrierDismissible: false,
            builder:
                (ctx) => AlertDialog(
                  title: const Text('Form unavailable'),
                  content: const Text(
                    'This form is not available for public viewing.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Ok'),
                    ),
                  ],
                ),
          );
          if (!mounted) return;
          Navigator.of(context).pop(false);
          return;
        }

        final expiresRaw =
            widget.form['expires_at'] ??
            widget.form['expiresAt'] ??
            widget.form['expires'];
        if (expiresRaw != null) {
          final expires = DateTime.tryParse(expiresRaw.toString());
          if (expires == null || !expires.isAfter(DateTime.now())) {
            if (!mounted) return;
            await showDialog<void>(
              context: context,
              barrierDismissible: false,
              builder:
                  (ctx) => AlertDialog(
                    title: const Text('Form unavailable'),
                    content: const Text(
                      'This form has expired and is no longer accepting responses.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: const Text('Ok'),
                      ),
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

      // Determine pricing and payment options based on the current answers.
      final double formTotal = _computeTotal();
      final bool hasPaymentRequired = formTotal > 0;

      final methodsMap = _getAvailablePaymentMethods(slug);
      final bool allowPayPal = methodsMap['allowPayPal'] == true;
      final bool allowDoor = methodsMap['allowDoor'] == true;
      final List<FormPaymentOption> paymentOptions = _buildPaymentOptions(
        methodsMap,
      );

      final Map<String, dynamic> answers = Map<String, dynamic>.from(_values);

      if (!hasPaymentRequired) {
        final result = await FormSubmissionHelper.submitFreeForm(
          slug: slug,
          answers: answers,
          submissionPrice: formTotal,
          paymentOptions: paymentOptions,
        );

        if (!mounted) return;
        final messenger = ScaffoldMessenger.of(context);
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              result.message.isNotEmpty ? result.message : 'Response submitted',
            ),
          ),
        );
        Navigator.of(context).pop(true);
        return;
      }

      FormPaymentType? chosenType = _selectedPaymentType;

      final bool paypalOnly = allowPayPal && !allowDoor;
      final bool doorOnly = !allowPayPal && allowDoor;
      final bool bothEnabled = allowPayPal && allowDoor;

      if (paypalOnly) {
        chosenType = FormPaymentType.paypal;
      } else if (doorOnly) {
        chosenType = FormPaymentType.door;
      } else if (bothEnabled) {
        if (chosenType == null) {
          setState(() {
            _error = 'Please choose a payment method before submitting.';
          });
          if (mounted) {
            final messenger = ScaffoldMessenger.of(context);
            messenger.hideCurrentSnackBar();
            messenger.showSnackBar(
              const SnackBar(
                content: Text(
                  'Please choose a payment method before submitting.',
                ),
              ),
            );
          }
          return;
        }
      }

      if (chosenType == null && !paypalOnly && !doorOnly && !bothEnabled) {
        final result = await FormSubmissionHelper.submitFreeForm(
          slug: slug,
          answers: answers,
          submissionPrice: formTotal,
          paymentOptions: paymentOptions,
        );
        if (!mounted) return;
        final messenger = ScaffoldMessenger.of(context);
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              result.message.isNotEmpty ? result.message : 'Response submitted',
            ),
          ),
        );
        Navigator.of(context).pop(true);
        return;
      }

      if (chosenType == FormPaymentType.door) {
        final result = await FormSubmissionHelper.submitDoorPaymentForm(
          slug: slug,
          answers: answers,
          submissionPrice: formTotal,
          paymentOptions: paymentOptions,
        );

        if (!mounted) return;
        final messenger = ScaffoldMessenger.of(context);
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              result.message.isNotEmpty
                  ? result.message
                  : 'Response submitted. Please remember to pay in person.',
            ),
          ),
        );
        Navigator.of(context).pop(true);
        return;
      }

      if (chosenType == FormPaymentType.paypal) {
        await _startPayPalFlow(slug, answers);
        return;
      }
    } catch (e) {
      final msg = 'Error submitting response: $e';
      if (mounted) {
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder:
              (ctx) => AlertDialog(
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
        if (!mounted) return;
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
                      items:
                          _availableLocales
                              .map(
                                (loc) => DropdownMenuItem<String>(
                                  value: loc,
                                  child: Text(loc.toUpperCase()),
                                ),
                              )
                              .toList(),
                      onChanged: (loc) {
                        if (loc == null || loc == _activeLocale) return;
                        setState(() {
                          _activeLocale = loc;
                        });
                      },
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
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
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
                  child: Builder(
                    builder: (context) {
                      final String slug =
                          (_form['slug']?.toString() ?? '').trim();
                      final methods = _getAvailablePaymentMethods(slug);
                      return PriceFormComponent(
                        total: total,
                        allowPayPal: methods['allowPayPal'],
                        allowDoor: methods['allowDoor'],
                        selectedPaymentType: _selectedPaymentType,
                        onChangedPaymentType: (next) {
                          setState(() {
                            _selectedPaymentType = next;
                          });
                        },
                      );
                    },
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
