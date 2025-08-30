import 'package:flutter/material.dart';
// adjust the path if needed based on your folders:
import '../features/bible/widgets/bible_reader_body.dart';

class BiblePage extends StatefulWidget {
  const BiblePage({super.key});

  @override
  State<BiblePage> createState() => _BiblePageState();
}

class _BiblePageState extends State<BiblePage> {
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
      body: const SafeArea(
        minimum: EdgeInsets.symmetric(horizontal: 10),
        // ⬇️ Drop-in reader UI (no SingleChildScrollView here)
        child: BibleReaderBody(),
      ),
    );
  }
}
