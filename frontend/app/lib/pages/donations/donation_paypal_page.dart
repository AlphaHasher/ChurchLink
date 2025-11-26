import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:app/helpers/localization_helper.dart';
import 'package:app/helpers/localized_widgets.dart';

enum DonationPaypalFlow { oneTime, recurring }

enum DonationPaypalFlowState { approved, cancelled }

class DonationPaypalResult {
  final DonationPaypalFlowState state;
  final String? url;

  const DonationPaypalResult({required this.state, this.url});
}

class DonationPaypalWebViewPage extends StatefulWidget {
  final String approveUrl;
  final DonationPaypalFlow flow;

  const DonationPaypalWebViewPage({
    super.key,
    required this.approveUrl,
    required this.flow,
  });

  @override
  State<DonationPaypalWebViewPage> createState() =>
      _DonationPaypalWebViewPageState();
}

class _DonationPaypalWebViewPageState extends State<DonationPaypalWebViewPage> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _handledTerminalUrl = false;

  @override
  void initState() {
    super.initState();

    _controller =
        WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(Colors.white)
          ..setNavigationDelegate(
            NavigationDelegate(
              onPageStarted: (url) {
                setState(() {
                  _isLoading = true;
                });
              },
              onPageFinished: (url) {
                setState(() {
                  _isLoading = false;
                });
              },
              onNavigationRequest: (NavigationRequest request) {
                final url = request.url;
                if (_maybeHandleTerminalUrl(url)) {
                  return NavigationDecision.prevent;
                }
                return NavigationDecision.navigate;
              },
            ),
          )
          ..loadRequest(Uri.parse(widget.approveUrl));
  }

  bool _maybeHandleTerminalUrl(String url) {
    if (_handledTerminalUrl) return false;

    final lower = url.toLowerCase();

    // Ignore PayPal domains – we only care when we're redirected back.
    if (lower.contains('paypal.com')) return false;

    // Heuristic: any URL on our site under /donations that contains
    // "success" or "cancel" is treated as terminal.
    if (!lower.contains('/donations')) return false;

    if (lower.contains('cancel')) {
      _handleCancel(url);
      return true;
    }

    if (lower.contains('success')) {
      _handleApproved(url);
      return true;
    }

    return false;
  }

  void _handleApproved(String url) {
    if (_handledTerminalUrl) return;
    _handledTerminalUrl = true;

    Navigator.of(context).pop(
      DonationPaypalResult(state: DonationPaypalFlowState.approved, url: url),
    );
  }

  void _handleCancel(String url) {
    if (_handledTerminalUrl) return;
    _handledTerminalUrl = true;

    Navigator.of(context).pop(
      DonationPaypalResult(state: DonationPaypalFlowState.cancelled, url: url),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;

    final title = () {
      switch (widget.flow) {
        case DonationPaypalFlow.oneTime:
          return 'Complete Your Donation';
        case DonationPaypalFlow.recurring:
          return 'Set Up Recurring Donation';
      }
    }();

    return Scaffold(
      appBar: AppBar(
        title: Text(title).localized(),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: SizedBox(
                height: 36,
                width: 36,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
            ),
        ],
      ),
    );
  }
}
