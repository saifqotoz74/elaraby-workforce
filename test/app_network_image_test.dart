import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/core/utils/app_network_image.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppNetworkImage Tests', () {
    testWidgets('renders placeholder or fallback container on invalid URL',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppNetworkImage(
              imageUrl: '',
              width: 100,
              height: 100,
            ),
          ),
        ),
      );

      await tester.pump();
      expect(find.byType(AppNetworkImage), findsOneWidget);
      expect(find.byIcon(Icons.image_not_supported_outlined), findsOneWidget);
    });

    testWidgets('renders custom errorWidget when provided', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppNetworkImage(
              imageUrl: 'invalid-url',
              errorWidget: Text('Failed to load image'),
            ),
          ),
        ),
      );

      await tester.pump();
      expect(find.text('Failed to load image'), findsOneWidget);
    });

    testWidgets('respects borderRadius clipping', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppNetworkImage(
              imageUrl: '',
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      );

      await tester.pump();
      expect(find.byType(ClipRRect), findsOneWidget);
    });
  });
}
