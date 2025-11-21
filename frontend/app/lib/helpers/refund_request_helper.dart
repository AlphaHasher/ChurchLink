import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/models/refund_request.dart';
import 'package:app/helpers/time_formatter.dart';

class RefundRequestHelper {
  RefundRequestHelper._();

  static const int _defaultPage = 0; // 0-based
  static const int _defaultPageSize = 25;

  /// Build query params by dropping null, empty strings, and empty lists.
  static Map<String, dynamic> _buildQuery(Map<String, dynamic>? params) {
    final cleaned = Map<String, dynamic>.from(params ?? const {});

    cleaned.removeWhere((key, value) {
      if (value == null) return true;
      if (value is String && value.trim().isEmpty) return true;
      if (value is Iterable && value.isEmpty) return true;
      return false;
    });

    return cleaned;
  }

  /// Safe empty envelope for paged results.
  static RefundRequestPagedResults _emptyPagedResults({
    int? page,
    int? pageSize,
  }) {
    return RefundRequestPagedResults(
      items: const <RefundRequestWithTransaction>[],
      total: 0,
      page: page ?? _defaultPage,
      pageSize: pageSize ?? _defaultPageSize,
    );
  }

  /// User: create or update a refund request for a given transaction.
  ///
  /// Backend enforces:
  ///  - txn_kind is "event" or "form"
  ///  - ownership of the target transaction
  static Future<CreateRefundRequestResponse> createRefundRequest(
    CreateRefundRequestPayload payload,
  ) async {
    try {
      final txnId = payload.txnId;

      if (txnId.trim().isEmpty) {
        return CreateRefundRequestResponse(
          success: false,
          msg: 'Missing transaction information',
        );
      }

      final trimmedMessage = payload.message.trim();
      if (trimmedMessage.isEmpty) {
        return CreateRefundRequestResponse(
          success: false,
          msg: 'Please provide a message describing your refund request',
        );
      }

      final Map<String, dynamic> body = payload.toJson();
      body['message'] = trimmedMessage;

      final res = await api.post(
        '/v1/refund-requests/create-request',
        data: body,
      );

      final raw = res.data;
      if (raw is! Map) {
        return CreateRefundRequestResponse(
          success: false,
          msg: 'Invalid response from server',
        );
      }

      final json = Map<String, dynamic>.from(raw);
      final response = CreateRefundRequestResponse.fromJson(json);

      return response;
    } catch (e, st) {
      logger.e(
        '[RefundRequestHelper] createRefundRequest() -> error',
        error: e,
        stackTrace: st,
      );
      return CreateRefundRequestResponse(
        success: false,
        msg: 'Unable to submit refund request',
      );
    }
  }

  /// User: fetch refund requests for the currently authenticated user.
  ///
  /// - GET /v1/refund-requests/my
  /// - Uses MyRefundRequestSearchParams for filtering (status, txn_kind, page, pageSize)
  static Future<RefundRequestPagedResults> fetchMyRefundRequests({
    MyRefundRequestSearchParams? params,
  }) async {
    final int page = params?.page ?? _defaultPage;
    final int pageSize = params?.pageSize ?? _defaultPageSize;

    try {
      final Map<String, dynamic> query = _buildQuery(params?.toJson());

      final res = await api.get(
        '/v1/refund-requests/my',
        queryParameters: query,
      );

      final raw = res.data;
      if (raw is! Map) {
        return _emptyPagedResults(page: page, pageSize: pageSize);
      }

      final json = Map<String, dynamic>.from(raw);

      // *** Time normalization hook ***
      final rawItems =
          (json['items'] as List<dynamic>? ?? [])
              .map<Map<String, dynamic>>(
                (e) => Map<String, dynamic>.from(e as Map),
              )
              .toList();

      json['items'] = convertRefundRequestsToUserTime(rawItems);
      // *** end hook ***

      final results = RefundRequestPagedResults.fromJson(json);

      // If backend didn't set page/pageSize/total, fall back to defaults.
      return RefundRequestPagedResults(
        items: results.items,
        total: results.total,
        page: results.page,
        pageSize: results.pageSize,
      );
    } catch (e, st) {
      logger.e(
        '[RefundRequestHelper] fetchMyRefundRequests() -> error',
        error: e,
        stackTrace: st,
      );
      return _emptyPagedResults(page: page, pageSize: pageSize);
    }
  }
}
