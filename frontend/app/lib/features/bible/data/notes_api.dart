// lib/features/bible/data/notes_api.dart
// Lightweight client for Bible Note routes.
//
// Routes (from your backend):
//   GET  /bible-notes/reference/{book}
//   GET  /bible-notes/reference/{book}/{chapter}
//   POST /bible-notes/
//   PUT  /bible-notes/{note_id}
//   DELETE /bible-notes/{note_id}
//
// Auth: Firebase UID bearer token (Authorization: Bearer <ID token>)
//
// Base URL resolution priority:
//   1) --dart-define=API_BASE_URL=...
//   2) .env -> API_BASE_URL (if flutter_dotenv was loaded in main())
//   3) default: http://10.0.2.2:8000 (Android emulator-friendly)
//
// NOTE: For iOS simulator / Web, pass 127.0.0.1 via --dart-define or .env.

import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kDebugMode, debugPrint;
import 'package:flutter_dotenv/flutter_dotenv.dart' show dotenv;

class NotesApiConfig {
  static final String baseUrl = (() {
    // 1) compile-time (flutter run ... --dart-define=API_BASE_URL=http://...)
    const fromDefine = String.fromEnvironment('API_BASE_URL');
    if (fromDefine.isNotEmpty) return fromDefine;

    // 2) .env (optional; requires: await dotenv.load(fileName: ".env") in main())
    final fromEnv = dotenv.maybeGet('API_BASE_URL') ?? dotenv.env['API_BASE_URL'];
    if (fromEnv != null && fromEnv.isNotEmpty) return fromEnv;

    // 3) sensible default (Android emulator)
    return 'http://10.0.2.2:8000';
  })();
}

enum ServerHighlight { blue, red, yellow, green, purple }

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
        chapter: j['chapter'] as int,
        verseStart: j['verse_start'] as int,
        verseEnd: j['verse_end'] == null ? null : (j['verse_end'] as int),
        note: (j['note'] as String?) ?? '',
        color: serverHighlightFrom(j['highlight_color'] as String?),
        createdAt: j['created_at'] != null
            ? DateTime.tryParse(j['created_at'].toString())
            : null,
        updatedAt: j['updated_at'] != null
            ? DateTime.tryParse(j['updated_at'].toString())
            : null,
      );

  /// Backend requires highlight_color on create; default to yellow if none chosen.
  Map<String, dynamic> toCreateJson() => {
        'book': book,
        'chapter': chapter,
        'verse_start': verseStart,
        if (verseEnd != null) 'verse_end': verseEnd,
        'note': note,
        'highlight_color': (color ?? ServerHighlight.yellow).name,
      };
}

class NotesApi {
  // ----- Auth helpers -----
  static Future<String> _token() async {
    final u = FirebaseAuth.instance.currentUser;
    if (u == null) {
      throw StateError('Not authenticated');
    }
    // Get cached/valid token; if missing, force refresh
    final tok = await u.getIdToken();
    if (tok != null && tok.isNotEmpty) return tok;
    final refreshed = await u.getIdToken(true);
    if (refreshed != null && refreshed.isNotEmpty) return refreshed;
    throw StateError('Failed to obtain Firebase ID token');
  }

  static Future<Map<String, String>> _headers() async {
    final t = await _token();
    return {
      'Authorization': 'Bearer $t',
      'Content-Type': 'application/json',
    };
  }

  // ----- API calls -----

  static Future<List<RemoteNote>> getNotesForChapterRange({
    required String book,
    required int chapterStart,
    required int chapterEnd,
    int skip = 0,
    int limit = 2000,
  }) async {
    final uri = Uri.parse('${NotesApiConfig.baseUrl}/api/v1/bible-notes/reference/$book')
        .replace(queryParameters: {
      'chapter_start': '$chapterStart',
      'chapter_end': '$chapterEnd',
      'skip': '$skip',
      'limit': '$limit',
    });

    final hdr = await _headers();

    if (kDebugMode) {
      debugPrint('[NotesApi] GET $uri');
    }

    final r = await http.get(uri, headers: hdr);

    if (kDebugMode) {
      debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    }

    if (r.statusCode != 200) {
      throw StateError('GET notes (range) failed: ${r.statusCode} ${r.body}');
    }
    final data = json.decode(r.body) as List;
    return data
        .map((e) => RemoteNote.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<RemoteNote> create(RemoteNote draft) async {
    final uri = Uri.parse('${NotesApiConfig.baseUrl}/api/v1/bible-notes/');
    final hdr = await _headers();
    final body = json.encode(draft.toCreateJson());

    if (kDebugMode) {
      debugPrint('[NotesApi] POST $uri');
      debugPrint('[NotesApi] body: $body');
    }

    final r = await http.post(uri, headers: hdr, body: body);

    if (kDebugMode) {
      debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    }

    if (r.statusCode != 200 && r.statusCode != 201) {
      throw StateError('POST note failed: ${r.statusCode} ${r.body}');
    }
    return RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  /// Backend ignores fields that are null; you cannot clear color to null via update.
  static Future<RemoteNote> update(
    String id, {
    String? note,
    ServerHighlight? color,
  }) async {
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

    if (kDebugMode) {
      debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    }

    if (r.statusCode != 200) {
      throw StateError('PUT note failed: ${r.statusCode} ${r.body}');
    }
    return RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  static Future<void> delete(String id) async {
    final uri = Uri.parse('${NotesApiConfig.baseUrl}/api/v1/bible-notes/$id');
    final hdr = await _headers();

    if (kDebugMode) {
      debugPrint('[NotesApi] DELETE $uri');
    }

    final r = await http.delete(uri, headers: hdr);

    if (kDebugMode) {
      debugPrint('[NotesApi] <-- ${r.statusCode} ${r.body}');
    }

    if (r.statusCode != 200) {
      throw StateError('DELETE note failed: ${r.statusCode} ${r.body}');
    }
  }
}
