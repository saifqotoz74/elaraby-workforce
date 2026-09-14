export 'main_common.dart';
import 'core/tenant/tenant_brand.dart';
import 'main_common.dart';

/// Dedicated production entrypoint for Elaraby Group with locked corporate branding.
void main() async {
  await bootstrapApp(
    initialBrand: TenantBrand.elaraby(),
    isFlavorLocked: true,
  );
}
