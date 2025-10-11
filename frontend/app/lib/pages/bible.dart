import 'package:flutter/material.dart';
import '../features/bible/presentation/pages/bible_reader_body.dart';
import '../features/bible/data/bible_repo_elisha.dart';
import '../helpers/bible_plan_auth_utils.dart';

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
    _boot = ElishaBibleRepo.ensureInitialized();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('screen-bible'),
      appBar: AppBar(
        backgroundColor: const Color.fromRGBO(37, 37, 37, 1),
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Padding(
          padding: EdgeInsets.only(left: 60, right: 60),
          child: Text('Bible', style: TextStyle(color: Colors.white)),
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
