// lib/features/bible/data/notes_api.dart
// Lightweight client for Bible Note routes.
//
// Routes (from your backend):
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

class NotesApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    // Default to Android emulator host. Override with --dart-define.
    defaultValue: 'http://10.0.2.2:8000',
  );
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
    final r = await http.get(uri, headers: _headers(t));
    if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode}');

    if (r.statusCode != 200) {
      throw StateError('GET notes (range) failed: ${r.statusCode} ${r.body}');
    }
    final data = json.decode(r.body) as List;
    return data
        .map((e) => RemoteNote.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Create a note/highlight row.
  static Future<RemoteNote> create(RemoteNote draft) async {
    final t = await _token();
    final uri = _u('/api/v1/bible-notes/');

    if (kDebugMode) debugPrint('[NotesApi] POST $uri body=${draft.toCreateJson()}');
    final r = await http.post(uri, headers: _headers(t), body: json.encode(draft.toCreateJson()));
    if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode} ${r.body}');

    if (r.statusCode != 200 && r.statusCode != 201) {
      throw StateError('POST note failed: ${r.statusCode} ${r.body}');
    }
    return RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  /// Update a note and/or color.
  /// Note: backend ignores null fields; you cannot clear color to null via update.
  static Future<RemoteNote> update(
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
    final r = await http.put(uri, headers: _headers(t), body: json.encode(body));
    if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode} ${r.body}');

    if (r.statusCode != 200) {
      throw StateError('PUT note failed: ${r.statusCode} ${r.body}');
    }
    return RemoteNote.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  /// Delete a note row (removes both note text and highlight).
  static Future<void> delete(String id) async {
    final t = await _token();
    final uri = _u('/api/v1/bible-notes/$id');

    if (kDebugMode) debugPrint('[NotesApi] DELETE $uri');
    final r = await http.delete(uri, headers: _headers(t));
    if (kDebugMode) debugPrint('[NotesApi] -> ${r.statusCode} ${r.body}');

    if (r.statusCode != 200) {
      throw StateError('DELETE note failed: ${r.statusCode} ${r.body}');
    }
  }
}
