import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class BulletinMediaImage extends StatefulWidget {
  const BulletinMediaImage({
    super.key,
    required this.urls,
    required this.borderRadius,
    this.height,
    this.aspectRatio,
    this.fit = BoxFit.cover,
    this.maxRetriesPerUrl = 3,
  }) : assert(height != null || aspectRatio != null,
            'Either height or aspectRatio must be provided.'),
        assert(maxRetriesPerUrl >= 1, 'maxRetriesPerUrl must be at least 1.');

  final List<String> urls;
  final BorderRadius borderRadius;
  final double? height;
  final double? aspectRatio;
  final BoxFit fit;
  final int maxRetriesPerUrl;

  @override
  State<BulletinMediaImage> createState() => _BulletinMediaImageState();
}

class _BulletinMediaImageState extends State<BulletinMediaImage> {
  late int _activeIndex;
  int _reloadToken = 0;
  final Map<String, int> _attempts = {};
  bool _imageLoadedSuccessfully = false;
  bool _allUrlsFailed = false;

  @override
  void initState() {
    super.initState();
    _resetSourceState();
  }

  @override
  void didUpdateWidget(covariant BulletinMediaImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!listEquals(oldWidget.urls, widget.urls)) {
      setState(() {
        _resetSourceState();
      });
    }
    if (oldWidget.maxRetriesPerUrl != widget.maxRetriesPerUrl) {
      _attempts.clear();
      _reloadToken = 0;
    }
  }

  void _resetSourceState() {
    _activeIndex = widget.urls.isEmpty ? -1 : 0;
    _reloadToken = 0;
    _attempts.clear();
    _imageLoadedSuccessfully = false;
    _allUrlsFailed = false;
  }

  void _advanceSource() {
    if (!mounted) return;
    if (_activeIndex >= 0 && _activeIndex < widget.urls.length) {
      _attempts.remove(widget.urls[_activeIndex]);
    }
    if (_activeIndex + 1 < widget.urls.length) {
      setState(() {
        _activeIndex++;
        _reloadToken = 0;
      });
    } else {
      setState(() {
        _activeIndex = -1;
        _allUrlsFailed = true;
      });
    }
  }

  void _retryCurrentSource() {
    if (!mounted || _activeIndex < 0 || _activeIndex >= widget.urls.length) {
      return;
    }

    final url = widget.urls[_activeIndex];
    final attempts = (_attempts[url] ?? 0) + 1;
    if (attempts >= widget.maxRetriesPerUrl) {
      _attempts.remove(url);
      _advanceSource();
      return;
    }

    _attempts[url] = attempts;

    final provider = NetworkImage(url);
    provider.evict().ignore();

    if (!mounted) return;
    setState(() => _reloadToken++);
  }

  @override
  Widget build(BuildContext context) {
    if (_activeIndex < 0 || widget.urls.isEmpty) {
      return const SizedBox.shrink();
    }

    if (_allUrlsFailed) {
      return _buildErrorContainer(context);
    }

    final url = widget.urls[_activeIndex];

    final image = Image.network(
      url,
      key: ValueKey('bulletin-media-$url-$_reloadToken'),
      fit: widget.fit,
      width: double.infinity,
      height: widget.aspectRatio == null ? widget.height : null,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) {
          if (!_imageLoadedSuccessfully) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && !_imageLoadedSuccessfully) {
                setState(() => _imageLoadedSuccessfully = true);
              }
            });
          }
          return child;
        }
        return _buildEmptyContainer();
      },
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded) {
          if (!_imageLoadedSuccessfully) {
            _imageLoadedSuccessfully = true;
          }
          return child;
        }
        if (frame == null) {
          return _buildEmptyContainer();
        }
        return child;
      },
      errorBuilder: (context, error, stackTrace) {
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _retryCurrentSource());
        return _buildEmptyContainer();
      },
    );

    Widget content;
    if (widget.aspectRatio != null) {
      content = AspectRatio(
        aspectRatio: widget.aspectRatio!,
        child: image,
      );
    } else if (widget.height != null) {
      content = SizedBox(
        height: widget.height,
        width: double.infinity,
        child: image,
      );
    } else {
      content = image;
    }

    return ClipRRect(
      borderRadius: widget.borderRadius,
      child: content,
    );
  }

  Widget _buildEmptyContainer() {
    return Container(
      color: Colors.transparent,
      alignment: Alignment.center,
    );
  }

  Widget _buildErrorContainer(BuildContext context) {
    Widget errorContent = Container(
      color: Colors.transparent,
      alignment: Alignment.center,
      child: Icon(
        Icons.broken_image_outlined,
        color: Theme.of(context).colorScheme.onSurface.withAlpha(90),
        size: 48,
      ),
    );

    if (widget.aspectRatio != null) {
      errorContent = AspectRatio(
        aspectRatio: widget.aspectRatio!,
        child: errorContent,
      );
    } else if (widget.height != null) {
      errorContent = SizedBox(
        height: widget.height,
        width: double.infinity,
        child: errorContent,
      );
    }

    return ClipRRect(
      borderRadius: widget.borderRadius,
      child: errorContent,
    );
  }
}
