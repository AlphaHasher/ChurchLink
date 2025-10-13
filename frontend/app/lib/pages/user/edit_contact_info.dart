// lib/pages/user/edit_contact_info.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class EditContactInfoScreen extends StatefulWidget {
  final User user; // keep for future prefill/ownership
  const EditContactInfoScreen({super.key, required this.user});

  @override
  State<EditContactInfoScreen> createState() => _EditContactInfoScreenState();
}

class _EditContactInfoScreenState extends State<EditContactInfoScreen> {
  final _formKey = GlobalKey<FormState>();

  final _phoneCtrl = TextEditingController();
  final _addrCtrl = TextEditingController();
  final _suiteCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _countryCtrl = TextEditingController();
  final _postalCtrl = TextEditingController();

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _addrCtrl.dispose();
    _suiteCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _countryCtrl.dispose();
    _postalCtrl.dispose();
    super.dispose();
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Saved (local only). Wire API next.')),
    );
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final email = widget.user.email ?? '';
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Edit Contact Info')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
          children: [
            Text('Email', style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 6),
            TextFormField(
              initialValue: email,
              enabled: false,
              decoration: const InputDecoration(
                filled: true,
                hintText: 'Email',
              ),
            ),
            const SizedBox(height: 20),

            Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Phone',
                      hintText: '(555) 555-5555',
                    ),
                  ),
                  const SizedBox(height: 16),

                  TextFormField(
                    controller: _addrCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Address',
                      hintText: '123 Main St',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _suiteCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Suite/Apt',
                      hintText: 'Apt 4B',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _cityCtrl,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(labelText: 'City'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _stateCtrl,
                          textCapitalization: TextCapitalization.characters,
                          decoration: const InputDecoration(
                            labelText: 'State/Province',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _countryCtrl,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Country',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _postalCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Postal Code',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _save,
                      style: FilledButton.styleFrom(
                        backgroundColor: theme.colorScheme.primary,
                        foregroundColor: theme.colorScheme.onPrimary,
                      ),
                      child: const Text('Save'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
