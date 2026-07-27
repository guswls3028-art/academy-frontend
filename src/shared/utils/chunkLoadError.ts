type ErrorLike = {
  message?: string;
  stack?: string;
};

/**
 * 배포 직후 이전 앱 셸이 새 lazy chunk와 섞일 때 발생하는 오류만 분류한다.
 * 일반 컴포넌트 TypeError까지 자동 새로고침 대상으로 넓히지 않는다.
 */
export function isChunkLoadError(
  error: ErrorLike | null | undefined,
  componentStack = "",
): boolean {
  const message = error?.message || "";
  const stack = error?.stack || "";
  const hasLazyContext =
    componentStack.includes("Lazy") ||
    stack.includes("lazyInitializer");
  const hasLazyModuleShapeError =
    hasLazyContext &&
    (
      /Cannot read propert(?:y|ies) of (?:undefined|null) \(reading ['"]default['"]\)/i.test(message) ||
      /Lazy element type must resolve to a class or function/i.test(message) ||
      (/Element type is invalid/i.test(message) && /promise that resolves to/i.test(message))
    );

  return (
    message.includes("dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Failed to fetch") ||
    message.includes("Loading chunk") ||
    message.includes("Loading CSS chunk") ||
    message.includes("LAZY_DEFAULT_UNDEFINED") ||
    stack.includes("dynamically imported module") ||
    stack.includes("Importing a module script failed") ||
    hasLazyModuleShapeError ||
    ((message === "Error" || message === "") && hasLazyContext)
  );
}
