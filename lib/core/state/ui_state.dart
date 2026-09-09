import '../errors/app_error.dart';

/// High-level UI state status definitions.
enum UiStatus {
  loading,
  success,
  error,
  empty,
  refreshing,
  offline,
}

/// Generic, immutable UI state representation.
/// Eliminates null-as-error anti-patterns and unifies state transitions across the application.
class UiState<T> {
  final UiStatus status;
  final T? data;
  final String? errorMessage;
  final String? errorCode;
  final AppError? error;

  const UiState._({
    required this.status,
    this.data,
    this.errorMessage,
    this.errorCode,
    this.error,
  });

  const UiState.loading([T? previousData])
      : this._(status: UiStatus.loading, data: previousData);

  const UiState.success(T data) : this._(status: UiStatus.success, data: data);

  const UiState.empty() : this._(status: UiStatus.empty);

  const UiState.error(
    String message, {
    String? code,
    T? previousData,
    AppError? error,
  }) : this._(
          status: UiStatus.error,
          errorMessage: message,
          errorCode: code,
          data: previousData,
          error: error,
        );

  const UiState.refreshing(T data)
      : this._(status: UiStatus.refreshing, data: data);

  const UiState.offline(T data) : this._(status: UiStatus.offline, data: data);

  /// Factory creating [UiState] directly from a typed [AppError].
  /// If [error] is an offline network error and cached [previousData] exists,
  /// returns [UiState.offline] to preserve offline-first usability.
  factory UiState.fromError(
    AppError error, {
    T? previousData,
    bool isArabic = false,
  }) {
    if (error.isOffline && previousData != null) {
      return UiState.offline(previousData);
    }
    return UiState.error(
      error.userFacingMessage(isArabic),
      code: error.code,
      previousData: previousData,
      error: error,
    );
  }

  bool get isLoading => status == UiStatus.loading;
  bool get isSuccess => status == UiStatus.success;
  bool get isError => status == UiStatus.error;
  bool get isEmpty => status == UiStatus.empty;
  bool get isRefreshing => status == UiStatus.refreshing;
  bool get isOffline => status == UiStatus.offline;
  bool get hasData => data != null;
  AppErrorKind? get errorKind => error?.kind;

  R when<R>({
    required R Function(T? data) loading,
    required R Function(T data) success,
    required R Function(String message, String? code, T? previousData) error,
    required R Function() empty,
    R Function(T data)? refreshing,
    R Function(T data)? offline,
  }) {
    switch (status) {
      case UiStatus.loading:
        return loading(data);
      case UiStatus.success:
        return success(data as T);
      case UiStatus.error:
        return error(errorMessage ?? 'An error occurred', errorCode, data);
      case UiStatus.empty:
        return empty();
      case UiStatus.refreshing:
        return (refreshing ?? success)(data as T);
      case UiStatus.offline:
        return (offline ?? success)(data as T);
    }
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UiState<T> &&
          runtimeType == other.runtimeType &&
          status == other.status &&
          data == other.data &&
          errorMessage == other.errorMessage &&
          errorCode == other.errorCode;

  @override
  int get hashCode =>
      status.hashCode ^
      data.hashCode ^
      errorMessage.hashCode ^
      errorCode.hashCode;
}
