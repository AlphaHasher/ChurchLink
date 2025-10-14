import '../helpers/backend_helper.dart';

class AssetHelper {
  static String getAssetUrl(String filename) {
    String base = BackendHelper.apiBase.replaceAll(RegExp(r'\/+$'), '');
    if (!base.endsWith('/api')) {
      base += '/api';
    }
    final encodedFilename = Uri.encodeComponent(filename);
    return '$base/v1/assets/public/$encodedFilename';
  }
}
