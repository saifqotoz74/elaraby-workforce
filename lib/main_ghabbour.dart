export 'main_common.dart';
import 'core/tenant/tenant_brand.dart';
import 'main_common.dart';

/// Dedicated production entrypoint for GB Corp (Ghabbour) with locked corporate branding.
void main() async {
  await bootstrapApp(
    initialBrand: TenantBrand.ghabbour(),
    isFlavorLocked: true,
  );
}
