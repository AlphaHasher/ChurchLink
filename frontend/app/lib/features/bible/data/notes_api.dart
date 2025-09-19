// NotesApi (refactored): uses BibleHelper for all network I/O,
// preserves offline cache + outbox + retry behavior.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show kDebugMode, debugPrint;
import 'package:path_provider/path_provider.dart';

import 'package:app/helpers/bible_notes_helper.dart';

class NotesApi {
  static final StreamController<void> _syncedCtr =
      StreamController<void>.broadcast();
  static Stream<void> get onSynced => _syncedCtr.stream;

  static bool _isOffline(Object e) =>
      e is SocketException || e is HttpException || e is TimeoutException;

  static Timer? _retryTimer;
  static void _scheduleRetry() {
    _retryTimer?.cancel();
    _retryTimer = Timer(const Duration(seconds: 7), () {
      if (kDebugMode) debugPrint('[Outbox] scheduled drain');
      NotesApi.drainOutbox();
    });
  }

  /// Read notes for a book and chapter range (inclusive).
  static Future<List<RemoteNote>> getNotesForChapterRangeApi({
    required String book,
    required int chapterStart,
    required int chapterEnd,
    int skip = 0,
    int limit = 2000,
  }) async {
    try {
      if (kDebugMode) {
        debugPrint('[NotesApi] GET /v1/bible-notes/reference/$book');
      }

      // Online fetch via helper
      final notes = await getNotesForChapterRange(
        book: book,
        chapterStart: chapterStart,
        chapterEnd: chapterEnd,
        skip: skip,
        limit: limit,
      );

      // Cache fresh server data
      await _Cache.upsertMany(notes);

      // Keep local temps visible until they sync
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
        if (kDebugMode) {
          debugPrint('[NotesApi] offline GET -> cache fallback');
        }
        final cached = await _Cache.getRange(
          book,
          chapterStart: chapterStart,
          chapterEnd: chapterEnd,
        );
        _scheduleRetry();
        return cached;
      }
      rethrow;
    }
  }

  // --- Online ops (delegate to helper) ---

  static Future<RemoteNote> _createOnline(RemoteNote draft) async {
    final created = await createNote(draft);
    await _Cache.upsert(created);
    _syncedCtr.add(null);
    return created;
  }

  static Future<RemoteNote> _updateOnline(
    String id, {
    String? note,
    ServerHighlight? color,
  }) async {
    final updated = await updateNote(id, note: note, color: color);
    await _Cache.upsert(updated);
    _syncedCtr.add(null);
    return updated;
  }

  static Future<void> _deleteOnline(String id) async {
    await deleteNote(id);
    await _Cache.removeById(id);
    _syncedCtr.add(null);
  }

  /// Create a note/highlight row. (Highlights are required to add notes).
  static Future<RemoteNote> create(RemoteNote draft) async {
    try {
      return await _createOnline(draft);
    } catch (e) {
      if (_isOffline(e)) {
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
        await _Cache.upsert(optimistic);
        _scheduleRetry();
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
      return await _updateOnline(id, note: note, color: color);
    } catch (e) {
      if (_isOffline(e)) {
        await _Outbox.enqueueUpdate(id, note: note, color: color);
        await _Cache.updatePartial(id, note: note, color: color);
        _scheduleRetry();
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
      await _deleteOnline(id);
    } catch (e) {
      if (_isOffline(e)) {
        await _Outbox.enqueueDelete(id);
        await _Cache.removeById(id);
        _scheduleRetry();
        return;
      }
      rethrow;
    }
  }

  // Public drain at boot/resume/reconnect
  static Future<void> drainOutbox() => _Outbox.drain();
}

// -----------------------------------------------------------------------------
// Local cache (unchanged)
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
    final filtered =
        all.where((m) {
            final b = (m['book'] as String?) ?? '';
            final ch = (m['chapter'] as num?)?.toInt() ?? -1;
            return b == book && ch >= chapterStart && ch <= chapterEnd;
          }).toList()
          ..sort((a, b) {
            final ca = (a['chapter'] as num?)?.toInt() ?? 0;
            final cb = (b['chapter'] as num?)?.toInt() ?? 0;
            final va = (a['verse_start'] as num?)?.toInt() ?? 0;
            final vb = (b['verse_start'] as num?)?.toInt() ?? 0;
            final c = ca.compareTo(cb);
            return c != 0 ? c : va.compareTo(vb);
          });
    return filtered
        .map((e) => RemoteNote.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<void> removeById(String id) async {
    final all = await _readAll();
    all.removeWhere((m) => (m['id']?.toString() ?? '') == id);
    await _writeAll(all);
  }

  static Future<void> updatePartial(
    String id, {
    String? note,
    ServerHighlight? color,
  }) async {
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
// Outbox (unchanged except delegating online ops via helper)
// -----------------------------------------------------------------------------
class _Outbox {
  static const _fileName = 'notes_outbox.json';
  static bool _draining = false;

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
    String localId,
    Map<String, dynamic> payload,
  ) async {
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

  static Future<void> enqueueUpdate(
    String id, {
    String? note,
    ServerHighlight? color,
  }) async {
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

  static int _asInt(dynamic v, {int? or}) {
    if (v == null) return or ?? 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? (or ?? 0);
  }

  static Future<void> drain() async {
    if (_draining) {
      if (kDebugMode) debugPrint('[Outbox] drain already running; skip');
      return;
    }
    _draining = true;
    var processedAny = false;
    try {
      var jobs = await _read();
      if (jobs.isEmpty) return;

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
              if (kDebugMode)
                debugPrint('[Outbox] drop malformed create: $job');
              jobs.removeAt(i);
              await _write(jobs);
              continue;
            }
            final p = Map<String, dynamic>.from(payloadAny as Map);

            final created = await NotesApi._createOnline(
              RemoteNote(
                id: 'new',
                book: (p['book'] ?? '').toString(),
                chapter: _asInt(p['chapter'], or: 0),
                verseStart: _asInt(p['verse_start'], or: 0),
                verseEnd:
                    p['verse_end'] == null ? null : _asInt(p['verse_end']),
                note: (p['note'] as String?) ?? '',
                color:
                    serverHighlightFrom(p['highlight_color'] as String?) ??
                    ServerHighlight.yellow,
                createdAt: null,
                updatedAt: null,
              ),
            );
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
            processedAny = true;
            if (kDebugMode) {
              debugPrint('[Outbox] create OK $localId -> ${created.id}');
            }
            continue;
          }

          if (op == 'update') {
            var id = job['id']?.toString();
            if (id == null) {
              if (kDebugMode)
                debugPrint('[Outbox] drop malformed update: $job');
              jobs.removeAt(i);
              await _write(jobs);
              continue;
            }
            id = idMap[id] ?? id;
            final note = job['note'] as String?;
            final color = serverHighlightFrom(job['color'] as String?);
            final updated = await NotesApi._updateOnline(
              id,
              note: note,
              color: color,
            );
            await _Cache.upsert(updated);
            jobs.removeAt(i);
            await _write(jobs);
            processedAny = true;
            if (kDebugMode) debugPrint('[Outbox] update OK id=$id');
            continue;
          }

          if (op == 'delete') {
            var id = job['id']?.toString();
            if (id == null) {
              if (kDebugMode)
                debugPrint('[Outbox] drop malformed delete: $job');
              jobs.removeAt(i);
              await _write(jobs);
              continue;
            }
            id = idMap[id] ?? id;
            await NotesApi._deleteOnline(id);
            await _Cache.removeById(id);
            jobs.removeAt(i);
            await _write(jobs);
            processedAny = true;
            if (kDebugMode) debugPrint('[Outbox] delete OK id=$id');
            continue;
          }

          if (kDebugMode) debugPrint('[Outbox] drop unknown op: $job');
          jobs.removeAt(i);
          await _write(jobs);
        } catch (e) {
          if (kDebugMode) debugPrint('[Outbox] flush error: $e');
          NotesApi._scheduleRetry();
          break;
        }
      }
    } finally {
      _draining = false;
      if (processedAny) NotesApi._syncedCtr.add(null);
    }
  }
}
