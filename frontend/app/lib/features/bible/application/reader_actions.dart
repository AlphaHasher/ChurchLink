// Moves all the heavy local state updates + write-throughs out of the widget.
// Originally code from bible_reader_body.dart

import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

import '../domain/highlight.dart';
import 'reader_logic.dart';
import '../presentation/sheets/verse_actions_sheet.dart'; // ActionResult
import '../data/notes_api.dart' as api;
import 'package:app/helpers/bible_notes_helper.dart' as bh;
import '../data/verse_matching.dart' show VerseKey;
import '../data/bible_repo_elisha.dart'; // for VerseRef

class ReaderActions {
  ReaderActions(this.ctx, this.notesApi);
  final ReaderContext ctx;
  final api.NotesApi notesApi;

  ({String book, int chapter, int verse}) _r(VerseRef v) =>
      (book: v.book, chapter: v.chapter, verse: v.verse);

  Future<void> applyAction({
    required String translation,
    required (VerseRef ref, String text) vt,
    required ActionResult res,

    // maps and indices (mutated in-place)
    required Map<String, HighlightColor> hlShared,
    required Map<String, String> notesShared,
    required Map<String, Map<String, HighlightColor>> hlPerTx,
    required Map<String, Map<String, String>> notesPerTx,
    required Map<String, String> noteIdByKey,
    required Map<String, String> noteIdByCluster,

    // for rehydration triggers when needed
    required String currentBook,
    required int currentChapter,
  }) async {
    final v = vt; // (VerseRef, text)

    // ---------- Local state updates (immediate UI) ----------
    if (res.noteDelete == true) {
      final m = ctx.matcher;
      final hereK = ctx.k(_r(v.$1));

      if (m != null && existsInOther(ctx, _r(v.$1))) {
        final me = ctx.keyOf(_r(v.$1));
        final selfCid = m.clusterId(ctx.canonicalTx(translation), me);

        final bool isPsalms = me.book == 'Psalms';
        List<VerseKey> counterparts;
        if (isPsalms) {
          final ro = m.matchToOtherRuleOnly(fromTx: ctx.canonicalTx(translation), key: me);
          final hasCross = ro.any((x) => x.chapter != me.chapter);
          counterparts = hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
        } else {
          counterparts = m.matchToOther(fromTx: ctx.canonicalTx(translation), key: me);
        }

        final cids = <String>{selfCid};
        for (final o in counterparts) {
          cids.add(m.clusterId(ctx.otherTx, o));
        }
        for (final s in sameTxSiblingsFor(ctx, _r(v.$1))) {
          cids.add(m.clusterId(ctx.canonicalTx(translation), s));
          hlPerTx[translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
        }
        for (final cid in cids) {
          notesShared.remove(cid);
          hlShared.remove(cid);
        }
        notesPerTx[translation]?.remove(hereK);
        hlPerTx[translation]?.remove(hereK);
      } else {
        notesPerTx[translation]?.remove(hereK);
        hlPerTx[translation]?.remove(hereK);
      }
    } else if (res.noteText != null) {
      final txt = res.noteText!.trim();
      final m = ctx.matcher;

      if (txt.isEmpty) {
        final hereK = ctx.k(_r(v.$1));
        if (m != null && existsInOther(ctx, _r(v.$1))) {
          final me = ctx.keyOf(_r(v.$1));
          final selfCid = m.clusterId(ctx.canonicalTx(translation), me);

          final bool isPsalms = me.book == 'Psalms';
          List<VerseKey> counterparts;
          if (isPsalms) {
            final ro = m.matchToOtherRuleOnly(fromTx: ctx.canonicalTx(translation), key: me);
            final hasCross = ro.any((x) => x.chapter != me.chapter);
            counterparts = hasCross ? ro.where((x) => x.chapter != me.chapter).toList() : const <VerseKey>[];
          } else {
            counterparts = m.matchToOther(fromTx: ctx.canonicalTx(translation), key: me);
          }

          final cids = <String>{selfCid};
          for (final o in counterparts) {
            cids.add(m.clusterId(ctx.otherTx, o));
          }
          for (final s in sameTxSiblingsFor(ctx, _r(v.$1))) {
            cids.add(m.clusterId(ctx.canonicalTx(translation), s));
            hlPerTx[translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
          }

          for (final cid in cids) {
            notesShared.remove(cid);
            hlShared.remove(cid);
          }
          notesPerTx[translation]?.remove(hereK);
          hlPerTx[translation]?.remove(hereK);
        } else {
          notesPerTx[translation]?.remove(hereK);
          hlPerTx[translation]?.remove(hereK);
        }
      } else {
        if (m != null && existsInOther(ctx, _r(v.$1))) {
          final cid = m.clusterId(ctx.canonicalTx(translation), ctx.keyOf(_r(v.$1)));
          notesShared[cid] = txt;
          for (final tx in notesPerTx.keys) {
            notesPerTx[tx]?.remove(ctx.k(_r(v.$1)));
          }
          for (final s in sameTxSiblingsFor(ctx, _r(v.$1))) {
            notesPerTx[translation]?.remove('${s.book}|${s.chapter}|${s.verse}');
          }
        } else {
          notesPerTx[translation]?[ctx.k(_r(v.$1))] = txt;
        }
      }
    }

    if (res.highlight != null) {
      final color = res.highlight!;
      final hereK = ctx.k(_r(v.$1));

      final m = ctx.matcher;
      final mapsAcross = m != null && existsInOther(ctx, _r(v.$1));

      if (!mapsAcross) {
        if (color == HighlightColor.none) {
          hlPerTx[translation]?.remove(hereK);
        } else {
          hlPerTx[translation]?[hereK] = color;
        }
      } else {
        // m is non-null here thanks to the guard above
        final cid = m.clusterId(ctx.canonicalTx(translation), ctx.keyOf(_r(v.$1)));
        if (color == HighlightColor.none) {
          hlShared.remove(cid);
        } else {
          hlShared[cid] = color;
        }
        for (final tx in hlPerTx.keys) {
          hlPerTx[tx]?.remove(hereK);
        }
        for (final s in sameTxSiblingsFor(ctx, _r(v.$1))) {
          final kStr = '${s.book}|${s.chapter}|${s.verse}';
          if (color == HighlightColor.none) {
            hlPerTx[translation]?.remove(kStr);
          } else {
            hlPerTx[translation]?[kStr] = color;
          }
        }
      }
    }

    // ---------- Server write-throughs (fail-soft) ----------
    try {
      final m = ctx.matcher;
      final cid = m?.clusterId(ctx.canonicalTx(translation), ctx.keyOf(_r(v.$1)));
      String? id = (cid != null ? noteIdByCluster[cid] : null) ?? noteIdByKey[ctx.k(_r(v.$1))];

      if (kDebugMode) {
        debugPrint('[WriteThrough] ref=${ctx.k(_r(v.$1))} cid=${cid ?? "-"} id=${id ?? "-"} '
            'noteDelete=${res.noteDelete} noteLen=${(res.noteText ?? "").length} '
            'hl=${res.highlight?.name}');
      }

      // Notes
      if (res.noteDelete == true) {
        if (id != null && id.startsWith('temp_')) {
          await api.NotesApi.drainOutbox();
          await syncFetchChapterNotes(ctx, book: currentBook, chapter: currentChapter);
          id = (cid != null ? noteIdByCluster[cid] : null) ?? noteIdByKey[ctx.k(_r(v.$1))];
        }

        if (id != null) {
          if (kDebugMode) debugPrint('[WriteThrough] DELETE note id=$id');
          await api.NotesApi.delete(id);
          if (cid != null) noteIdByCluster.remove(cid);
          noteIdByKey.remove(ctx.k(_r(v.$1)));
        }
      } else if (res.noteText != null) {
        final txt = (res.noteText ?? '').trim();
        if (txt.isNotEmpty) {
          if (id == null) {
            if (kDebugMode) debugPrint('[WriteThrough] CREATE note');
            final created = await api.NotesApi.create(
              bh.RemoteNote(
                id: 'new',
                book: v.$1.book,
                chapter: v.$1.chapter,
                verseStart: v.$1.verse,
                verseEnd: null,
                note: txt,
                color: null,
                createdAt: null,
                updatedAt: null,
              ),
            );
            noteIdByKey[ctx.k(_r(v.$1))] = created.id;
            if (cid != null) noteIdByCluster[cid] = created.id;
          } else {
            if (kDebugMode) debugPrint('[WriteThrough] UPDATE note id=$id');
            await api.NotesApi.update(id, note: txt);
          }
        } else {
          if (id != null) {
            if (kDebugMode) {
              debugPrint('[WriteThrough] DELETE note (empty text) id=$id');
            }
            await api.NotesApi.delete(id);
            if (cid != null) noteIdByCluster.remove(cid);
            noteIdByKey.remove(ctx.k(_r(v.$1)));
          }
        }
      }

      // Highlights
      if (res.highlight != null) {
        final color = res.highlight!;
        final sc = HighlightCodec.toServer(color); // -> bh.ServerHighlight?
        final cid2 = m?.clusterId(ctx.canonicalTx(translation), ctx.keyOf(_r(v.$1)));
        String? id2 = (cid2 != null ? noteIdByCluster[cid2] : null) ?? noteIdByKey[ctx.k(_r(v.$1))];

        if (color != HighlightColor.none) {
          if (id2 == null) {
            if (kDebugMode) debugPrint('[WriteThrough] CREATE highlight');
            final created = await api.NotesApi.create(
              bh.RemoteNote(
                id: 'new',
                book: v.$1.book,
                chapter: v.$1.chapter,
                verseStart: v.$1.verse,
                verseEnd: null,
                note: '',
                color: sc,
                createdAt: null,
                updatedAt: null,
              ),
            );
            noteIdByKey[ctx.k(_r(v.$1))] = created.id;
            if (cid2 != null) noteIdByCluster[cid2] = created.id;
          } else {
            if (kDebugMode) {
              debugPrint('[WriteThrough] UPDATE highlight id=$id2 -> ${sc?.name}');
            }
            await api.NotesApi.update(id2, color: sc);
          }
        } else {
          final existingTxt =
              (notesPerTx[translation]?[ctx.k(_r(v.$1))] ?? notesShared[cid2 ?? ''] ?? '').trim();
          if (existingTxt.isEmpty && id2 != null) {
            if (kDebugMode) debugPrint('[WriteThrough] DELETE row (clear highlight) id=$id2');
            await api.NotesApi.delete(id2);
            if (cid2 != null) noteIdByCluster.remove(cid2);
            noteIdByKey.remove(ctx.k(_r(v.$1)));
          }
        }
      }
    } catch (e, st) {
      debugPrint('[WriteThrough] failed: $e');
      debugPrint('$st');
    }
  }
}
