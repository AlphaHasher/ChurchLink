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
  }) : assert(height != null || aspectRatio != null,
            'Either height or aspectRatio must be provided.');

  final List<String> urls;
  final BorderRadius borderRadius;
  final double? height;
  final double? aspectRatio;
  final BoxFit fit;

  @override
  State<BulletinMediaImage> createState() => _BulletinMediaImageState();
}

class _BulletinMediaImageState extends State<BulletinMediaImage> {
  late int _activeIndex;

  @override
  void initState() {
    super.initState();
    _activeIndex = widget.urls.isEmpty ? -1 : 0;
  }

  @override
  void didUpdateWidget(covariant BulletinMediaImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!listEquals(oldWidget.urls, widget.urls)) {
      setState(() {
        _activeIndex = widget.urls.isEmpty ? -1 : 0;
      });
    }
  }

  void _advanceSource() {
    if (!mounted) return;
    if (_activeIndex + 1 < widget.urls.length) {
      setState(() => _activeIndex++);
    } else if (_activeIndex != -1) {
      setState(() => _activeIndex = -1);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_activeIndex < 0 || widget.urls.isEmpty) {
      return const SizedBox.shrink();
    }

    final url = widget.urls[_activeIndex];
    final image = Image.network(
      url,
      fit: widget.fit,
      width: double.infinity,
      height: widget.aspectRatio == null ? widget.height : null,
      errorBuilder: (context, error, stackTrace) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _advanceSource());
        return const SizedBox.shrink();
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
}
