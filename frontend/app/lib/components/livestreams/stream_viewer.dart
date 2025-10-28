import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app/helpers/logger.dart';
import 'package:app/helpers/youtube_helper.dart';
import 'package:app/components/livestreams/stream_embed.dart';

class StreamViewer extends StatefulWidget {
  const StreamViewer({
    super.key,
    required this.streamIds,
    this.initialIndex = 0,
  });

  final List<String> streamIds;
  final int initialIndex;

  @override
  State<StreamViewer> createState() => _StreamViewerState();
}

class _StreamViewerState extends State<StreamViewer>
    with SingleTickerProviderStateMixin {
  late int _index;
  TabController? _tabController;

  int get _len => widget.streamIds.length;

  @override
  void initState() {
    super.initState();
    _index =
        (widget.initialIndex >= 0 && widget.initialIndex < _len)
            ? widget.initialIndex
            : 0;
    _initController();
  }

  @override
  void didUpdateWidget(covariant StreamViewer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_len == 0) return;
    final needsRebuild =
        (oldWidget.streamIds.length != _len) || (_index >= _len);
    if (needsRebuild) {
      _index = (_index < _len) ? _index : 0;
      _initController();
      logger.i('StreamViewer: controller rebuilt, index=$_index, len=$_len');
    }
  }

  void _initController() {
    _tabController?.removeListener(_onTabChanged);
    _tabController?.dispose();
    _tabController = TabController(
      length: _len == 0 ? 1 : _len,
      vsync: this,
      initialIndex: _index,
    )..addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (!_tabController!.indexIsChanging) {
      final newIndex = _tabController!.index;
      if (newIndex != _index) {
        setState(() => _index = newIndex);
        logger.i('StreamViewer: selected index $_index');
      }
    }
  }

  Future<void> _openCurrentOnYouTube() async {
    if (widget.streamIds.isEmpty || _index >= widget.streamIds.length) {
      logger.w(
        'StreamViewer: open pressed but no valid stream at index $_index',
      );
      return;
    }
    final id = widget.streamIds[_index];
    final url = YoutubeHelper.streamUrlFromStreamID(id);
    final uri = Uri.parse(url);

    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      logger.i('StreamViewer: opened $url');
    } else {
      logger.e('StreamViewer: could not launch $url');
    }
  }

  @override
  void dispose() {
    _tabController?.removeListener(_onTabChanged);
    _tabController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ids = widget.streamIds;
    if (ids.isEmpty) return const SizedBox.shrink();

    final isMulti = ids.length > 1;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Conditional text based on if there are multiple streams or not to make it more clear to users how to change streams
          Text(
            (isMulti)
                ? 'We have multiple ongoing livestreams! Please select where you would like to join us.'
                : 'We are live! Please join us below',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 14),

          // Adds a tab switch if there are multiple streams
          if (isMulti) ...[
            TabBar(
              controller: _tabController,
              isScrollable: true,
              tabAlignment: TabAlignment.center,
              labelPadding: const EdgeInsets.symmetric(horizontal: 20),
              labelStyle: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
              indicatorSize: TabBarIndicatorSize.label,
              tabs: List.generate(
                ids.length,
                (i) => Tab(text: 'Stream ${i + 1}'),
              ),
            ),
            const SizedBox(height: 20),
          ],

          // The embedded stream itself
          StreamEmbed(key: ValueKey(ids[_index]), streamId: ids[_index]),

          const SizedBox(height: 16),

          // Button to open in YouTube in case they want to watch within their YT app
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _openCurrentOnYouTube,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 14,
                ),
                textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 0,
              ),
              child: const Text('Open in YouTube'),
            ),
          ),
        ],
      ),
    );
  }
}

