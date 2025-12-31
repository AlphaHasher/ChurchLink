import 'package:flutter/material.dart';
import 'package:app/pages/bible_reader/bible_reader_body.dart';
import 'package:app/services/bible/local_bible_repository.dart';
import 'package:app/helpers/bible_plan_auth_utils.dart';

class BiblePage extends StatefulWidget {
  const BiblePage({super.key});
  @override
  State<BiblePage> createState() => _BiblePageState();
}

class _BiblePageState extends State<BiblePage> {
  late Future<void> _boot;

  @override
  void initState() {
    super.initState();
    _boot = LocalBibleRepository.ensureInitialized();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('screen-bible'),
      appBar: AppBar(
        centerTitle: true,
        title: const Padding(
          padding: EdgeInsets.only(left: 60, right: 60),
          child: Text('Bible'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.list_alt),
            onPressed: () {
              // Allow navigation to page to show the login reminder card
              BiblePlanAuthUtils.navigateToMyBiblePlans(
                context,
                allowPageAccess: true,
                showLoginReminder: false,
              );
            },
            tooltip: 'My Reading Plans',
          ),
        ],
      ),
      body: FutureBuilder<void>(
        future: _boot,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('Error: ${snap.error}'));
          }
          return const SafeArea(
            minimum: EdgeInsets.symmetric(horizontal: 10),
            child: BibleReaderBody(),
          );
        },
      ),
    );
  }
}
