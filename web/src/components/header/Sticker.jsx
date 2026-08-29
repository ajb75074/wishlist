import { useRef, useState } from "react";

// How far the pointer has to move before a press counts as a drag
// instead of a click.
const DRAG_THRESHOLD = 4;

function Sticker({ src, className, alt = "" }) {
  const [isWiggling, setIsWiggling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(null);

  const imgRef = useRef(null);
  const pointerIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  function handlePointerEnter() {
    if (draggingRef.current) return;
    setIsWiggling(true);
  }

  function handlePointerDown(event) {
    const img = imgRef.current;
    if (!img) return;

    // Offset from the sticker's own top-left corner to wherever it was
    // grabbed, so that exact point stays under the cursor while dragging.
    const imgRect = img.getBoundingClientRect();

    pointerIdRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY };
    grabOffsetRef.current = {
      x: event.clientX - imgRect.left,
      y: event.clientY - imgRect.top,
    };

    img.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (pointerIdRef.current !== event.pointerId) return;

    const img = imgRef.current;
    if (!img) return;

    if (!draggingRef.current) {
      const dx = event.clientX - startRef.current.x;
      const dy = event.clientY - startRef.current.y;

      // Not enough movement yet - treat this as a click, not a drag.
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }

      draggingRef.current = true;
      setIsDragging(true);
      setIsWiggling(false);
    }

    const header = img.closest(".header");
    if (!header) return;

    const headerRect = header.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    let left = event.clientX - headerRect.left - grabOffsetRef.current.x;
    let top = event.clientY - headerRect.top - grabOffsetRef.current.y;

    // Clamp so the sticker can't be dragged outside the header.
    const maxLeft = Math.max(headerRect.width - imgRect.width, 0);
    const maxTop = Math.max(headerRect.height - imgRect.height, 0);

    left = Math.min(Math.max(left, 0), maxLeft);
    top = Math.min(Math.max(top, 0), maxTop);

    setDragPosition({ left, top });
  }

  function handlePointerUp(event) {
    if (pointerIdRef.current !== event.pointerId) return;

    const img = imgRef.current;
    if (img?.hasPointerCapture(event.pointerId)) {
      img.releasePointerCapture(event.pointerId);
    }

    pointerIdRef.current = null;
    draggingRef.current = false;
    setIsDragging(false);
  }

  const style = dragPosition
    ? {
        left: `${dragPosition.left}px`,
        top: `${dragPosition.top}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      draggable="false"
      style={style}
      className={`header-decor ${className} ${
        isWiggling ? "is-wiggling" : ""
      } ${isDragging ? "is-dragging" : ""}`}
      onPointerEnter={handlePointerEnter}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onAnimationEnd={() => setIsWiggling(false)}
    />
  );
}

export default Sticker;
