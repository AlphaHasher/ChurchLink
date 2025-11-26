import 'package:flutter/material.dart';
import 'package:app/helpers/localization_helper.dart';
export 'package:app/helpers/localization_helper.dart' show LanguageOption;

class LocalizedBuilder extends StatefulWidget {
  final Widget Function(BuildContext context) builder;
  const LocalizedBuilder({super.key, required this.builder});

  @override
  State<LocalizedBuilder> createState() => _LocalizedBuilderState();
}

class _LocalizedBuilderState extends State<LocalizedBuilder> {
  void _onLocaleChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    LocalizationHelper.addListener(_onLocaleChanged);
  }

  @override
  void dispose() {
    LocalizationHelper.removeListener(_onLocaleChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}

// Extension to localize any Text succinctly:
// Usage: Text('Home', style: ...).localized()
extension LocalizeTextExtension on Text {
  Widget localized() => _LocalizedTextWrapper(source: this);
}


String localize(String s) => LocalizationHelper.localize(s);
Future<String> localizeAsync(String s) => LocalizationHelper.localizeAsync(s);
void addLocaleListener(LocalizationListener listener) => LocalizationHelper.addListener(listener);
void removeLocaleListener(LocalizationListener listener) => LocalizationHelper.removeListener(listener);
List<LanguageOption> get availableLanguages => LocalizationHelper.availableLanguages;
Future<void> changeLocaleAndAwait(String newLocale, {List<String>? warmupKeys}) =>
    LocalizationHelper.changeLocaleAndAwait(newLocale, warmupKeys: warmupKeys);
String get currentLocale => LocalizationHelper.currentLocale;

extension LocalizedInputDecoration on InputDecoration {
  InputDecoration localizedLabels() => copyWith(
        labelText: labelText != null ? localize(labelText!) : null,
        hintText: hintText != null ? localize(hintText!) : null,
        helperText: helperText != null ? localize(helperText!) : null,
      );
}

Future<void> initLocalization() => LocalizationHelper.init();

extension LocalizedRebuild on Widget {
  Widget localizedRebuild() => LocalizedBuilder(builder: (_) => this);
}

extension LocalizedBottomNavItem on BottomNavigationBarItem {
  BottomNavigationBarItem localized() {
    return BottomNavigationBarItem(
      icon: icon,
      activeIcon: activeIcon,
      label: label != null ? localize(label!) : null,
      tooltip: tooltip != null ? localize(tooltip!) : tooltip,
      backgroundColor: backgroundColor,
    );
  }
}

class _LocalizedTextWrapper extends StatefulWidget {
  final Text source;
  const _LocalizedTextWrapper({required this.source});

  @override
  State<_LocalizedTextWrapper> createState() => _LocalizedTextWrapperState();
}

class _LocalizedTextWrapperState extends State<_LocalizedTextWrapper> {
  void _onLocaleChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    LocalizationHelper.addListener(_onLocaleChanged);
  }

  @override
  void dispose() {
    LocalizationHelper.removeListener(_onLocaleChanged);
    super.dispose();
  }

  InlineSpan _localizeSpan(InlineSpan span) {
    if (span is TextSpan) {
      return TextSpan(
        text: span.text != null ? LocalizationHelper.localize(span.text!) : null,
        children: span.children?.map(_localizeSpan).toList(),
        style: span.style,
        recognizer: span.recognizer,
        semanticsLabel: span.semanticsLabel,
        mouseCursor: span.mouseCursor,
        onEnter: span.onEnter,
        onExit: span.onExit,
        locale: span.locale,
        spellOut: span.spellOut,
      );
    }
    // WidgetSpan or unknown - return as-is
    return span;
  }

  @override
  Widget build(BuildContext context) {
    final src = widget.source;
    if (src.data != null) {
      final text = LocalizationHelper.localize(src.data!);
      return Text(
        text,
        key: src.key,
        style: src.style,
        strutStyle: src.strutStyle,
        textAlign: src.textAlign,
        textDirection: src.textDirection,
        locale: src.locale,
        softWrap: src.softWrap,
        overflow: src.overflow,
        textScaleFactor: src.textScaleFactor,
        maxLines: src.maxLines,
        semanticsLabel: src.semanticsLabel,
        textWidthBasis: src.textWidthBasis,
        textHeightBehavior: src.textHeightBehavior,
        selectionColor: src.selectionColor,
      );
    } else if (src.textSpan != null) {
      final localizedSpan = _localizeSpan(src.textSpan!);
      return Text.rich(
        localizedSpan,
        key: src.key,
        style: src.style,
        strutStyle: src.strutStyle,
        textAlign: src.textAlign,
        textDirection: src.textDirection,
        locale: src.locale,
        softWrap: src.softWrap,
        overflow: src.overflow,
        textScaleFactor: src.textScaleFactor,
        maxLines: src.maxLines,
        semanticsLabel: src.semanticsLabel,
        textWidthBasis: src.textWidthBasis,
        textHeightBehavior: src.textHeightBehavior,
        selectionColor: src.selectionColor,
      );
    }
    // Fallback
    return src;
  }
}


