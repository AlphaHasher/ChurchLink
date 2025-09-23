import 'dart:io';
import 'package:path_provider/path_provider.dart';

class LastSyncStore {
  static const _fileName = 'bible_last_sync.txt';

  static Future<File> _file() async {
    final dir = await getApplicationSupportDirectory();
    return File('${dir.path}/$_fileName');
  }

  static Future<void> markNowUtc() async {
    final f = await _file();
    await f.writeAsString(DateTime.now().toUtc().toIso8601String(), flush: true);
  }

  static Future<DateTime?> readLocal() async {
    try {
      final f = await _file();
      if (!await f.exists()) return null;
      final iso = await f.readAsString();
      final parsed = DateTime.tryParse(iso);
      return parsed?.toLocal();
    } catch (_) {
      return null;
    }
  }
}
