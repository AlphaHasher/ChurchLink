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

  List<Map<String, dynamic>> get _fields {
    final data = widget.form['data'];
    if (data is List) return List<Map<String, dynamic>>.from(data);
    return [];
  }

  Widget _buildField(Map<String, dynamic> f) {
    final type = (f['type'] ?? 'text').toString();
    final key = f['key'] ?? f['name'] ?? f['id'] ?? f['label'] ?? UniqueKey().toString();
    final label = f['label'] ?? f['name'] ?? '';
    final required = f['required'] == true;

    switch (type) {
      case 'textarea':
        return TextFormField(
          initialValue: _values[key]?.toString(),
          decoration: InputDecoration(labelText: label),
          maxLines: 4,
          validator: required
              ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
              : null,
          onSaved: (v) => _values[key] = v ?? '',
        );

      case 'email':
        return TextFormField(
          initialValue: _values[key]?.toString(),
          decoration: InputDecoration(labelText: label),
          keyboardType: TextInputType.emailAddress,
          validator: (v) {
            if (required && (v == null || v.trim().isEmpty)) return 'Required';
            if (v != null && v.isNotEmpty && !RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").hasMatch(v)) return 'Invalid email';
            return null;
          },
          onSaved: (v) => _values[key] = v ?? '',
        );

      case 'number':
        return TextFormField(
          initialValue: _values[key]?.toString(),
          decoration: InputDecoration(labelText: label),
          keyboardType: TextInputType.number,
          validator: (v) {
            if (required && (v == null || v.trim().isEmpty)) return 'Required';
            if (v != null && v.isNotEmpty && double.tryParse(v) == null) return 'Invalid number';
            return null;
          },
          onSaved: (v) => _values[key] = v != null && v.isNotEmpty ? double.tryParse(v) : null,
        );

      case 'checkbox':
        final bool current = _values[key] == true;
        return CheckboxListTile(
          value: current,
          title: Text(label),
          controlAffinity: ListTileControlAffinity.leading,
          onChanged: (val) => setState(() => _values[key] = val ?? false),
        );

      case 'switch':
        final bool current = _values[key] == true;
        return SwitchListTile(
          value: current,
          title: Text(label),
          onChanged: (val) => setState(() => _values[key] = val),
        );

      case 'select':
      case 'radio':
        final List options = f['options'] ?? f['choices'] ?? [];
        final String? current = _values[key]?.toString();
        return FormField<String>(
          initialValue: current,
          validator: required
              ? (v) => (v == null || v.isEmpty) ? 'Required' : null
              : null,
          builder: (state) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (label.isNotEmpty) Text(label),
              ...options.map<Widget>((opt) {
                final val = opt is Map ? (opt['value'] ?? opt['id'] ?? opt['label']) : opt;
                final display = opt is Map ? (opt['label'] ?? opt['value'] ?? opt['id'] ?? opt.toString()) : opt.toString();
                return ListTile(
                  leading: Radio<String>(
                    value: val.toString(),
                    groupValue: state.value,
                    onChanged: (v) {
                      state.didChange(v);
                      _values[key] = v;
                    },
                  ),
                  title: Text(display.toString()),
                  onTap: () {
                    state.didChange(val.toString());
                    _values[key] = val.toString();
                  },
                );
              }).toList(),
              if (state.hasError)
                Padding(
                  padding: const EdgeInsets.only(left: 12.0, top: 4),
                  child: Text(state.errorText ?? '', style: TextStyle(color: Colors.red[700], fontSize: 12)),
                )
            ],
          ),
        );

      case 'date':
        final String? current = _values[key]?.toString();
        return ListTile(
          title: Text(label),
          subtitle: Text(current ?? 'Select date'),
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime.tryParse(current ?? '') ?? DateTime.now(),
              firstDate: DateTime(1900),
              lastDate: DateTime(2100),
            );
            if (picked != null) setState(() => _values[key] = picked.toIso8601String());
          },
        );

      case 'time':
        final String? current = _values[key]?.toString();
        return ListTile(
          title: Text(label),
          subtitle: Text(current ?? 'Select time'),
          onTap: () async {
            final t = TimeOfDay.fromDateTime(DateTime.tryParse(current ?? '') ?? DateTime.now());
            final picked = await showTimePicker(context: context, initialTime: t);
            if (picked != null) setState(() => _values[key] = picked.format(context));
          },
        );

      default:
        // default to simple text input
        return TextFormField(
          initialValue: _values[key]?.toString(),
          decoration: InputDecoration(labelText: label),
          validator: required
              ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
              : null,
          onSaved: (v) => _values[key] = v ?? '',
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
      final slug = widget.form['slug'];
      
      final response = await api.post('/v1/forms/slug/${slug.toString()}/responses', data: _values);
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Response submitted')));
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

    return Scaffold(
      appBar: AppBar(title: Text(title), backgroundColor: Colors.black),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            children: [
              if (description.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8.0), child: Text(description)),
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView.separated(
                    itemCount: _fields.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final f = _fields[index];
                      return _buildField(f);
                    },
                  ),
                ),
              ),
              if (_error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.black),
                  child: _submitting ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Submit'),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
