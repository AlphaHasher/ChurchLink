import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/helpers/youtube_helper.dart';

class StreamEmbed extends StatefulWidget {
  const StreamEmbed({super.key, required this.streamId});

  final String streamId;

  @override
  State<StreamEmbed> createState() => _StreamEmbedState();
}

class _StreamEmbedState extends State<StreamEmbed> {
  late final WebViewController _controller;
  bool _isLoading = true;
  late String _currentUrl;

  @override
  void initState() {
    super.initState();

    // Required params to get the webviewer to work for stream embedding
    final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }

    _controller =
        WebViewController.fromPlatformCreationParams(params)
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(Colors.black)
          ..setNavigationDelegate(
            NavigationDelegate(
              onPageStarted: (_) => setState(() => _isLoading = true),
              onPageFinished: (_) => setState(() => _isLoading = false),
              onWebResourceError: (err) {
                logger.e(
                  'StreamEmbed error: ${err.errorCode} ${err.description}',
                );
              },
            ),
          );

    if (_controller.platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(true);
      (_controller.platform as AndroidWebViewController)
          .setMediaPlaybackRequiresUserGesture(false);
    }

    _currentUrl = YoutubeHelper.embedUrlFromStreamID(widget.streamId);
    logger.i('StreamEmbed: init load $_currentUrl');
    _controller.loadRequest(Uri.parse(_currentUrl));
  }

  @override
  void didUpdateWidget(covariant StreamEmbed oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Window reloader for when tab switches
    if (oldWidget.streamId != widget.streamId) {
      final nextUrl = YoutubeHelper.embedUrlFromStreamID(widget.streamId);
      if (nextUrl != _currentUrl) {
        _currentUrl = nextUrl;
        logger.i('StreamEmbed: reloading $_currentUrl');
        setState(() => _isLoading = true);
        _controller.loadRequest(Uri.parse(_currentUrl));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // The Widget that actually has the embed
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: WebViewWidget(controller: _controller),
          ),
          if (_isLoading)
            const Align(
              alignment: Alignment.bottomCenter,
              child: LinearProgressIndicator(minHeight: 2),
            ),
        ],
      ),
    );
  }
}

