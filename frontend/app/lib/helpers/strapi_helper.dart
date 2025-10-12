import 'dart:io' show Platform;

class StrapiHelper {
  static String get strapiBase {
    const fromDefine = String.fromEnvironment('STRAPI_URL');
    if (fromDefine.isNotEmpty) return fromDefine;
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:1339';
      return 'http://127.0.0.1:1339';
    } catch (_) {
      return 'http://127.0.0.1:1339';
    }
  }

  static String getTrueImageURL(String base_url) {
    return '${StrapiHelper.strapiBase}/uploads/${base_url}';
  }
}
