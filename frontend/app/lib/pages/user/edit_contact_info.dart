import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'package:app/helpers/user_helper.dart';
import 'package:app/models/contact_info.dart';

class EditContactInfoScreen extends StatefulWidget {
  final User user;

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

  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _prefillFromCache();
  }

  Future<void> _prefillFromCache() async {
    try {
      final cached = await UserHelper.readCachedContact();
      if (!mounted || cached == null) return;

      _phoneCtrl.text = cached.phone ?? '';
      _addrCtrl.text = cached.address.address ?? '';
      _suiteCtrl.text = cached.address.suite ?? '';
      _cityCtrl.text = cached.address.city ?? '';
      _stateCtrl.text = cached.address.state ?? '';
      _countryCtrl.text = cached.address.country ?? '';
      _postalCtrl.text = cached.address.postal_code ?? '';
      setState(() {});
    } catch (_) {}
  }

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

  Future<void> _save() async {
    final form = _formKey.currentState;
    if (form == null) return;
    if (!form.validate()) return;

    setState(() => _loading = true);

    final contact = ContactInfo(
      phone: _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      address: AddressSchema(
        address: _addrCtrl.text.trim(),
        suite: _suiteCtrl.text.trim().isEmpty ? null : _suiteCtrl.text.trim(),
        city: _cityCtrl.text.trim(),
        state: _stateCtrl.text.trim(),
        country: _countryCtrl.text.trim(),
        postal_code: _postalCtrl.text.trim(),
      ),
    );

    final res = await UserHelper.updateContactInfo(contact);

    if (!mounted) return;
    setState(() => _loading = false);

    final msg =
        (res.msg.isNotEmpty)
            ? res.msg
            : (res.success
                ? 'Contact info updated.'
                : 'Failed to update contact info.');

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

    if (res.success) {
      Navigator.of(context).pop(res.contact);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const Color ssbcGray = Color.fromARGB(255, 142, 163, 168);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Contact Info'),
        backgroundColor: ssbcGray,
      ),
      body: AbsorbPointer(
        absorbing: _loading,
        child: Stack(
          children: [
            Form(
              key: _formKey,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                child: Column(
                  children: [
                    TextFormField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone',
                        hintText: '(555) 123-4567',
                      ),
                      validator: (v) {
                        final s = (v ?? '').trim();
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _addrCtrl,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Address',
                        hintText: '123 Main St',
                      ),
                      validator: (v) {
                        final s = (v ?? '').trim();
                        if (s.isEmpty) return 'Address is required';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _suiteCtrl,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Apt / Suite (optional)',
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            controller: _cityCtrl,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(
                              labelText: 'City',
                            ),
                            validator: (v) {
                              final s = (v ?? '').trim();
                              if (s.isEmpty) return 'City is required';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            controller: _stateCtrl,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              labelText: 'State/Region',
                            ),
                            validator: (v) {
                              final s = (v ?? '').trim();
                              if (s.isEmpty) return 'Required';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            controller: _countryCtrl,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(
                              labelText: 'Country',
                            ),
                            validator: (v) {
                              final s = (v ?? '').trim();
                              if (s.isEmpty) return 'Country is required';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            controller: _postalCtrl,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              labelText: 'Postal Code',
                            ),
                            validator: (v) {
                              final s = (v ?? '').trim();
                              if (s.isEmpty) return 'Required';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: ssbcGray,
                        ),
                        onPressed: _save,
                        child:
                            _loading
                                ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                                : const Text('Save'),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            if (_loading)
              Positioned.fill(
                child: IgnorePointer(
                  child: Container(
                    color: theme.colorScheme.surface.withOpacity(0.12),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
