import 'package:flutter/material.dart';

class UserProfileForm extends StatefulWidget {
  final String? initialFirstName;
  final String? initialLastName;
  final DateTime? initialBirthday;

  final String? initialGender;
  final Future<void> Function({
    required String firstName,
    required String lastName,
    DateTime? birthday,
    String? gender,
  })
  onSave;

  const UserProfileForm({
    super.key,
    this.initialFirstName,
    this.initialLastName,
    this.initialBirthday,
    this.initialGender,
    required this.onSave,
  });

  @override
  State<UserProfileForm> createState() => _UserProfileFormState();
}

class _UserProfileFormState extends State<UserProfileForm> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _firstNameCtrl;
  late final TextEditingController _lastNameCtrl;
  late final TextEditingController _birthdayCtrl;

  DateTime? _birthday;
  String? _gender;

  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _firstNameCtrl = TextEditingController(text: widget.initialFirstName ?? '');
    _lastNameCtrl = TextEditingController(text: widget.initialLastName ?? '');
    _birthday = widget.initialBirthday;
    _birthdayCtrl = TextEditingController(
      text: widget.initialBirthday != null ? _fmt(widget.initialBirthday!) : '',
    );
    _gender =
        (widget.initialGender == 'M' || widget.initialGender == 'F')
            ? widget.initialGender
            : null;
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _birthdayCtrl.dispose();
    super.dispose();
  }

  String _fmt(DateTime d) {
    final mm = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    return '${d.year}-$mm-$dd';
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final initial = _birthday ?? DateTime(now.year - 20, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900, 1, 1),
      lastDate: DateTime(now.year + 1, 12, 31),
    );
    if (picked != null && mounted) {
      setState(() {
        _birthday = picked;
        _birthdayCtrl.text = _fmt(picked);
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await widget.onSave(
        firstName: _firstNameCtrl.text.trim(),
        lastName: _lastNameCtrl.text.trim(),
        birthday: _birthday,
        gender: _gender,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);
    return Form(
      key: _formKey,
      child: Column(
        children: [
          // First name
          TextFormField(
            controller: _firstNameCtrl,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'First name',
              border: OutlineInputBorder(),
            ),
            validator:
                (v) =>
                    (v ?? '').trim().isEmpty
                        ? 'Please enter your first name.'
                        : null,
          ),
          const SizedBox(height: 14),

          // Last name
          TextFormField(
            controller: _lastNameCtrl,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Last name',
              border: OutlineInputBorder(),
            ),
            validator:
                (v) =>
                    (v ?? '').trim().isEmpty
                        ? 'Please enter your last name.'
                        : null,
          ),
          const SizedBox(height: 14),

          // Birthday
          TextFormField(
            controller: _birthdayCtrl,
            readOnly: true,
            decoration: InputDecoration(
              labelText: 'Birthday',
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                onPressed: _pickDate,
                icon: const Icon(Icons.calendar_today),
                tooltip: 'Pick date',
              ),
            ),
            onTap: _pickDate,
          ),
          const SizedBox(height: 14),

          // Gender
          InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Gender',
              border: OutlineInputBorder(),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: (_gender == 'M' || _gender == 'F') ? _gender : null,
                hint: const Text('Select'),
                items: const [
                  DropdownMenuItem(value: 'M', child: Text('Male')),
                  DropdownMenuItem(value: 'F', child: Text('Female')),
                ],
                onChanged: (val) => setState(() => _gender = val),
              ),
            ),
          ),
          const SizedBox(height: 22),

          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: ssbcGray),
              child:
                  _saving
                      ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : const Text('Save Changes'),
            ),
          ),
        ],
      ),
    );
  }
}
