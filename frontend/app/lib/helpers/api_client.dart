import 'package:app/helpers/backend_helper.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

class ApiClient {
  final Dio dio;

  ApiClient({
    required String baseUrl,
    FirebaseAuth? firebaseAuth,
    Interceptor? logger,
  }) : dio = Dio(
         BaseOptions(
           baseUrl: '$baseUrl/api',
           headers: {
             'Content-Type': 'application/json',
             'Accept': 'application/json',
           },
           connectTimeout: const Duration(seconds: 15),
           receiveTimeout: const Duration(seconds: 30),
           sendTimeout: const Duration(seconds: 30),
         ),
       ) {
    final auth = firebaseAuth ?? FirebaseAuth.instance;

    dio.interceptors.add(_FirebaseAuthInterceptor(dio, auth));

    if (logger != null) {
      dio.interceptors.add(logger);
    }
  }
}

class _FirebaseAuthInterceptor extends Interceptor {
  final Dio _dio;
  final FirebaseAuth _auth;

  _FirebaseAuthInterceptor(this._dio, this._auth);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final user = _auth.currentUser;

    if (user != null) {
      try {
        final token = await user.getIdToken();
        options.headers['Authorization'] = 'Bearer $token';
      } catch (_) {}
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final status = err.response?.statusCode;

    final alreadyRetried = err.requestOptions.extra['__ret401'] == true;

    if (status == 401 && !alreadyRetried) {
      final user = _auth.currentUser;
      if (user != null) {
        try {
          final newToken = await user.getIdToken(true);
          final RequestOptions original = err.requestOptions;

          final updated = original.copyWith(
            headers: Map<String, dynamic>.from(original.headers)
              ..['Authorization'] = 'Bearer $newToken',
            extra: Map<String, dynamic>.from(original.extra)
              ..['__ret401'] = true,
          );

          final Response<dynamic> response = await _dio.fetch(updated);
          handler.resolve(response);
          return;
        } catch (_) {}
      }
    }

    handler.next(err);
  }
}

final api = ApiClient(baseUrl: BackendHelper.apiBase).dio;