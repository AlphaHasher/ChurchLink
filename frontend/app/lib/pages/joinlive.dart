import 'package:app/components/livestreams/no_livestreams.dart';
import 'package:app/components/livestreams/stream_viewer.dart';
import 'package:flutter/material.dart';
import '../helpers/youtube_helper.dart';
import '../helpers/logger.dart';

class JoinLive extends StatefulWidget {
  const JoinLive({super.key});

  @override
  State<JoinLive> createState() => _JoinLiveState();
}

class _JoinLiveState extends State<JoinLive> {
  List<String> _streamIds = [];
  String _channelLink = '';

  @override
  void initState() {
    super.initState();
    _loadYoutubeData();
  }

  Future<void> _loadYoutubeData() async {
    try {
      final streamIdsFuture = YoutubeHelper.fetchStreamIDs();
      final channelLinkFuture = YoutubeHelper.fetchChannelLink();

      final ids = await streamIdsFuture;
      final link = await channelLinkFuture;

      if (!mounted) return;
      setState(() {
        _streamIds = ids;
        _channelLink = link;
      });
    } catch (e, st) {
      logger.e(
        'JoinLive: failed to load YouTube data',
        error: e,
        stackTrace: st,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('YouTube Live'),
        centerTitle: true,
        // no colors here — they come from AppTheme.appBarTheme
      ),
      body: SafeArea(
        minimum: const EdgeInsets.symmetric(horizontal: 10),
        child: Center(
          child: (_streamIds.isEmpty)
              ? NoLivestreams(channelLink: _channelLink)
              : StreamViewer(streamIds: _streamIds),
        ),
      ),
    );
  }
}
