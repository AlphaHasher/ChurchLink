import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:app/models/legal_model.dart';
import 'package:app/helpers/legal_helper.dart';

class LegalPageScreen extends StatefulWidget {
  final String slug;      // "terms" | "privacy" | "refunds"
  final String? locale;   // optional: e.g., "en"

  const LegalPageScreen({super.key, required this.slug, this.locale});

  @override
  State<LegalPageScreen> createState() => _LegalPageScreenState();
}

class _LegalPageScreenState extends State<LegalPageScreen> {
  late Future<LegalPageDto> _future;

  @override
  void initState() {
    super.initState();
    _future = LegalApi.fetchPage(widget.slug, locale: widget.locale);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<LegalPageDto>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.hasError) {
          return Scaffold(
            appBar: AppBar(title: const Text('Legal')),
            body: Center(
              child: Text('Failed to load. ${snap.error}'),
            ),
          );
        }
        final data = snap.data!;
        return Scaffold(
          appBar: AppBar(title: Text(data.title)),
          body: Markdown(
            data: data.contentMarkdown,
            padding: const EdgeInsets.all(16),
          ),
        );
      },
    );
  }
}
