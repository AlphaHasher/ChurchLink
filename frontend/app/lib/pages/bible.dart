import 'package:flutter/material.dart';
import '../features/bible/widgets/bible_reader_body.dart';
import '../features/bible/data/bible_repo_elisha.dart';

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
      appBar: AppBar(
        backgroundColor: const Color.fromARGB(159, 144, 79, 230),
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Padding(
          padding: EdgeInsets.only(left: 100),
          child: Text('Bible', style: TextStyle(color: Colors.white)),
        ),
      ),
      backgroundColor: const Color.fromARGB(246, 244, 236, 255),
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
