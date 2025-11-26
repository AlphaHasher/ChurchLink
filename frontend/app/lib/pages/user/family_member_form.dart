import 'package:flutter/material.dart';
import 'package:app/models/family_member.dart';
import 'package:app/services/family_member_service.dart';
import 'package:app/helpers/localized_widgets.dart';

class FamilyMemberForm extends StatefulWidget {
  final FamilyMember? member; // null for create, populated for edit

  const FamilyMemberForm({super.key, this.member});

  @override
  State<FamilyMemberForm> createState() => _FamilyMemberFormState();
}

class _FamilyMemberFormState extends State<FamilyMemberForm> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  String _selectedGender = 'M';
  DateTime? _selectedDate;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.member != null) {
      // Editing existing member
      _firstNameController.text = widget.member!.firstName;
      _lastNameController.text = widget.member!.lastName;
      _selectedGender = widget.member!.gender;
      _selectedDate = widget.member!.dateOfBirth;
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate:
          _selectedDate ??
          DateTime.now().subtract(const Duration(days: 365 * 10)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _saveFamilyMember() async {
    if (!_formKey.currentState!.validate() || _selectedDate == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Please fill all fields').localized()));
      return;
    }

    setState(() => _isLoading = true);

    try {
      final memberData = FamilyMemberCreate(
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        gender: _selectedGender,
        dateOfBirth: _selectedDate!,
      );

      bool success;
      if (widget.member == null) {
        // Creating new member
        final result = await FamilyMemberService.addFamilyMember(memberData);
        success = result != null;
      } else {
        // Updating existing member
        success = await FamilyMemberService.updateFamilyMember(
          widget.member!.id,
          memberData,
        );
      }

      if (success && mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.member == null
                  ? 'Family member added successfully'
                  : 'Family member updated successfully',
            ).localized(),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final fullError = 'Error: ${e.toString()}';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(fullError).localized()),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        //backgroundColor: ssbcGray,
        //iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          widget.member == null ? 'Add Family Member' : 'Edit Family Member',
        ).localized(),
      ),
      //backgroundColor: const Color.fromARGB(255, 245, 245, 245),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    TextFormField(
                      controller: _firstNameController,
                      decoration: const InputDecoration(
                        labelText: 'First Name',
                        border: OutlineInputBorder(),
                      ).localizedLabels(),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return localize('Please enter a first name');
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _lastNameController,
                      decoration: const InputDecoration(
                        labelText: 'Last Name',
                        border: OutlineInputBorder(),
                      ).localizedLabels(),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return localize('Please enter a last name');
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>( initialValue: _selectedGender,
                      decoration: const InputDecoration(
                        labelText: 'Gender',
                        border: OutlineInputBorder(),
                      ).localizedLabels(),
                      items: [
                        DropdownMenuItem(value: 'M', child: Text('Male').localized()),
                        DropdownMenuItem(value: 'F', child: Text('Female').localized()),
                      ],
                      onChanged:
                          (value) => setState(() => _selectedGender = value!),
                    ),
                    const SizedBox(height: 16),
                    InkWell(
                      onTap: _selectDate,
                      child: InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Date of Birth',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.zero,
                          ),
                        ).localizedLabels(),
                        child: Text(
                          _selectedDate == null
                              ? 'Select date'
                              : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}',
                          style: TextStyle(
                            color:
                                _selectedDate == null
                                    ? theme.colorScheme.onSurface.withValues(
                                      alpha: 0.5,
                                    )
                                    : theme.colorScheme.onSurface,
                          ),
                        ).localized(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _saveFamilyMember,
              style: ElevatedButton.styleFrom(
                backgroundColor: theme.colorScheme.primary,
                foregroundColor: theme.colorScheme.onPrimary,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child:
                  _isLoading
                      ? SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: theme.colorScheme.onPrimary,
                          strokeWidth: 2,
                        ),
                      )
                      : Text(
                        widget.member == null
                            ? 'Add Family Member'
                            : 'Update Family Member',
                      ).localized(),
            ),
          ],
        ),
      ),
    );
  }
}


