// lib/features/bible/domain/highlight.dart
import 'package:app/helpers/bible_notes_helper.dart' as bh;

enum HighlightColor { none, blue, red, yellow, green, purple }

final class HighlightCodec {
  static String? toApiName(HighlightColor c) => switch (c) {
        HighlightColor.none => null,
        HighlightColor.blue => 'blue',
        HighlightColor.red => 'red',
        HighlightColor.yellow => 'yellow',
        HighlightColor.green => 'green',
        HighlightColor.purple => 'purple',
      };

  static HighlightColor fromApiName(String? s) {
    switch ((s ?? '').toLowerCase()) {
      case 'blue': return HighlightColor.blue;
      case 'red': return HighlightColor.red;
      case 'yellow': return HighlightColor.yellow;
      case 'green': return HighlightColor.green;
      case 'purple': return HighlightColor.purple;
      default: return HighlightColor.none;
    }
  }

  static bh.ServerHighlight? toServer(HighlightColor c) => switch (c) {
        HighlightColor.none => null,
        HighlightColor.blue => bh.ServerHighlight.blue,
        HighlightColor.red => bh.ServerHighlight.red,
        HighlightColor.yellow => bh.ServerHighlight.yellow,
        HighlightColor.green => bh.ServerHighlight.green,
        HighlightColor.purple => bh.ServerHighlight.purple,
      };

  static HighlightColor fromServer(bh.ServerHighlight? s) {
    switch (s) {
      case bh.ServerHighlight.blue: return HighlightColor.blue;
      case bh.ServerHighlight.red: return HighlightColor.red;
      case bh.ServerHighlight.yellow: return HighlightColor.yellow;
      case bh.ServerHighlight.green: return HighlightColor.green;
      case bh.ServerHighlight.purple: return HighlightColor.purple;
      default: return HighlightColor.none;
    }
  }
}
