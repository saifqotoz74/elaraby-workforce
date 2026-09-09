/// Lightweight, test-safe Service Locator container.
/// Decouples dependencies and allows mocking without singleton mutation.
class ServiceLocator {
  ServiceLocator._();

  static final Map<Type, Object> _instances = {};
  static final Map<Type, Object Function()> _factories = {};

  /// Registers a lazy singleton instance.
  static void registerSingleton<T extends Object>(T instance) {
    _instances[T] = instance;
  }

  /// Registers a factory provider that produces a fresh instance per request.
  static void registerFactory<T extends Object>(T Function() factory) {
    _factories[T] = factory;
  }

  /// Retrieves the registered instance or invokes the factory.
  static T get<T extends Object>() {
    if (_instances.containsKey(T)) {
      return _instances[T] as T;
    }
    if (_factories.containsKey(T)) {
      return _factories[T]!() as T;
    }
    throw StateError('ServiceLocator: No service registered for type $T');
  }

  /// Checks if a service is registered.
  static bool isRegistered<T extends Object>() =>
      _instances.containsKey(T) || _factories.containsKey(T);

  /// Resets all registered services (vital for test isolation).
  static void reset() {
    _instances.clear();
    _factories.clear();
  }
}
