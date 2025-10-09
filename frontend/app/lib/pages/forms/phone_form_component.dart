import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

final _nonDigitRegExp = RegExp(r'\D');
const _phoneMaxDigits = 10;

String _sanitizeDigits(String input) {
  final digits = input.replaceAll(_nonDigitRegExp, '');
  return digits.length > _phoneMaxDigits ? digits.substring(0, _phoneMaxDigits) : digits;
}

String _formatDigits(String digits) {
  if (digits.isEmpty) return '';
  final buffer = StringBuffer();
  buffer.write('(');
  if (digits.length >= 3) {
    buffer.write(digits.substring(0, 3));
    buffer.write(')');
  } else {
    buffer.write(digits);
    return buffer.toString();
  }
  if (digits.length >= 4) {
    buffer.write(' ');
    buffer.write(digits.substring(3, digits.length >= 6 ? 6 : digits.length));
  }
  if (digits.length > 6) {
    buffer.write('-');
    buffer.write(digits.substring(6));
  }
  return buffer.toString();
}

String? _normalizePhoneValue(String? input) {
  if (input == null) return null;
  final digits = _sanitizeDigits(input);
  return digits.isEmpty ? null : digits;
}

class PhoneNumberTextInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = _sanitizeDigits(newValue.text);
    final formatted = _formatDigits(digits);
    final selectionIndex = formatted.length;
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: selectionIndex),
      composing: TextRange.empty,
    );
  }
}

class PhoneFormComponent extends StatefulWidget {
  final String label;
  final String? placeholder;
  final String? helperText;
  final bool requiredField;
  final String? initialValue;
  final ValueChanged<String?> onChanged;
  final FormFieldSetter<String?> onSaved;

  const PhoneFormComponent({
    super.key,
    required this.label,
    this.placeholder,
    this.helperText,
    this.requiredField = false,
    this.initialValue,
    required this.onChanged,
    required this.onSaved,
  });

  @override
  State<PhoneFormComponent> createState() => _PhoneFormComponentState();
}

class _PhoneFormComponentState extends State<PhoneFormComponent> {
  late final TextEditingController _controller;
  final PhoneNumberTextInputFormatter _formatter = PhoneNumberTextInputFormatter();

  String get _initialFormatted {
    final digits = widget.initialValue == null ? '' : _sanitizeDigits(widget.initialValue!);
    return _formatDigits(digits);
  }

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _initialFormatted);
  }

  @override
  void didUpdateWidget(covariant PhoneFormComponent oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialValue != oldWidget.initialValue) {
      _controller.text = _initialFormatted;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final effectiveHelper = widget.helperText?.trim().isEmpty ?? true ? null : widget.helperText;
    final effectivePlaceholder = widget.placeholder?.trim().isEmpty ?? true ? '(555) 123-4567' : widget.placeholder;
    return TextFormField(
      controller: _controller,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: effectivePlaceholder,
        helperText: effectiveHelper,
      ),
      keyboardType: TextInputType.phone,
      inputFormatters: <TextInputFormatter>[_formatter],
      validator: (value) {
        final digits = _normalizePhoneValue(value) ?? '';
        if (widget.requiredField && digits.isEmpty) {
          return 'Required';
        }
        if (digits.isEmpty) return null;
        if (digits.length != _phoneMaxDigits) {
          return 'Enter a valid 10-digit phone number';
        }
        return null;
      },
      onChanged: (value) {
        widget.onChanged(_normalizePhoneValue(value));
      },
      onSaved: (value) {
        widget.onSaved(_normalizePhoneValue(value));
      },
    );
  }
}
