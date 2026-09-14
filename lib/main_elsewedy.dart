export 'main_common.dart';
import 'core/tenant/tenant_brand.dart';
import 'main_common.dart';

/// Dedicated production entrypoint for Elsewedy Electric with locked corporate branding.
void main() async {
  await bootstrapApp(
    initialBrand: TenantBrand.elsewedy(),
    isFlavorLocked: true,
  );
}
