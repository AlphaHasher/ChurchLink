// Retrieves the notes/highlights info and figures out clusters
// Tells bible_reader_body.dart which exact verses to display as highlighted

import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

import 'package:app/features/bible/data/verse_matching.dart' show VerseMatching, VerseKey;
import 'package:app/features/bible/domain/highlight.dart';
import 'package:app/features/bible/data/notes_api.dart' as api; // NotesApi

/// Accept the record type directly
typedef RefRec = ({String book, int chapter, int verse});

/// State handle passed in by the UI; owns *references* to the maps
/// maintained by the page's State object.
class ReaderContext {
  ReaderContext({
    required this.translation,
    required this.hlShared,
    required this.notesShared,
    required this.hlPerTx,
    required this.notesPerTx,
    required this.noteIdByKey,
    required this.noteIdByCluster,
    required this.lastWindowCids,
    this.matcher,
  });

  String translation;
  VerseMatching? matcher;

  // Shared across translations (cluster keyed)
  final Map<String, HighlightColor> hlShared;
  final Map<String, String> notesShared;

  // Per-translation fallbacks
  final Map<String, Map<String, HighlightColor>> hlPerTx;
  final Map<String, Map<String, String>> notesPerTx;

  // Remote ID index
  final Map<String, String> noteIdByKey;     // "Book|C|V" -> id
  final Map<String, String> noteIdByCluster; // clusterId -> id

  // Track which cluster IDs belonged to the last hydrated window.
  Set<String> lastWindowCids;

  String canonicalTx(String tx) {
    final t = tx.trim().toLowerCase();
    if (t == 'asv' || t == 'web') return 'kjv';
    return t;
  }

  String get otherTx => canonicalTx(translation) == 'kjv' ? 'rst' : 'kjv';

  String k(RefRec r) => '${r.book}|${r.chapter}|${r.verse}';
  VerseKey keyOf(RefRec r) => (book: r.book, chapter: r.chapter, verse: r.verse);
}

/// Ensure VerseMatching is available.
Future<void> ensureMatcherLoaded(ReaderContext ctx) async {
  if (ctx.matcher == null) {
    if (kDebugMode) debugPrint('[ReaderLogic] loading VerseMatching…');
    ctx.matcher = await VerseMatching.load();
  }
}

/// Lift any per-translation entries into shared clusters when a cross-translation
/// mapping exists (so highlights/notes travel across KJV↔RST).
void promoteLocalToShared(ReaderContext ctx) {
  final m = ctx.matcher;
  if (m == null) return;

  for (final tx in ctx.hlPerTx.keys) {
    final per = ctx.hlPerTx[tx]!;
    for (final e in per.entries.toList()) {
      final p = e.key.split('|');
      if (p.length != 3) continue;
      final k = (
        book: p[0],
        chapter: int.tryParse(p[1]) ?? 0,
        verse: int.tryParse(p[2]) ?? 0,
      );
      if (m.existsInOther(fromTx: ctx.canonicalTx(tx), key: k)) {
        final cid = m.clusterId(ctx.canonicalTx(tx), k);
        ctx.hlShared[cid] = e.value;
        per.remove(e.key);
      }
    }
  }

  for (final tx in ctx.notesPerTx.keys) {
    final per = ctx.notesPerTx[tx]!;
    for (final e in per.entries.toList()) {
      final p = e.key.split('|');
      if (p.length != 3) continue;
      final k = (
        book: p[0],
        chapter: int.tryParse(p[1]) ?? 0,
        verse: int.tryParse(p[2]) ?? 0,
      );
      if (m.existsInOther(fromTx: ctx.canonicalTx(tx), key: k)) {
        final cid = m.clusterId(ctx.canonicalTx(tx), k);
        ctx.notesShared[cid] = e.value;
        per.remove(e.key);
      }
    }
  }
}

bool existsInOther(ReaderContext ctx, RefRec ref) {
  final m = ctx.matcher;
  if (m == null) return false;
  return m.existsInOther(
    fromTx: ctx.canonicalTx(ctx.translation),
    key: ctx.keyOf(ref),
  );
}

Iterable<VerseKey> sameTxSiblingsFor(ReaderContext ctx, RefRec ref) {
  final m = ctx.matcher;
  if (m == null) return const <VerseKey>[];

  final me = ctx.keyOf(ref);
  final fromTx = ctx.canonicalTx(ctx.translation);
  final otherTx = ctx.otherTx;

  List<VerseKey> toOther;
  if (me.book == 'Psalms') {
    final ro = m.matchToOtherRuleOnly(fromTx: fromTx, key: me);
    toOther = ro.where((x) => x.chapter != me.chapter).toList();
  } else {
    toOther = m.matchToOther(fromTx: fromTx, key: me);
  }

  final siblings = <String, VerseKey>{};
  for (final t in toOther) {
    final back = (me.book == 'Psalms')
        ? m.matchToOtherRuleOnly(fromTx: otherTx, key: t)
        : m.matchToOther(fromTx: otherTx, key: t);
    for (final s in back) {
      if (s.book == me.book && !(s.chapter == me.chapter && s.verse == me.verse)) {
        siblings['${s.book}|${s.chapter}|${s.verse}'] = s;
      }
    }
  }
  return siblings.values;
}

HighlightColor colorFor(ReaderContext ctx, RefRec ref) {
  final m = ctx.matcher;

  if (m != null) {
    final selfCid = m.clusterId(ctx.canonicalTx(ctx.translation), ctx.keyOf(ref));
    final cSelf = ctx.hlShared[selfCid];
    if (cSelf != null) return cSelf;

    final me = ctx.keyOf(ref);
    final bool isPsalms = me.book == 'Psalms';
    List<VerseKey> counterparts;
    if (isPsalms) {
      final ro = m.matchToOtherRuleOnly(fromTx: ctx.canonicalTx(ctx.translation), key: me);
      final hasCross = ro.any((x) => x.chapter != me.chapter);
      counterparts = hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
    } else {
      counterparts = m.matchToOther(fromTx: ctx.canonicalTx(ctx.translation), key: me);
    }
    for (final other in counterparts) {
      final otherCid = m.clusterId(ctx.otherTx, other);
      final cOther = ctx.hlShared[otherCid];
      if (cOther != null) return cOther;
    }
  }

  final local = ctx.hlPerTx[ctx.translation]?[ctx.k(ref)];
  if (local != null && local != HighlightColor.none) return local;
  for (final s in sameTxSiblingsFor(ctx, ref)) {
    final kStr = '${s.book}|${s.chapter}|${s.verse}';
    final c = ctx.hlPerTx[ctx.translation]?[kStr];
    if (c != null && c != HighlightColor.none) return c;
  }
  return HighlightColor.none;
}

String? noteFor(ReaderContext ctx, RefRec ref) {
  final m = ctx.matcher;
  if (m != null) {
    final selfCid = m.clusterId(ctx.canonicalTx(ctx.translation), ctx.keyOf(ref));
    final sSelf = ctx.notesShared[selfCid];
    if (sSelf != null && sSelf.isNotEmpty) return sSelf;

    final me = ctx.keyOf(ref);
    final bool isPsalms = me.book == 'Psalms';
    List<VerseKey> counterparts;
    if (isPsalms) {
      final ro = m.matchToOtherRuleOnly(fromTx: ctx.canonicalTx(ctx.translation), key: me);
      final hasCross = ro.any((x) => x.chapter != me.chapter);
      counterparts = hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
    } else {
      counterparts = m.matchToOther(fromTx: ctx.canonicalTx(ctx.translation), key: me);
    }
    for (final other in counterparts) {
      final otherCid = m.clusterId(ctx.otherTx, other);
      final sOther = ctx.notesShared[otherCid];
      if (sOther != null && sOther.isNotEmpty) return sOther;
    }
    for (final sib in sameTxSiblingsFor(ctx, ref)) {
      final sibCid = m.clusterId(ctx.canonicalTx(ctx.translation), sib);
      final sSib = ctx.notesShared[sibCid];
      if (sSib != null && sSib.isNotEmpty) return sSib;
    }
  }
  return ctx.notesPerTx[ctx.translation]?[ctx.k(ref)];
}

/// Hydrate notes/highlights for a chapter and its neighbors
Future<void> syncFetchChapterNotes(
  ReaderContext ctx, {
  required String book,
  required int chapter,
}) async {
  ctx.noteIdByKey.clear();
  ctx.noteIdByCluster.clear();

  final m = ctx.matcher;
  if (m == null) {
    if (kDebugMode) debugPrint('[ReaderLogic] matcher not ready; deferring hydration');
    return;
  }

  // Sets the range as a given chapter and it's neighbors
  final start = (chapter - 1) < 1 ? 1 : (chapter - 1);
  final end = chapter + 1;

  try {
    if (kDebugMode) {
      debugPrint('[ReaderLogic] hydrate $book ch=$chapter window=[$start..$end] tx=${ctx.translation}');
    }

    // 1) Fetch window items first
    final items = await api.NotesApi.getNotesForChapterRangeApi(
      book: book,
      chapterStart: start,
      chapterEnd: end,
    );

    // Stable order (oldest -> newest); newer rows overwrite older ones if overlapping.
    items.sort((a, b) {
      final ax = a.updatedAt ?? a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bx = b.updatedAt ?? b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return ax.compareTo(bx);
    });

    // Server numbering base
    const String serverTx = 'kjv';

    // 2) Build the next set of cluster IDs present in this window
    final nextWindowCids = <String>{};

    for (final rn in items) {
      final s = rn.verseStart;
      final e = rn.verseEnd ?? rn.verseStart;
      final color = HighlightCodec.fromApiName(rn.color?.name);
      final noteText = rn.note;

      for (int v = s; v <= e; v++) {
        final key = '$book|${rn.chapter}|$v';
        ctx.noteIdByKey[key] = rn.id;

        final cid = m.clusterId(serverTx, (book: book, chapter: rn.chapter, verse: v));
        nextWindowCids.add(cid);

        // Update/overwrite shared state for this cluster
        ctx.noteIdByCluster[cid] = rn.id;
        if (noteText.isNotEmpty) {
          ctx.notesShared[cid] = noteText;
        }
        if (color != HighlightColor.none) {
          ctx.hlShared[cid] = color;
        }

        // Clear any per-tx fallbacks for the hydrated keys
        ctx.notesPerTx[ctx.translation]?.remove(key);
        ctx.hlPerTx[ctx.translation]?.remove(key);
      }
    }

    // 3) Remove ONLY stale cids that used to be in-window but are not anymore.
    //    (Prevents the “only most recent highlight shows” issue when the fetch is partial.)
    final stale = ctx.lastWindowCids.difference(nextWindowCids);
    for (final cid in stale) {
      ctx.notesShared.remove(cid);
      ctx.hlShared.remove(cid);
    }

    // 4) Commit the new window snapshot
    ctx.lastWindowCids = nextWindowCids;
  } catch (e, st) {
    debugPrint('[ReaderLogic] hydrate failed: $e\n$st');
  }
}
