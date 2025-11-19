import 'package:app/helpers/api_client.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/models/transactions.dart';

/// - POST /v1/transactions/my
/// - Uses TransactionSearchParams-style filters
/// - Returns a paginated TransactionsResults envelope
class TransactionsHelper {
  TransactionsHelper._();

  static const int _defaultPage = 1;
  static const int _defaultPageSize = 25;

  /// Build the request body from search params, dropping null/empty values.
  static Map<String, dynamic> _buildBody(Map<String, dynamic>? params) {
    final body = Map<String, dynamic>.from(params ?? const {});

    body.removeWhere((key, value) {
      if (value == null) return true;
      if (value is String && value.trim().isEmpty) return true;
      if (value is Iterable && value.isEmpty) return true;
      return false;
    });

    return body;
  }

  /// A safe empty result envelope, used on errors / invalid responses.
  static TransactionsResults _emptyResults({int? page, int? pageSize}) {
    return TransactionsResults(
      items: const <TransactionSummary>[],
      page: page ?? _defaultPage,
      pageSize: pageSize ?? _defaultPageSize,
      hasMore: false,
      nextPage: null,
      counts: const {'total_fetched': 0},
    );
  }

  /// Fetch transactions for the currently authenticated user.
  static Future<TransactionsResults> fetchMyTransactions({
    TransactionSearchParams? params,
  }) async {
    final int page = params?.page ?? _defaultPage;
    final int pageSize = params?.pageSize ?? _defaultPageSize;

    try {
      final Map<String, dynamic> body = _buildBody(
        params?.toJson() ?? const {},
      );

      final res = await api.post('/v1/transactions/my', data: body);

      final raw = res.data;
      if (raw is! Map) {
        return _emptyResults(page: page, pageSize: pageSize);
      }

      final Map<String, dynamic> json = Map<String, dynamic>.from(raw);

      // Let the model parse the response as-is.
      final parsed = TransactionsResults.fromJson(json);

      return parsed;
    } catch (e, st) {
      logger.e(
        '[TransactionsHelper] fetchMyTransactions() -> error',
        error: e,
        stackTrace: st,
      );
      return _emptyResults(page: page, pageSize: pageSize);
    }
  }
}
