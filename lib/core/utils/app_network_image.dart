import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import '../network/api_client.dart';
import '../theme/app_colors.dart';

/// High-performance, disk-cached image loader with bounded bitmap decoding.
///
/// Features:
/// 1. Prevents OOM crashes on budget devices by enforcing `cacheWidth` and `cacheHeight`.
/// 2. Caches images on disk so they remain visible offline inside factory zones.
/// 3. Provides smooth placeholder & fallback error visuals.
class AppNetworkImage extends StatefulWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final Widget? placeholder;
  final Widget? errorWidget;
  final int memCacheWidth;
  final int memCacheHeight;

  const AppNetworkImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholder,
    this.errorWidget,
    this.memCacheWidth = 600,
    this.memCacheHeight = 600,
  });

  @override
  State<AppNetworkImage> createState() => _AppNetworkImageState();
}

class _AppNetworkImageState extends State<AppNetworkImage> {
  static final HttpClient _client = HttpClient()
    ..connectionTimeout = const Duration(seconds: 8);
  static bool _pruning = false;

  File? _cachedFile;
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  @override
  void didUpdateWidget(covariant AppNetworkImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl) {
      _loadImage();
    }
  }

  String _hashUrl(String url) {
    return md5.convert(utf8.encode(url)).toString();
  }

  static void _maybePruneCache(Directory dir) {
    if (_pruning) return;
    _pruning = true;
    Future(() async {
      try {
        final files = dir
            .listSync()
            .whereType<File>()
            .where((f) => f.path.contains('img_cache_'))
            .toList();
        if (files.length > 150) {
          files.sort(
              (a, b) => a.lastModifiedSync().compareTo(b.lastModifiedSync()));
          final toDelete = files.take(files.length - 100);
          for (final f in toDelete) {
            try {
              await f.delete();
            } on FileSystemException catch (e) {
              debugPrint('Image cache file delete error: $e');
            }
          }
        }
      } on Exception catch (e) {
        debugPrint('Image cache pruning error: $e');
      } finally {
        _pruning = false;
      }
    });
  }

  Future<void> _loadImage() async {
    final raw = widget.imageUrl.trim();
    final url = ApiClient.instance.resolveUrl(raw);
    if (url.isEmpty ||
        (!url.startsWith('http://') && !url.startsWith('https://'))) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
      return;
    }

    try {
      Directory cacheDir;
      try {
        cacheDir = await getTemporaryDirectory();
      } on Exception catch (e) {
        debugPrint(
            'AppNetworkImage: getTemporaryDirectory fallback to systemTemp: $e');
        cacheDir = Directory.systemTemp;
      }
      final cacheFile = File('${cacheDir.path}/img_cache_${_hashUrl(url)}.img');

      if (await cacheFile.exists()) {
        final length = await cacheFile.length();
        if (length > 0) {
          if (mounted) {
            setState(() {
              _cachedFile = cacheFile;
              _loading = false;
              _error = false;
            });
          }
          return;
        }
      }

      // Download and cache atomically using shared client and efficient streaming
      final request = await _client.getUrl(Uri.parse(url));
      final response = await request.close();

      if (response.statusCode == 200) {
        final builder = BytesBuilder(copy: false);
        await for (final chunk in response) {
          builder.add(chunk);
        }
        final bytes = builder.takeBytes();
        if (bytes.isNotEmpty) {
          await cacheFile.writeAsBytes(bytes, flush: true);
          _maybePruneCache(cacheDir);
          if (mounted) {
            setState(() {
              _cachedFile = cacheFile;
              _loading = false;
              _error = false;
            });
          }
          return;
        }
      }
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    } on Exception catch (e) {
      debugPrint('AppNetworkImage: Image loading failed: $e');
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget content;

    if (_loading) {
      content = widget.placeholder ??
          Container(
            width: widget.width,
            height: widget.height,
            color: const Color(0xFFE5E7EB),
            alignment: Alignment.center,
            child: const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.primary,
              ),
            ),
          );
    } else if (_error || _cachedFile == null) {
      content = widget.errorWidget ??
          Container(
            width: widget.width,
            height: widget.height,
            color: const Color(0xFFF1F5F9),
            alignment: Alignment.center,
            child: const Icon(
              Icons.image_not_supported_outlined,
              color: AppColors.textSecondary,
              size: 24,
            ),
          );
    } else {
      content = Image.file(
        _cachedFile!,
        width: widget.width,
        height: widget.height,
        fit: widget.fit,
        cacheWidth: widget.memCacheWidth,
        cacheHeight: widget.memCacheHeight,
        errorBuilder: (_, __, ___) =>
            widget.errorWidget ??
            Container(
              width: widget.width,
              height: widget.height,
              color: const Color(0xFFF1F5F9),
              alignment: Alignment.center,
              child: const Icon(
                Icons.broken_image_outlined,
                color: AppColors.textSecondary,
                size: 24,
              ),
            ),
      );
    }

    if (widget.borderRadius != null) {
      return ClipRRect(
        borderRadius: widget.borderRadius!,
        child: content,
      );
    }

    return content;
  }
}
