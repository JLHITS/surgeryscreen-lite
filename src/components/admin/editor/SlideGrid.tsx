"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClock,
  Clock,
  Copy,
  Crop,
  Film,
  Loader2,
  MessageSquareText,
  Repeat,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TextSlideView } from "@/components/TextSlideView";
import { formatDuration } from "@/lib/format";
import type { DraftSlide } from "@/lib/types";

export interface PendingUpload {
  tempId: string;
  name: string;
}

function SlideTile({
  slide,
  index,
  defaultDurationMs,
  practiceLogoUrl,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  slide: DraftSlide;
  index: number;
  defaultDurationMs: number;
  practiceLogoUrl: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const customDuration = slide.durationMs != null;
  const scheduled = !!(slide.startAt || slide.endAt);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg border bg-muted",
        isDragging && "z-10 opacity-80 shadow-lg ring-2 ring-primary",
      )}
      onClick={onEdit}
      {...attributes}
      {...listeners}
    >
      {slide.kind === "text" && slide.text ? (
        <TextSlideView content={slide.text} practiceLogoUrl={practiceLogoUrl} />
      ) : slide.kind === "video" && slide.video ? (
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900 px-3 text-center text-white">
          {slide.video.poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.video.poster}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {slide.video.poster && <span className="absolute inset-0 bg-black/45" />}
          <span className="relative grid size-9 place-items-center rounded-full bg-black/45">
            <Film className="size-4" />
          </span>
          <span className="relative line-clamp-2 text-xs font-medium">
            {slide.video.title || "Video"}
          </span>
          <span className="relative max-w-full truncate text-[10px] text-white/70">
            {(() => {
              try {
                return new URL(slide.video.url).hostname;
              } catch {
                return slide.video.url;
              }
            })()}
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/media/${slide.originalKey}`}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      )}

      {/* index */}
      <span className="absolute left-1.5 top-1.5 z-10 grid size-5 place-items-center rounded-md bg-black/55 text-[11px] font-semibold text-white">
        {index + 1}
      </span>

      {/* actions */}
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="grid size-6 place-items-center rounded-md bg-black/55 text-white hover:bg-black/80"
          title="Duplicate slide"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="grid size-6 place-items-center rounded-md bg-black/55 text-white hover:bg-destructive"
          title="Delete slide"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* meta */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-[11px] text-white">
        <Clock className="size-3" />
        <span className={cn("tabular-nums", customDuration && "font-semibold")}>
          {slide.kind === "video" && slide.durationMs == null
            ? "Full video"
            : formatDuration(slide.durationMs ?? defaultDurationMs)}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {slide.kind === "text" && <Type className="size-3" />}
          {slide.kind === "video" && <Film className="size-3" />}
          {slide.caption && <MessageSquareText className="size-3" />}
          {slide.fit && <Crop className="size-3" />}
          {scheduled && <CalendarClock className="size-3" />}
          {scheduled && slide.repeat !== "none" && <Repeat className="size-3" />}
        </span>
      </div>
    </div>
  );
}

export function SlideGrid({
  slides,
  pending,
  defaultDurationMs,
  practiceLogoUrl,
  onReorder,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  slides: DraftSlide[];
  pending: PendingUpload[];
  defaultDurationMs: number;
  practiceLogoUrl: string | null;
  onReorder: (next: DraftSlide[]) => void;
  onEdit: (slide: DraftSlide) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((s) => s.id === active.id);
    const to = slides.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(slides, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={slides.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {slides.map((slide, i) => (
            <SlideTile
              key={slide.id}
              slide={slide}
              index={i}
              defaultDurationMs={defaultDurationMs}
              practiceLogoUrl={practiceLogoUrl}
              onEdit={() => onEdit(slide)}
              onDuplicate={() => onDuplicate(slide.id)}
              onDelete={() => onDelete(slide.id)}
            />
          ))}
          {pending.map((p) => (
            <div
              key={p.tempId}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/50 text-muted-foreground"
            >
              <Loader2 className="size-5 animate-spin" />
              <span className="max-w-full truncate px-2 text-[11px]">{p.name}</span>
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
