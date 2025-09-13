// Lightweight client for Bible Note routes.
//
// Routes defined in backend\routes\bible_routes\bible_note_routes.py:
//   GET  /api/v1/bible-notes/reference/{book}
//   GET  /api/v1/bible-notes/reference/{book}/{chapter}
//   POST /api/v1/bible-notes/
//   PUT  /api/v1/bible-notes/{note_id}
//   DELETE /api/v1/bible-notes/{note_id}
//
// Auth: Firebase UID bearer token.

import 'dart:convert';
import 'package:flutter/foundation.dart' show kDebugMode, debugPrint;
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:async';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Defines the URL for the backend. 
/// Uses the Android Flutter default if API_BASE_URL is not in .env
class NotesApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );
}

enum ServerHighlight { blue, red, yellow, green, purple }

/// Convert between possible formats for Highlight colors
ServerHighlight? serverHighlightFrom(String? s) {
  switch ((s ?? '').toLowerCase()) {
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
    default:
      return null;
  }
}

String? serverHighlightToString(ServerHighlight? c) => c?.name;

/// Reformats information for use with the server
class RemoteNote {
  final String id;
  final String book; // canonical English name
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
        id: j['id']?.toString() ?? j['_id']?.toString() ?? '',
        book: j['book'] as String,
        chapter: (j['chapter'] as num).toInt(),
        verseStart: (j['verse_start'] as num).toInt(),
        verseEnd: j['verse_end'] == null ? null : (j['verse_end'] as num).toInt(),
        note: (j['note'] as String?) ?? '',
        color: serverHighlightFrom(j['highlight_color'] as String?),
        createdAt: j['created_at'] != null
            ? DateTime.tryParse(j['created_at'].toString())
            : null,
        updatedAt: j['updated_at'] != null
            ? DateTime.tryParse(j['updated_at'].toString())
            : null,
      );

  /// Backend requires a highlight_color on create; default to yellow if none chosen.
  Map<String, dynamic> toCreateJson() => {
        'book': book,
        'chapter': chapter,
        'verse_start': verseStart,
        if (verseEnd != null) 'verse_end': verseEnd,
        'note': note,
        'highlight_color': (color ?? ServerHighlight.yellow).name,
      };
}

/// Handles communication with the backend
class NotesApi {
  static Future<String> _token() async {
    final u = FirebaseAuth.instance.currentUser;
    if (u == null) {
      throw StateError('Not authenticated');
    }

    String? tok = await u.getIdToken();
    if (tok == null || tok.isEmpty) {
      tok = await u.getIdToken(true);
    }
    if (tok == null || tok.isEmpty) {
      throw StateError('Failed to obtain Firebase ID token');
    }
    return tok;
  }

  static Map<String, String> _headers(String token) => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  static Uri _u(String path, [Map<String, String>? qp]) =>
      Uri.parse('${NotesApiConfig.baseUrl}$path').replace(queryParameters: qp);

  // Detect offline errors
  static bool _isOffline(Object e) =>
      e is SocketException || e is HttpException || e is TimeoutException;

  // TODO: small backoff timer to retry draining shortly after we enqueue
  static Timer? _retryTimer; // TODO
  static void _scheduleRetry() { // TODO
    _retryTimer?.cancel();
    _retryTimer = Timer(const Duration(seconds: 7), () {
      if (kDebugMode) debugPrint('[Outbox] scheduled drain');
      NotesApi.drainOutbox();
    });
  }

  /// Read notes for a book and chapter range (inclusive).
  static Future<List<RemoteNote>> getNotesForChapterRange({
    required String book,
    required int chapterStart,
    required int chapterEnd,
    int skip = 0,
    int limit = 2000,
  }) async {
    final t = await _token();
    final uri = _u(
      '/api/v1/bible-notes/reference/$book',
      {
        'chapter_start': '$chapterStart',
        'chapter_end': '$chapterEnd',
        'skip': '$skip',
        'limit': '$limit',
      },
    );

    if (kDebugMode) debugPrint('[NotesApi] GET $uri');
    try {
      final r = await http.get(uri, headers: _headers(t));
      if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode}');

      if (r.statusCode != 200) {
        throw StateError('GET notes (range) failed: ${r.statusCode} ${r.body}');
      }
      final data = json.decode(r.body) as List;
      var notes = data
          .map((e) => RemoteNote.fromJson(e as Map<String, dynamic>))
          .toList();

      // TODO: write fresh server data into cache so offline has it
      await _Cache.upsertMany(notes);

      // TODO: keep offline temps visible until they sync
      final cachedForRange = await _Cache.getRange(
        book,
        chapterStart: chapterStart,
        chapterEnd: chapterEnd,
      );
      final pendingTemps =
          cachedForRange.where((n) => n.id.startsWith('temp_')).toList();

      if (pendingTemps.isNotEmpty) {
        final seenKey = <String>{};
        for (final n in notes) {
          seenKey.add('${n.chapter}|${n.verseStart}');
        }
        for (final tnote in pendingTemps) {
          final key = '${tnote.chapter}|${tnote.verseStart}';
          if (!seenKey.contains(key)) {
            notes.add(tnote);
          }
        }
      }

      return notes;
    } catch (e) {
      if (_isOffline(e)) {
        if (kDebugMode) debugPrint('[NotesApi] offline GET -> cache fallback');
        final cached = await _Cache.getRange(
          book,
          chapterStart: chapterStart,
          chapterEnd: chapterEnd,
        );
        _scheduleRetry(); // TODO
        return cached;
      }
      rethrow;
    }
  }

  // TODO: keep raw online paths so the outbox can call them directly
  static Future<RemoteNote> _createOnline(RemoteNote draft) async {
    final t = await _token();
    final uri = _u('/api/v1/bible-notes/');
    if (kDebugMode) {
      debugPrint('[NotesApi] POST $uri body=${draft.toCreateJson()}');
    }
    final r = await http.post(
      uri,
      headers: _headers(t),
      body: json.encode(draft.toCreateJson()),
    );
    if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode} ${r.body}');
    if (r.statusCode != 200 && r.statusCode != 201) {
      throw StateError('POST note failed: ${r.statusCode} ${r.body}');
    }
    final created =
        RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);

    // TODO: reflect server success into cache
    await _Cache.upsert(created);

    return created;
  }

  // TODO: keep raw online paths so the outbox can call them directly
  static Future<RemoteNote> _updateOnline(
    String id, {
    String? note,
    ServerHighlight? color,
  }) async {
    final t = await _token();
    final uri = _u('/api/v1/bible-notes/$id');

    final body = <String, dynamic>{};
    if (note != null) body['note'] = note;
    if (color != null) body['highlight_color'] = color.name;

    if (kDebugMode) debugPrint('[NotesApi] PUT $uri body=$body');
    final r =
        await http.put(uri, headers: _headers(t), body: json.encode(body));
    if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode} ${r.body}');

    if (r.statusCode != 200) {
      throw StateError('PUT note failed: ${r.statusCode} ${r.body}');
    }
    final updated =
        RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);

    // TODO: reflect server success into cache
    await _Cache.upsert(updated);

    return updated;
  }

  // TODO: keep raw online paths so the outbox can call them directly
  static Future<void> _deleteOnline(String id) async {
    final t = await _token();
    final uri = _u('/api/v1/bible-notes/$id');

    if (kDebugMode) debugPrint('[NotesApi] DELETE $uri');
    final r = await http.delete(uri, headers: _headers(t));
    if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode} ${r.body}');

    if (r.statusCode != 200) {
      throw StateError('DELETE note failed: ${r.statusCode} ${r.body}');
    }

    // TODO: reflect server success into cache
    await _Cache.removeById(id);
  }

  /// Create a note/highlight row. (Highlights are required to add notes).
  static Future<RemoteNote> create(RemoteNote draft) async {
    try {
      // primary online path
      return await _createOnline(draft);
    } catch (e) {
      if (_isOffline(e)) {
        // TODO: enqueue + cache optimistic temp item
        final tempId = 'temp_${DateTime.now().microsecondsSinceEpoch}';
        await _Outbox.enqueueCreate(tempId, draft.toCreateJson());
        final optimistic = RemoteNote(
          id: tempId,
          book: draft.book,
          chapter: draft.chapter,
          verseStart: draft.verseStart,
          verseEnd: draft.verseEnd,
          note: draft.note,
          color: draft.color ?? ServerHighlight.yellow,
          createdAt: DateTime.now(),
          updatedAt: null,
        );
        await _Cache.upsert(optimistic); // TODO
        _scheduleRetry(); // TODO
        return optimistic;
      }
      rethrow;
    }
  }

  /// Update a note and/or color.
  /// Note: backend ignores null fields; you cannot clear color to null via update.
  static Future<RemoteNote> update(
    String id, {
    String? note,
    ServerHighlight? color,
  }) async {
    try {
      // primary online path
      return await _updateOnline(id, note: note, color: color);
    } catch (e) {
      if (_isOffline(e)) {
        // TODO: enqueue; also mutate cache if note exists locally
        await _Outbox.enqueueUpdate(id, note: note, color: color);
        await _Cache.updatePartial(id, note: note, color: color); // TODO
        _scheduleRetry(); // TODO
        // Return a stub; most callers ignore the value.
        return RemoteNote(
          id: id,
          book: '',
          chapter: 0,
          verseStart: 0,
          verseEnd: null,
          note: note ?? '',
          color: color,
          createdAt: null,
          updatedAt: null,
        );
      }
      rethrow;
    }
  }

  /// Delete a note row (removes both note text and highlight).
  static Future<void> delete(String id) async {
    try {
      // primary online path
      await _deleteOnline(id);
    } catch (e) {
      if (_isOffline(e)) {
        // TODO: enqueue; also remove from cache so UI hides it offline
        await _Outbox.enqueueDelete(id);
        await _Cache.removeById(id); // TODO
        _scheduleRetry(); // TODO
        return;
      }
      rethrow;
    }
  }

  // TODO: expose a public drain so you can call this at boot/resume
  static Future<void> drainOutbox() => _Outbox.drain(); // TODO
}

// -----------------------------------------------------------------------------
// TODO: Minimal file cache for notes so offline reads show recent edits.
// Stores an array of note JSONs, upserts on writes, and filters by range.
// -----------------------------------------------------------------------------
class _Cache {
  static const _fileName = 'notes_cache.json';

  static Future<File> _file() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_fileName');
  }

  static Future<List<Map<String, dynamic>>> _readAll() async {
    try {
      final f = await _file();
      if (!await f.exists()) return <Map<String, dynamic>>[];
      final txt = await f.readAsString();
      if (txt.trim().isEmpty) return <Map<String, dynamic>>[];
      final raw = json.decode(txt);
      if (raw is Map && raw['notes'] is List) {
        return (raw['notes'] as List)
            .cast<Map>()
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
      if (raw is List) {
        // legacy shape
        return raw
            .cast<Map>()
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
      return <Map<String, dynamic>>[];
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  static Future<void> _writeAll(List<Map<String, dynamic>> notes) async {
    final f = await _file();
    await f.writeAsString(json.encode({'notes': notes}));
  }

  static Future<void> upsert(RemoteNote n) async {
    final all = await _readAll();
    final idx = all.indexWhere((m) => (m['id']?.toString() ?? '') == n.id);
    final noteJson = {
      'id': n.id,
      'book': n.book,
      'chapter': n.chapter,
      'verse_start': n.verseStart,
      'verse_end': n.verseEnd,
      'note': n.note,
      'highlight_color': n.color?.name,
      'created_at': n.createdAt?.toIso8601String(),
      'updated_at': n.updatedAt?.toIso8601String(),
    };
    if (idx >= 0) {
      all[idx] = noteJson;
    } else {
      all.add(noteJson);
    }
    await _writeAll(all);
  }

  static Future<void> upsertMany(List<RemoteNote> notes) async {
    final all = await _readAll();
    for (final n in notes) {
      final idx = all.indexWhere((m) => (m['id']?.toString() ?? '') == n.id);
      final noteJson = {
        'id': n.id,
        'book': n.book,
        'chapter': n.chapter,
        'verse_start': n.verseStart,
        'verse_end': n.verseEnd,
        'note': n.note,
        'highlight_color': n.color?.name,
        'created_at': n.createdAt?.toIso8601String(),
        'updated_at': n.updatedAt?.toIso8601String(),
      };
      if (idx >= 0) {
        all[idx] = noteJson;
      } else {
        all.add(noteJson);
      }
    }
    await _writeAll(all);
  }

  static Future<List<RemoteNote>> getRange(
    String book, {
    required int chapterStart,
    required int chapterEnd,
  }) async {
    final all = await _readAll();
    final filtered = all.where((m) {
      final b = (m['book'] as String?) ?? '';
      final ch = (m['chapter'] as num?)?.toInt() ?? -1; // TODO
      return b == book && ch >= chapterStart && ch <= chapterEnd;
    }).toList()
      ..sort((a, b) {
        final ca = (a['chapter'] as num?)?.toInt() ?? 0; // TODO
        final cb = (b['chapter'] as num?)?.toInt() ?? 0; // TODO
        final va = (a['verse_start'] as num?)?.toInt() ?? 0; // TODO
        final vb = (b['verse_start'] as num?)?.toInt() ?? 0; // TODO
        final c = ca.compareTo(cb);
        return c != 0 ? c : va.compareTo(vb);
      });
    return filtered
        .map((e) => RemoteNote.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<void> removeById(String id) async {
    final all = await _readAll();
    all.removeWhere((m) => (m['id']?.toString() ?? '') == id);
    await _writeAll(all);
  }

  static Future<void> updatePartial(String id, {String? note, ServerHighlight? color}) async {
    final all = await _readAll();
    final i = all.indexWhere((m) => (m['id']?.toString() ?? '') == id);
    if (i < 0) return;
    if (note != null) all[i]['note'] = note;
    if (color != null) all[i]['highlight_color'] = color.name;
    all[i]['updated_at'] = DateTime.now().toIso8601String();
    await _writeAll(all);
  }

  static Future<void> swapId(String oldId, String newId) async {
    final all = await _readAll();
    final i = all.indexWhere((m) => (m['id']?.toString() ?? '') == oldId);
    if (i < 0) return;
    // If an entry already exists with newId, drop the old one.
    final j = all.indexWhere((m) => (m['id']?.toString() ?? '') == newId);
    if (j >= 0) {
      all.removeAt(i);
    } else {
      all[i]['id'] = newId;
    }
    await _writeAll(all);
  }
}

// -----------------------------------------------------------------------------
// TODO: Minimal file-backed outbox for offline writes (FIFO JSON file).
// Replays queued jobs on reconnect and keeps the cache in sync.
// -----------------------------------------------------------------------------
class _Outbox {
  static const _fileName = 'notes_outbox.json';

  // TODO: prevent concurrent drain runs
  static bool _draining = false; // TODO

  static Future<File> _file() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_fileName');
  }

  static Future<List<Map<String, dynamic>>> _read() async {
    try {
      final f = await _file();
      if (!await f.exists()) return <Map<String, dynamic>>[];
      final txt = await f.readAsString();
      if (txt.trim().isEmpty) return <Map<String, dynamic>>[];
      final raw = json.decode(txt);
      if (raw is List) {
        return raw
            .cast<Map>()
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
      return <Map<String, dynamic>>[];
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  static Future<void> _write(List<Map<String, dynamic>> jobs) async {
    final f = await _file();
    await f.writeAsString(json.encode(jobs));
  }

  static Future<void> enqueueCreate(
      String localId, Map<String, dynamic> payload) async {
    final jobs = await _read();
    jobs.add({
      'op': 'create',
      'localId': localId,
      'payload': payload,
      'ts': DateTime.now().toIso8601String(),
    });
    await _write(jobs);
    if (kDebugMode) debugPrint('[Outbox] queued create localId=$localId');
  }

  static Future<void> enqueueUpdate(String id,
      {String? note, ServerHighlight? color}) async {
    final jobs = await _read();
    jobs.add({
      'op': 'update',
      'id': id,
      if (note != null) 'note': note,
      if (color != null) 'color': color.name,
      'ts': DateTime.now().toIso8601String(),
    });
    await _write(jobs);
    if (kDebugMode) debugPrint('[Outbox] queued update id=$id');
  }

  static Future<void> enqueueDelete(String id) async {
    final jobs = await _read();
    jobs.add({
      'op': 'delete',
      'id': id,
      'ts': DateTime.now().toIso8601String(),
    });
    await _write(jobs);
    if (kDebugMode) debugPrint('[Outbox] queued delete id=$id');
  }

  // TODO: robust int conversion from dynamic
  static int _asInt(dynamic v, {int? or}) { // TODO
    if (v == null) return or ?? 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? (or ?? 0);
  }

  static Future<void> drain() async {
    // TODO: single-flight guard
    if (_draining) {
      if (kDebugMode) debugPrint('[Outbox] drain already running; skip');
      return;
    }
    _draining = true; // TODO
    try {
      var jobs = await _read();
      if (jobs.isEmpty) {
        return;
      }

      final idMap = <String, String>{}; // temp_id -> server_id
      int i = 0;

      while (i < jobs.length) {
        final job = jobs[i];
        try {
          final op = (job['op'] ?? '').toString();

          if (op == 'create') {
            final rawLocal = job['localId'] ?? job['id'];
            final localId = rawLocal?.toString();
            final payloadAny = job['payload'];
            if (localId == null || payloadAny == null || payloadAny is! Map) {
              if (kDebugMode) debugPrint('[Outbox] drop malformed create: $job');
              jobs.removeAt(i);
              await _write(jobs);
              continue;
            }
            final p = Map<String, dynamic>.from(payloadAny as Map);

            final created = await NotesApi._createOnline(RemoteNote(
              id: 'new',
              book: (p['book'] ?? '').toString(),
              chapter: _asInt(p['chapter'], or: 0),
              verseStart: _asInt(p['verse_start'], or: 0),
              verseEnd: p['verse_end'] == null ? null : _asInt(p['verse_end']),
              note: (p['note'] as String?) ?? '',
              color: serverHighlightFrom(p['highlight_color'] as String?) ??
                  ServerHighlight.yellow,
              createdAt: null,
              updatedAt: null,
            ));
            idMap[localId] = created.id;

            // Cache reconciliation
            await _Cache.swapId(localId, created.id);
            await _Cache.upsert(created);

            // Rewrite later jobs that referenced the temp id
            for (var j = i + 1; j < jobs.length; j++) {
              final jid = jobs[j]['id']?.toString();
              if (jid != null && jid == localId) {
                jobs[j]['id'] = created.id;
              }
            }
            jobs.removeAt(i);
            await _write(jobs);
            if (kDebugMode) debugPrint('[Outbox] create OK $localId -> ${created.id}');
            continue;
          }

          if (op == 'update') {
            var id = job['id']?.toString();
            if (id == null) {
              if (kDebugMode) debugPrint('[Outbox] drop malformed update: $job');
              jobs.removeAt(i);
              await _write(jobs);
              continue;
            }
            id = idMap[id] ?? id;
            final note = job['note'] as String?;
            final color = serverHighlightFrom(job['color'] as String?);
            final updated = await NotesApi._updateOnline(id, note: note, color: color);
            await _Cache.upsert(updated);
            jobs.removeAt(i);
            await _write(jobs);
            if (kDebugMode) debugPrint('[Outbox] update OK id=$id');
            continue;
          }

          if (op == 'delete') {
            var id = job['id']?.toString();
            if (id == null) {
              if (kDebugMode) debugPrint('[Outbox] drop malformed delete: $job');
              jobs.removeAt(i);
              await _write(jobs);
              continue;
            }
            id = idMap[id] ?? id;
            await NotesApi._deleteOnline(id);
            await _Cache.removeById(id);
            jobs.removeAt(i);
            await _write(jobs);
            if (kDebugMode) debugPrint('[Outbox] delete OK id=$id');
            continue;
          }

          // Unknown op
          if (kDebugMode) debugPrint('[Outbox] drop unknown op: $job');
          jobs.removeAt(i);
          await _write(jobs);
        } catch (e) {
          if (kDebugMode) debugPrint('[Outbox] flush error: $e');
          NotesApi._scheduleRetry(); // TODO: try again later
          break; // stop; leave remaining jobs for next attempt
        }
      }
    } finally {
      _draining = false; // TODO
    }
  }
}
