export 'main_common.dart';
import 'main_common.dart';

/// Default dynamic multi-tenant entrypoint (unlocked brand switcher).
void main() async {
  await bootstrapApp(isFlavorLocked: false);
}
