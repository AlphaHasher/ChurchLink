import '../helpers/backend_helper.dart';

class AssetHelper {
  static String getPublicUrl(String id) {
    String base = BackendHelper.apiBase.replaceAll(RegExp(r'/+$'), '');
    if (!base.endsWith('/api')) {
      base += '/api';
    }
    return '$base/v1/assets/public/id/${Uri.encodeComponent(id)}';
  }
}
