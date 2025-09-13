// Offline-first Notes API client.
// - Reads: server when online; cached JSON when offline
// - Writes: try server; on failure, cache + queue to outbox for later sync
//
// Routes used (FastAPI):
//   GET    /api/v1/bible-notes/reference/{book}?chapter_start=&chapter_end=&skip=&limit=
//   POST   /api/v1/bible-notes/
//   PUT    /api/v1/bible-notes/{id}
//   DELETE /api/v1/bible-notes/{id}
//
// Auth: Firebase UID bearer token.

import 'dart:async';
import 'dart:convert';
import 'dart:io' show File, Platform;
import 'dart:math';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kDebugMode, debugPrint, kIsWeb;
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// ---------------------------------------------------------------------------
/// Config
/// ---------------------------------------------------------------------------
class NotesApiConfig {
  /// Priority:
  /// 1) --dart-define=API_BASE_URL
  /// 2) .env (flutter_dotenv) key: API_BASE_URL
  /// 3) Platform.environment (desktop)
  static String get baseUrl {
    const fromDefine = String.fromEnvironment('API_BASE_URL');
    if (fromDefine.isNotEmpty) return fromDefine;

    final env = dotenv.maybeGet('API_BASE_URL');
    if (env != null && env.isNotEmpty) return env;

    final pe = Platform.environment['API_BASE_URL'];
    if (!kIsWeb && pe != null && pe.isNotEmpty) return pe;

    throw StateError('API_BASE_URL not configured');
  }
}

Future<String> _token() async {
  final u = FirebaseAuth.instance.currentUser;
  if (u == null) throw StateError('Not authenticated');
  // getIdToken may be Future<String> or Future<String?> depending on version
  final t = await u.getIdToken();
  if (t == null || t.isEmpty) {
    throw StateError('Failed to obtain Firebase ID token');
  }
  return t;
}

Future<Map<String, String>> _headers() async => {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${await _token()}',
    };

/// ---------------------------------------------------------------------------
/// Data Model (wire ↔ cache)
/// ---------------------------------------------------------------------------

enum ServerHighlight { blue, red, yellow, green, purple, pink, teal }

ServerHighlight? serverHighlightFrom(String? s) {
  if (s == null) return null;
  switch (s) {
    case 'blue':
      return ServerHighlight.blue;
    case 'red':
      return ServerHighlight.red;
    case 'yellow':
      return ServerHighlight.yellow;
    case 'green':
      return ServerHighlight.green;
    case 'purple':
      return ServerHighlight.purple;
    case 'pink':
      return ServerHighlight.pink;
    case 'teal':
      return ServerHighlight.teal;
    default:
      return null;
  }
}

String? serverHighlightToString(ServerHighlight? c) => c?.name;

/// Minimal server note object.
/// Field names align with your FastAPI Pydantic models.
class RemoteNote {
  final String id; // server id or local-*
  final String book;
  final int chapter;
  final int verseStart;
  final int? verseEnd;
  final String note;
  final ServerHighlight? color;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  RemoteNote({
    required this.id,
    required this.book,
    required this.chapter,
    required this.verseStart,
    required this.verseEnd,
    required this.note,
    required this.color,
    this.createdAt,
    this.updatedAt,
  });

  factory RemoteNote.fromJson(Map<String, dynamic> j) => RemoteNote(
        id: (j['id'] ?? j['_id'] ?? '').toString(),
        book: j['book'] as String,
        chapter: (j['chapter'] as num).toInt(),
        verseStart: (j['verse_start'] as num).toInt(),
        verseEnd: j['verse_end'] == null ? null : (j['verse_end'] as num).toInt(),
        note: (j['note'] ?? '') as String,
        color: serverHighlightFrom(j['highlight_color'] as String?),
        createdAt: j['created_at'] != null
            ? DateTime.tryParse(j['created_at'].toString())?.toUtc()
            : null,
        updatedAt: j['updated_at'] != null
            ? DateTime.tryParse(j['updated_at'].toString())?.toUtc()
            : null,
      );

  Map<String, dynamic> toCreateJson() => {
        'book': book,
        'chapter': chapter,
        'verse_start': verseStart,
        if (verseEnd != null) 'verse_end': verseEnd,
        'note': note,
        if (color != null) 'highlight_color': serverHighlightToString(color),
      };

  Map<String, dynamic> toUpdateJson({String? noteOverride, ServerHighlight? colorOverride}) {
    final map = <String, dynamic>{};
    if (noteOverride != null) map['note'] = noteOverride;
    if (colorOverride != null) map['highlight_color'] = colorOverride.name;
    return map;
  }

  // ---- Local cache helpers ----
  Map<String, dynamic> toCacheJson() => {
        'id': id,
        'book': book,
        'chapter': chapter,
        'verse_start': verseStart,
        'verse_end': verseEnd,
        'note': note,
        'highlight_color': serverHighlightToString(color),
        'created_at': (createdAt ?? DateTime.now().toUtc()).toIso8601String(),
        'updated_at': (updatedAt ?? DateTime.now().toUtc()).toIso8601String(),
      };

  factory RemoteNote.fromCache(Map<String, dynamic> j) => RemoteNote(
        id: (j['id'] ?? '').toString(),
        book: j['book'] as String,
        chapter: (j['chapter'] as num).toInt(),
        verseStart: (j['verse_start'] as num).toInt(),
        verseEnd: j['verse_end'] == null ? null : (j['verse_end'] as num).toInt(),
        note: (j['note'] ?? '') as String,
        color: serverHighlightFrom(j['highlight_color'] as String?),
        createdAt: j['created_at'] != null
            ? DateTime.tryParse(j['created_at'].toString())?.toUtc()
            : null,
        updatedAt: j['updated_at'] != null
            ? DateTime.tryParse(j['updated_at'].toString())?.toUtc()
            : null,
      );

  RemoteNote copyWith({
    String? id,
    String? book,
    int? chapter,
    int? verseStart,
    int? verseEnd,
    String? note,
    ServerHighlight? color,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) =>
      RemoteNote(
        id: id ?? this.id,
        book: book ?? this.book,
        chapter: chapter ?? this.chapter,
        verseStart: verseStart ?? this.verseStart,
        verseEnd: verseEnd ?? this.verseEnd,
        note: note ?? this.note,
        color: color ?? this.color,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}

/// ---------------------------------------------------------------------------
/// Offline cache + Outbox (file-based; simple, durable enough for now)
/// ---------------------------------------------------------------------------
class _Offline {
  static File? _cacheFile;
  static File? _outboxFile;

  static Future<File?> _file(String name) async {
    if (kIsWeb) return null; // web offline not implemented here
    final dir = await getApplicationDocumentsDirectory();
    final f = File('${dir.path}/$name');
    if (!await f.exists()) {
      await f.create(recursive: true);
      await f.writeAsString(name.endsWith('.json') ? '{}' : '[]', flush: true);
    }
    return f;
  }

  static Future<File?> _ensureCache() async => _cacheFile ??= await _file('notes_cache.json');
  static Future<File?> _ensureOutbox() async => _outboxFile ??= await _file('notes_outbox.json');

  // ---- cache shape: { "<id>": RemoteNoteJson, ... }
  static Future<Map<String, dynamic>> _readCache() async {
    final f = await _ensureCache();
    if (f == null) return {};
    try {
      return (json.decode(await f.readAsString()) as Map).cast<String, dynamic>();
    } catch (_) {
      return {};
    }
  }

  static Future<void> _writeCache(Map<String, dynamic> m) async {
    final f = await _ensureCache();
    if (f != null) {
      await f.writeAsString(json.encode(m), flush: true);
    }
  }

  static Future<void> upsert(RemoteNote n) async {
    final m = await _readCache();
    m[n.id] = n.toCacheJson();
    await _writeCache(m);
  }

  static Future<void> remove(String id) async {
    final m = await _readCache();
    m.remove(id);
    await _writeCache(m);
  }

  static Future<RemoteNote?> getById(String id) async {
    final m = await _readCache();
    final v = m[id];
    if (v == null) return null;
    return RemoteNote.fromCache((v as Map).cast<String, dynamic>());
  }

  static Future<List<RemoteNote>> listByRange({
    required String book,
    required int chapterStart,
    required int chapterEnd,
  }) async {
    final m = await _readCache();
    final out = <RemoteNote>[];
    for (final v in m.values) {
      final j = (v as Map).cast<String, dynamic>();
      if (j['book'] == book) {
        final ch = (j['chapter'] as num).toInt();
        if (ch >= chapterStart && ch <= chapterEnd) {
          out.add(RemoteNote.fromCache(j));
        }
      }
    }
    return out;
  }

  // ---- outbox shape: [{ op, note, key, ts }]
  static Future<List<Map<String, dynamic>>> _readOutbox() async {
    final f = await _ensureOutbox();
    if (f == null) return [];
    try {
      return (json.decode(await f.readAsString()) as List).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _writeOutbox(List<Map<String, dynamic>> items) async {
    final f = await _ensureOutbox();
    if (f != null) {
      await f.writeAsString(json.encode(items), flush: true);
    }
  }

  static String newLocalId() =>
      'local-${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}';
  static String _idKey() =>
      'k-${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}';

  // coalesce updates into a pending create for local-* ids
  static Future<void> enqueue(String op, RemoteNote note) async {
    final items = await _readOutbox();

    if (op != 'delete') {
      final i = items.indexWhere(
          (x) => (x['op'] == 'create') && (((x['note'] as Map)['id'] ?? '') == note.id));
      if (i >= 0) {
        items[i]['note'] = note.toCacheJson(); // fold into existing create
        await _writeOutbox(items);
        return;
      }
    }

    items.add({
      'op': op,
      'note': note.toCacheJson(),
      'key': _idKey(),
      'ts': DateTime.now().millisecondsSinceEpoch,
    });
    await _writeOutbox(items);
  }

  static Future<bool> _online() async {
    try {
      final r = await Connectivity().checkConnectivity();
      return r != ConnectivityResult.none;
    } catch (_) {
      return false;
    }
  }

  static Future<void> drainOutbox() async {
    if (!await _online()) return;

    var items = await _readOutbox();
    if (items.isEmpty) return;

    items.sort((a, b) => (a['ts'] as int).compareTo(b['ts'] as int));
    final keep = <Map<String, dynamic>>[];

    for (final it in items) {
      final op = (it['op'] as String);
      final n =
          RemoteNote.fromCache((it['note'] as Map).cast<String, dynamic>());

      try {
        if (op == 'create') {
          final created = await NotesApi._createOnline(n);
          if (n.id.startsWith('local-')) {
            await _Offline.remove(n.id); // drop local id entry
          }
          await _Offline.upsert(created); // insert server copy
        } else if (op == 'update') {
          final updated =
              await NotesApi._updateOnline(n.id, note: n.note, color: n.color);
          await _Offline.upsert(updated);
        } else if (op == 'delete') {
          await NotesApi._deleteOnline(n.id);
          await _Offline.remove(n.id);
        }
      } catch (_) {
        keep.add(it); // retry later
      }
    }

    await _writeOutbox(keep);
  }

  static Future<RemoteNote> clearHighlight(String id) async {
    final uri = Uri.parse('${NotesApiConfig.baseUrl}/api/v1/bible-notes/$id');
    final hdr = await _headers();
    final body = json.encode({'highlight_color': null});
    if (kDebugMode) {
      debugPrint('[NotesApi] PUT  $uri');
      debugPrint('[NotesApi] body: $body');
    }
    final r = await http.put(uri, headers: hdr, body: body);
    if (kDebugMode) debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    if (r.statusCode != 200) {
      throw StateError('PUT(clearHighlight) failed: ${r.statusCode} ${r.body}');
    }
    return RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }


}

/// ---------------------------------------------------------------------------
/// Public API
/// ---------------------------------------------------------------------------
class NotesApi {
  // -- Internal online helpers (used by both direct calls and outbox) --------
  static Future<RemoteNote> _createOnline(RemoteNote draft) async {
    final uri = Uri.parse('${NotesApiConfig.baseUrl}/api/v1/bible-notes/');
    final hdr = await _headers();
    final body = json.encode(draft.toCreateJson());
    if (kDebugMode) {
      debugPrint('[NotesApi] POST $uri');
      debugPrint('[NotesApi] body: $body');
    }
    final r = await http.post(uri, headers: hdr, body: body);
    if (kDebugMode) debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw StateError('POST note failed: ${r.statusCode} ${r.body}');
    }
    return RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  static Future<RemoteNote> _updateOnline(String id,
      {String? note, ServerHighlight? color}) async {
    final uri = Uri.parse('${NotesApiConfig.baseUrl}/api/v1/bible-notes/$id');
    final hdr = await _headers();
    final bodyMap = <String, dynamic>{};
    if (note != null) bodyMap['note'] = note;
    if (color != null) bodyMap['highlight_color'] = color.name;
    final body = json.encode(bodyMap);
    if (kDebugMode) {
      debugPrint('[NotesApi] PUT  $uri');
      debugPrint('[NotesApi] body: $body');
    }
    final r = await http.put(uri, headers: hdr, body: body);
    if (kDebugMode) debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    if (r.statusCode != 200) {
      throw StateError('PUT failed: ${r.statusCode} ${r.body}');
    }
    return RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  static Future<void> _deleteOnline(String id) async {
    final uri = Uri.parse('${NotesApiConfig.baseUrl}/api/v1/bible-notes/$id');
    final hdr = await _headers();
    if (kDebugMode) debugPrint('[NotesApi] DELETE $uri');
    final r = await http.delete(uri, headers: hdr);
    if (kDebugMode) debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    if (r.statusCode != 200) {
      throw StateError('DELETE failed: ${r.statusCode} ${r.body}');
    }
  }

  // -- Public methods --------------------------------------------------------

  /// Fetch notes across a chapter window (preferred in your UI).
  static Future<List<RemoteNote>> getNotesForChapterRange({
    required String book,
    required int chapterStart,
    required int chapterEnd,
    int skip = 0,
    int limit = 2000,
  }) async {
    // Try server first
    try {
      final uri = Uri.parse(
              '${NotesApiConfig.baseUrl}/api/v1/bible-notes/reference/$book')
          .replace(queryParameters: {
        'chapter_start': '$chapterStart',
        'chapter_end': '$chapterEnd',
        'skip': '$skip',
        'limit': '$limit',
      });

      final hdr = await _headers();
      if (kDebugMode) debugPrint('[NotesApi] GET $uri');
      final r = await http.get(uri, headers: hdr);
      if (kDebugMode) debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
      if (r.statusCode != 200) throw StateError('GET notes failed');

      final data = (json.decode(r.body) as List)
          .map((e) => RemoteNote.fromJson(e as Map<String, dynamic>))
          .toList();

      // refresh cache
      for (final n in data) {
        await _Offline.upsert(
            n.copyWith(updatedAt: n.updatedAt ?? DateTime.now().toUtc()));
      }

      // kick outbox drain (fire-and-forget)
      scheduleMicrotask(() {
        _Offline.drainOutbox();
      });

      return data;
    } catch (_) {
      // Offline: return cached window
      final cached = await _Offline.listByRange(
          book: book, chapterStart: chapterStart, chapterEnd: chapterEnd);

      // still attempt a drain later
      scheduleMicrotask(() {
        _Offline.drainOutbox();
      });

      if (kDebugMode) {
        debugPrint(
            '[NotesApi] offline cache hit for $book $chapterStart-$chapterEnd: ${cached.length}');
      }
      return cached;
    }
  }

  /// Convenience single-chapter fetch (if you call it elsewhere).
  static Future<List<RemoteNote>> getNotesForChapter({
    required String book,
    required int chapter,
    int skip = 0,
    int limit = 2000,
  }) =>
      getNotesForChapterRange(
          book: book, chapterStart: chapter, chapterEnd: chapter, skip: skip, limit: limit);

  static Future<RemoteNote> create(RemoteNote draft) async {
    try {
      final created = await _createOnline(draft);
      await _Offline.upsert(created);
      scheduleMicrotask(() {
        _Offline.drainOutbox();
      });
      return created;
    } catch (_) {
      // Offline create -> assign local id, cache, queue
      final now = DateTime.now().toUtc();
      final local = draft.copyWith(
        id: _Offline.newLocalId(),
        createdAt: now,
        updatedAt: now,
      );
      await _Offline.upsert(local);
      await _Offline.enqueue('create', local);
      if (kDebugMode) debugPrint('[NotesApi] create queued offline id=${local.id}');
      return local;
    }
  }

  static Future<RemoteNote> update(
    String id, {
    String? note,
    ServerHighlight? color,
  }) async {
    try {
      final updated = await _updateOnline(id, note: note, color: color);
      await _Offline.upsert(updated);
      scheduleMicrotask(() {
        _Offline.drainOutbox();
      });
      return updated;
    } catch (_) {
      // Offline update -> merge into cache and queue
      final prev = await _Offline.getById(id);
      final now = DateTime.now().toUtc();
      final merged = (prev ??
              RemoteNote(
                id: id,
                book: '',
                chapter: 0,
                verseStart: 0,
                verseEnd: null,
                note: '',
                color: null,
                createdAt: now,
                updatedAt: now,
              ))
          .copyWith(
        note: note ?? prev?.note,
        color: color ?? prev?.color,
        updatedAt: now,
      );
      await _Offline.upsert(merged);
      await _Offline.enqueue('update', merged);
      if (kDebugMode) debugPrint('[NotesApi] update queued offline id=$id');
      return merged;
    }
  }

  static Future<void> delete(String id) async {
    try {
      await _deleteOnline(id);
      await _Offline.remove(id);
      scheduleMicrotask(() {
        _Offline.drainOutbox();
      });
    } catch (_) {
      final prev = await _Offline.getById(id);
      if (prev != null && id.startsWith('local-')) {
        // never reached server; just drop locally
        await _Offline.remove(id);
      } else {
        // queue a real delete for server ids
        await _Offline.enqueue(
            'delete',
            RemoteNote(
              id: id,
              book: prev?.book ?? '',
              chapter: prev?.chapter ?? 0,
              verseStart: prev?.verseStart ?? 0,
              verseEnd: prev?.verseEnd,
              note: prev?.note ?? '',
              color: prev?.color,
              createdAt: prev?.createdAt,
              updatedAt: DateTime.now().toUtc(),
            ));
        await _Offline.remove(id); // optimistic local delete
      }
      if (kDebugMode) debugPrint('[NotesApi] delete queued offline id=$id');
    }
  }

  /// Call on app start / on Bible tab focus / on connectivity change.
  static Future<void> trySyncOutbox() => _Offline.drainOutbox();
}
