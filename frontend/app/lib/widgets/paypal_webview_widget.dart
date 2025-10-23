import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Reusable PayPal WebView widget for handling PayPal payment flows
class PayPalWebViewWidget extends StatefulWidget {
  final String approvalUrl;
  final String paymentId;
  final Function(String paymentId, String payerId) onPaymentSuccess;
  final Function(String error) onPaymentError;
  final VoidCallback? onPaymentCancel;
  final String title;
  final String? successUrlPattern;
  final String? cancelUrlPattern;

  const PayPalWebViewWidget({
    super.key,
    required this.approvalUrl,
    required this.paymentId,
    required this.onPaymentSuccess,
    required this.onPaymentError,
    this.onPaymentCancel,
    this.title = 'Complete Payment',
    this.successUrlPattern,
    this.cancelUrlPattern,
  });

  @override
  State<PayPalWebViewWidget> createState() => _PayPalWebViewWidgetState();
}

class _PayPalWebViewWidgetState extends State<PayPalWebViewWidget> {
  late final WebViewController controller;

  @override
  void initState() {
    super.initState();
    _initializeController();
  }

  void _initializeController() {
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            log('[PayPalWebView] Page started: $url');
            _handleUrlChange(url);
          },
          onPageFinished: (String url) {
            log('[PayPalWebView] Page finished: $url');
          },
          onNavigationRequest: (NavigationRequest request) {
            log('[PayPalWebView] Navigation request: ${request.url}');
            _handleUrlChange(request.url);
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.approvalUrl));
  }

  void _handleUrlChange(String url) {
    // Check for success patterns
    final successPatterns = [
      widget.successUrlPattern ?? 'payment/success',
      'PayerID=',
      'payer_id=',
    ];

    for (String pattern in successPatterns) {
      if (url.contains(pattern)) {
        _handleSuccess(url);
        return;
      }
    }

    // Check for cancel patterns
    final cancelPatterns = [
      widget.cancelUrlPattern ?? 'payment/cancel',
      'cancel',
    ];

    for (String pattern in cancelPatterns) {
      if (url.contains(pattern)) {
        _handleCancel();
        return;
      }
    }
  }

  void _handleSuccess(String url) {
    try {
      log('[PayPalWebView] Payment success detected: $url');
      
      final uri = Uri.parse(url);
      final payerId = uri.queryParameters['PayerID'] ?? 
                     uri.queryParameters['payer_id'] ?? 
                     uri.queryParameters['payerid'] ?? '';
      
      if (payerId.isEmpty) {
        widget.onPaymentError('PayerID not found in success URL');
        return;
      }

      Navigator.of(context).pop();
      widget.onPaymentSuccess(widget.paymentId, payerId);
    } catch (e) {
      log('[PayPalWebView] Error handling success: $e');
      widget.onPaymentError('Failed to process payment success: $e');
    }
  }

  void _handleCancel() {
    log('[PayPalWebView] Payment cancelled by user');
    Navigator.of(context).pop();
    widget.onPaymentCancel?.call();
  }

  void _handleClose() {
    Navigator.of(context).pop();
    widget.onPaymentCancel?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: _handleClose,
        ),
        backgroundColor: const Color(0xFF0070BA),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: WebViewWidget(controller: controller),
      ),
    );
  }
}

/// Helper function to show PayPal WebView as a modal
Future<void> showPayPalWebView({
  required BuildContext context,
  required String approvalUrl,
  required String paymentId,
  required Function(String paymentId, String payerId) onPaymentSuccess,
  required Function(String error) onPaymentError,
  VoidCallback? onPaymentCancel,
  String title = 'Complete Payment',
  String? successUrlPattern,
  String? cancelUrlPattern,
  bool fullscreenDialog = true,
}) {
  return Navigator.of(context).push(
    MaterialPageRoute(
      fullscreenDialog: fullscreenDialog,
      builder: (context) => PayPalWebViewWidget(
        approvalUrl: approvalUrl,
        paymentId: paymentId,
        onPaymentSuccess: onPaymentSuccess,
        onPaymentError: onPaymentError,
        onPaymentCancel: onPaymentCancel,
        title: title,
        successUrlPattern: successUrlPattern,
        cancelUrlPattern: cancelUrlPattern,
      ),
    ),
  );
}