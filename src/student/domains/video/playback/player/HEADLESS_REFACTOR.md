# Headless Player Refactor — TDZ Fix

## B) Why it cannot TDZ anymore — proof

### 1. Dispose guard (hard guard)

In `StudentHlsController.ts`:

```ts
private guard(cb: () => void) {
  if (this.disposed) return;
  cb();
}

private setState(partial: Partial<ControllerState>) {
  if (this.disposed) return;
  Object.assign(this.state, partial);
  this.emit();
}
```

Every state update goes through `setState` or `guard`. After `dispose()` sets `this.disposed = true`, no callback can run (because `guard` and `setState` exit immediately).

### 2. Event handlers check `disposed` BEFORE emitting

```ts
const onTime = () => {
  if (this.disposed) return;
  const t = Number(el.currentTime || 0);
  this.setState({ current: t });
  // ...
};
```

All video/HLS handlers: `onLoadedMeta`, `onTime`, `onPlay`, `onPause`, `onWaiting`, `onPlaying`, `onRateChange`, `onSeeking`, `onError` — all check `this.disposed` at the start.

### 3. HLS ERROR handler

```ts
hls.on(Hls.Events.ERROR, (_: any, data: any) => {
  if (this.disposed) return;
  // ...
  if (data?.fatal) {
    if (this.disposed) return;
    this.setState({ toast: { text: message, kind: "danger" } });
    // ...
  }
});
```

### 4. React subscribes and unsubscribes on unmount

```tsx
// StudentVideoPlayer.tsx
useEffect(() => {
  // ...
  const unsub = ctrl.subscribe(setCtrlState);
  return () => {
    unsub();
    ctrl.dispose();
    controllerRef.current = null;
  };
}, [/* deps */]);
```

- React never directly attaches HLS or video listeners.
- React only receives state via `ctrl.subscribe(setCtrlState)`.
- On unmount: `unsub()` stops updates; `ctrl.dispose()` sets `disposed = true`, clears intervals, removes listeners, destroys HLS.
- After dispose, the controller never calls `setCtrlState` — the subscription is removed and all internal callbacks short‑circuit on `disposed`.

### 5. Subscription mechanism

```ts
subscribe(listener: Listener): () => void {
  if (this.disposed) return () => {};
  this.listeners.add(listener);
  return () => this.listeners.delete(listener);
}
```

On `dispose()`:
```ts
this.listeners.clear();
```

So even if `emit()` were called after dispose, it would iterate over an empty set.

---

## C) Verification checklist

### Build

```bash
pnpm run build
```

### Reproduce flows

1. **FREE_REVIEW** (전체공개영상): `?video=<id>` (no enrollment param)
2. **PROCTORED_CLASS**: `?video=<id>&enrollment=<enrollmentId>`

### Confirm no events fire after unmount

Add a temporary guard log in `StudentHlsController.ts`:

```ts
private setState(partial: Partial<ControllerState>) {
  if (this.disposed) {
    console.warn("[StudentHlsController] setState after dispose — BLOCKED");
    return;
  }
  // ...
}
```

Navigate to a video, then immediately away. You should see no `BLOCKED` logs (because no callbacks run after dispose). If you see any, something is still firing — investigate.
