export 'main_common.dart';
import 'core/tenant/tenant_brand.dart';
import 'main_common.dart';

/// Dedicated production entrypoint for Gulf Industrial Corp with locked corporate branding.
void main() async {
  await bootstrapApp(
    initialBrand: TenantBrand.gulfIndustrial(),
    isFlavorLocked: true,
  );
}
