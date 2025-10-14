import 'api_client.dart';
import 'logger.dart';

class YoutubeHelper {
  // Fetches the StreamIDs of the current lives from backend
  static Future<List<String>> fetchStreamIDs() async {
    try {
      final res = await api.get('/v1/youtube/livestreams');
      final data = res.data as Map<String, dynamic>;
      return List<String>.from(data['stream_ids'] ?? []);
    } catch (e, st) {
      logger.e("Failed to fetch Youtube Stream Ids!", error: e, stackTrace: st);
      return [];
    }
  }

  // Fetches the Youtube channel ID
  static Future<String?> fetchChannelID() async {
    try {
      final res = await api.get('/v1/youtube/channel_id');
      final data = res.data as Map<String, dynamic>;
      return data['channel_id'] as String?;
    } catch (e, st) {
      logger.e("Failed to get Channel ID!", error: e, stackTrace: st);
      return null;
    }
  }

  // Returns a channel link, or empty string if not available
  static Future<String> fetchChannelLink() async {
    try {
      final id = await fetchChannelID();
      if (id == null) return '';
      return channelLinkFromID(id);
    } catch (e, st) {
      logger.e("Failed to get Channel Link!", error: e, stackTrace: st);
      return '';
    }
  }

  // Converts channel ID into Youtube channel link
  static String channelLinkFromID(String id) {
    final safeId = Uri.encodeComponent(id);
    return 'https://www.youtube.com/channel/$safeId';
  }

  // Converts stream ID into embed URL
  static String embedUrlFromStreamID(String id) {
    final safeId = Uri.encodeComponent(id);
    return 'https://www.youtube-nocookie.com/embed/$safeId?rel=0&modestbranding=1&playsinline=1';
  }

  // Converts stream ID into watch URL
  static String streamUrlFromStreamID(String id) {
    final safeId = Uri.encodeComponent(id);
    return 'https://www.youtube.com/watch?v=$safeId';
  }
}
