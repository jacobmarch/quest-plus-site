"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, RotateCw } from "lucide-react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { MAX_MAP_SCALE, nextZoomScale, normalizedWheelDelta } from "@/lib/map-zoom";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { MapRow } from "@/lib/database.types";
import { MAP_BUCKET } from "@/lib/maps";

const URL_LIFETIME_SECONDS = 3600;
const REFRESH_AFTER_MS = 55 * 60 * 1000;

export function MapViewer({ map }: { map: MapRow }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <MapImage
      key={`${map.id}:${map.storage_path}:${attempt}`}
      map={map}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function MapImage({ map, onRetry }: { map: MapRow; onRetry: () => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const transform = useRef<ReactZoomPanPinchRef>(null);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let refreshing = false;
    let failed = false;
    let refreshAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refreshUrl() {
      if (disposed || refreshing || failed) return;
      refreshing = true;
      if (timer) clearTimeout(timer);
      try {
        const { data, error: signingError } = await supabase.storage
          .from(MAP_BUCKET)
          .createSignedUrl(map.storage_path, URL_LIFETIME_SECONDS);
        if (disposed) return;
        if (signingError || !data?.signedUrl) {
          throw new Error(signingError?.message ?? "No image URL was returned.");
        }
        setSignedUrl(data.signedUrl);
        setError(null);
        refreshAt = Date.now() + REFRESH_AFTER_MS;
        timer = setTimeout(() => void refreshUrl(), REFRESH_AFTER_MS);
      } catch (cause) {
        if (disposed) return;
        failed = true; // A failed request requires an explicit retry, never a loop.
        setError(cause instanceof Error ? cause.message : "Unable to load the map image.");
      } finally {
        refreshing = false;
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() >= refreshAt) {
        void refreshUrl();
      }
    }
    void refreshUrl();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [map.storage_path]);

  const fitScaleRef = useRef(0.05);
  const fit = useCallback(() => {
    const container = viewport.current;
    const img = image.current;
    if (!container || !img?.naturalWidth || !img.naturalHeight) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight, 1);
    fitScaleRef.current = scale;
    void transform.current?.setTransform(
      (width - img.naturalWidth * scale) / 2,
      (height - img.naturalHeight * scale) / 2,
      scale,
      0,
    );
  }, []);

  function zoomBy(factor: number) {
    const ref = transform.current;
    const box = viewport.current?.getBoundingClientRect();
    if (!ref || !box) return;
    // Multiplicative step anchored at the viewport center; clamped by
    // nextZoomScale so repeated zoom-outs can never hide the map.
    const scale = nextZoomScale(ref.state.scale, factor, fitScaleRef.current);
    void ref.zoomToPoint(scale, box.left + box.width / 2, box.top + box.height / 2);
  }

  // The library's wheel zoom is additive (scale + delta * step), which made
  // single notches jump huge amounts on small maps. This listener replaces it
  // with the same multiplicative, clamped stepping the buttons use.
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    function onWheel(event: WheelEvent) {
      const ref = transform.current;
      if (!ref) return;
      const delta = normalizedWheelDelta(event);
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      const factor = Math.pow(1.0016, -delta);
      const scale = nextZoomScale(ref.state.scale, factor, fitScaleRef.current);
      void ref.zoomToPoint(scale, event.clientX, event.clientY);
    }
    box.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => box.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  useEffect(() => {
    const container = viewport.current;
    if (!container) return;
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fit]);

  const imageError = signedUrl !== null && failedUrl === signedUrl;
  const ready = signedUrl !== null && loadedUrl === signedUrl && !imageError;

  return (
    <section aria-label={`${map.name} image viewer`} className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-2">
        <p className="px-1 text-xs text-muted-foreground">Drag to pan · Scroll or pinch to zoom</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Zoom out" disabled={!ready} onClick={() => zoomBy(1 / 1.4)}><Minus /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Zoom in" disabled={!ready} onClick={() => zoomBy(1.4)}><Plus /></Button>
          <Button variant="outline" size="sm" disabled={!ready} onClick={fit}><Maximize /> Fit</Button>
        </div>
      </div>
      {error && signedUrl && !imageError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b p-3 text-sm text-destructive">
          Image access could not be refreshed: {error}
          <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      )}
      <div ref={viewport} className="relative h-[60svh] min-h-64 max-h-[900px] w-full overflow-hidden bg-muted/40">
        <TransformWrapper
          ref={transform}
          minScale={0.00001}
          maxScale={MAX_MAP_SCALE}
          limitToBounds
          smooth={false}
          doubleClick={{ disabled: true }}
          wheel={{ step: 0.002 }}
        >
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%", touchAction: "none" }} contentStyle={{ width: "max-content", height: "max-content" }}>
            {signedUrl && (
              // Original-resolution private maps must bypass Next image optimization for detailed zooming.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={image}
                src={signedUrl}
                alt={map.name}
                draggable={false}
                className="block select-none"
                style={{ maxWidth: "none", width: "auto", height: "auto" }}
                onLoad={() => { setLoadedUrl(signedUrl); fit(); }}
                onError={() => setFailedUrl(signedUrl)}
              />
            )}
          </TransformComponent>
        </TransformWrapper>
        {(!ready || imageError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
            {error || imageError ? (
              <>
                <p role="alert" className="max-w-md text-sm text-destructive">{imageError ? "The map image could not be loaded. Check your connection and try again." : error}</p>
                <Button variant="outline" onClick={onRetry}><RotateCw /> Retry image</Button>
              </>
            ) : <p role="status" className="text-sm text-muted-foreground">Loading map image…</p>}
          </div>
        )}
      </div>
    </section>
  );
}
