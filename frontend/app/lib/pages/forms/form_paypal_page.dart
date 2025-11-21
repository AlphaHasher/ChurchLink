import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:app/helpers/localization_helper.dart';

/// Outcome of the in-app PayPal flow for a form.
enum FormPaypalFlowState { approved, cancelled }

class FormPaypalResult {
  final FormPaypalFlowState state;
  final String? url;

  const FormPaypalResult({required this.state, this.url});
}

/// In-app PayPal checkout page for forms.
///
/// Responsibilities:
///  - Load the PayPal approval URL returned from the backend
///  - Watch navigation and detect when PayPal redirects back to our frontend:
///      /forms/:slug/payment/success
///      /forms/:slug/payment/cancel
///  - Pop back to the caller with a [FormPaypalResult] indicating success/cancel
///
/// This widget does NOT perform capture or submission; the caller is expected
/// to call capture-and-submit once an "approved" result is received.
class FormPaypalWebViewPage extends StatefulWidget {
  final String slug;
  final String orderId;
  final String approveUrl;

  const FormPaypalWebViewPage({
    super.key,
    required this.slug,
    required this.orderId,
    required this.approveUrl,
  });

  @override
  State<FormPaypalWebViewPage> createState() => _FormPaypalWebViewPageState();
}

class _FormPaypalWebViewPageState extends State<FormPaypalWebViewPage> {
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
              onNavigationRequest: _handleNavigation,
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
            // If the user manually backs out, treat that as a cancellation
            // unless we've already handled a success/cancel redirect.
            if (_handledTerminalUrl) {
              Navigator.of(context).pop();
              return;
            }
            Navigator.of(
              context,
            ).pop(const FormPaypalResult(state: FormPaypalFlowState.cancelled));
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

    // debugPrint('Form PayPal WebView navigating to $url');

    // We expect the frontend to redirect PayPal back to URLs like:
    //   {FRONTEND_URL}/forms/:slug/payment/success?token=...
    //   {FRONTEND_URL}/forms/:slug/payment/cancel
    //
    // To keep this robust against hash routing or base-path changes, we match
    // on path fragments rather than exact path.
    final successPatternSlug =
        '/forms/${widget.slug}/payment/success'; // best-case
    final cancelPatternSlug = '/forms/${widget.slug}/payment/cancel';

    final bool looksLikeSuccess =
        url.contains(successPatternSlug) ||
        (url.contains('/forms/') && url.contains('/payment/success'));
    final bool looksLikeCancel =
        url.contains(cancelPatternSlug) ||
        (url.contains('/forms/') && url.contains('/payment/cancel'));

    if (looksLikeSuccess) {
      _handleSuccessRedirect(url);
      return NavigationDecision.prevent;
    }

    if (looksLikeCancel) {
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
    ).pop(FormPaypalResult(state: FormPaypalFlowState.approved, url: url));
  }

  void _handleCancelRedirect(String url) {
    if (_handledTerminalUrl) return;
    _handledTerminalUrl = true;

    Navigator.of(
      context,
    ).pop(FormPaypalResult(state: FormPaypalFlowState.cancelled, url: url));
  }
}
