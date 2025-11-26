import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:app/helpers/localization_helper.dart';

enum PaypalFlowState { approved, cancelled }

class PaypalFlowResult {
  final PaypalFlowState state;
  final String? url;

  const PaypalFlowResult({required this.state, this.url});
}

class PaypalWebViewPage extends StatefulWidget {
  final String instanceId;
  final String orderId;
  final String approveUrl;

  const PaypalWebViewPage({
    super.key,
    required this.instanceId,
    required this.orderId,
    required this.approveUrl,
  });

  @override
  State<PaypalWebViewPage> createState() => _PaypalWebViewPageState();
}

class _PaypalWebViewPageState extends State<PaypalWebViewPage> {
  late final WebViewController _controller;

  bool _handledTerminalUrl = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();

    _controller =
        WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setNavigationDelegate(
            NavigationDelegate(
              onPageStarted: (_) {
                if (!_loading && mounted) {
                  setState(() {
                    _loading = true;
                  });
                }
              },
              onPageFinished: (_) {
                if (_loading && mounted) {
                  setState(() {
                    _loading = false;
                  });
                }
              },
              onNavigationRequest: (NavigationRequest request) {
                return _handleNavigation(request);
              },
            ),
          )
          ..loadRequest(Uri.parse(widget.approveUrl));
  }

  @override
  Widget build(BuildContext context) {
    final localize = LocalizationHelper.localize;

    return Scaffold(
      appBar: AppBar(
        title: Text(localize('Pay with PayPal')),
        leading: BackButton(
          onPressed: () {
            // Treat manual back as cancel if we haven't already handled
            // a success/cancel redirect.
            if (_handledTerminalUrl) {
              Navigator.of(context).pop();
              return;
            }
            Navigator.of(
              context,
            ).pop(const PaypalFlowResult(state: PaypalFlowState.cancelled));
          },
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            const Positioned.fill(
              child: ColoredBox(
                color: Colors.black12,
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
        ],
      ),
    );
  }

  NavigationDecision _handleNavigation(NavigationRequest request) {
    final url = request.url;

    final successPattern =
        '/event_payments/${widget.instanceId}/payment/success';
    final cancelPattern = '/event_payments/${widget.instanceId}/payment/cancel';

    if (url.contains(successPattern)) {
      _handleSuccessRedirect(url);
      return NavigationDecision.prevent;
    }

    if (url.contains(cancelPattern)) {
      _handleCancelRedirect(url);
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  void _handleSuccessRedirect(String url) {
    if (_handledTerminalUrl) return;
    _handledTerminalUrl = true;

    Navigator.of(
      context,
    ).pop(PaypalFlowResult(state: PaypalFlowState.approved, url: url));
  }

  void _handleCancelRedirect(String url) {
    if (_handledTerminalUrl) return;
    _handledTerminalUrl = true;

    Navigator.of(
      context,
    ).pop(PaypalFlowResult(state: PaypalFlowState.cancelled, url: url));
  }
}
