// Lightweight helper for Bible Note API calls.
// Uses the shared Dio client from api_client.dart (Bearer Firebase token).
//
// Routes (server):
//   GET    /v1/bible-notes/reference/{book}?chapter_start=&chapter_end=&skip=&limit=
//   POST   /v1/bible-notes/
//   PUT    /v1/bible-notes/{note_id}
//   DELETE /v1/bible-notes/{note_id}

import 'package:dio/dio.dart';
import 'package:app/helpers/api_client.dart';

// Re-exported types for consumers.
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
    book: (j['book'] ?? '').toString(),
    chapter: (j['chapter'] as num).toInt(),
    verseStart: (j['verse_start'] as num).toInt(),
    verseEnd: j['verse_end'] == null ? null : (j['verse_end'] as num).toInt(),
    note: (j['note'] as String?) ?? '',
    color: serverHighlightFrom(j['highlight_color'] as String?),
    createdAt:
        j['created_at'] != null
            ? DateTime.tryParse(j['created_at'].toString())
            : null,
    updatedAt:
        j['updated_at'] != null
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

/// GET notes for a book + inclusive chapter range.
Future<List<RemoteNote>> getNotesForChapterRange({
  required String book,
  required int chapterStart,
  required int chapterEnd,
  int skip = 0,
  int limit = 2000,
}) async {
  final resp = await api.get<List<dynamic>>(
    '/v1/bible-notes/reference/$book',
    queryParameters: {
      'chapter_start': '$chapterStart',
      'chapter_end': '$chapterEnd',
      'skip': '$skip',
      'limit': '$limit',
    },
  );

  if (resp.statusCode != 200 || resp.data == null) {
    throw StateError('GET notes failed: ${resp.statusCode} ${resp.data}');
  }

  return resp.data!
      .cast<Map>()
      .map((e) => RemoteNote.fromJson(Map<String, dynamic>.from(e)))
      .toList();
}

/// POST create note
Future<RemoteNote> createNote(RemoteNote draft) async {
  final resp = await api.post<Map<String, dynamic>>(
    '/v1/bible-notes/',
    data: draft.toCreateJson(),
  );

  final ok = resp.statusCode == 200 || resp.statusCode == 201;
  if (!ok || resp.data == null) {
    throw StateError('POST note failed: ${resp.statusCode} ${resp.data}');
  }

  return RemoteNote.fromJson(resp.data!);
}

/// PUT update note (partial)
Future<RemoteNote> updateNote(
  String id, {
  String? note,
  ServerHighlight? color,
}) async {
  final body = <String, dynamic>{};
  if (note != null) body['note'] = note;
  if (color != null) body['highlight_color'] = color.name;

  final resp = await api.put<Map<String, dynamic>>(
    '/v1/bible-notes/$id',
    data: body,
  );

  if (resp.statusCode != 200 || resp.data == null) {
    throw StateError('PUT note failed: ${resp.statusCode} ${resp.data}');
  }

  return RemoteNote.fromJson(resp.data!);
}

/// DELETE note
Future<void> deleteNote(String id) async {
  final resp = await api.delete('/v1/bible-notes/$id');
  if (resp.statusCode != 200) {
    throw StateError('DELETE note failed: ${resp.statusCode} ${resp.data}');
  }
}
