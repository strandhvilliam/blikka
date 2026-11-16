import {
  createChange,
  createReorder,
  definePrimitive,
  type ChangeDetails,
  type ReorderDraft,
  type ReorderReason,
} from "@ui-sdk/core";

export type SortableListOptions = {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[], details: ChangeDetails<ReorderReason>) => void;
};

const notMoving: ReorderDraft | null = null;

// A list whose items are reordered by dragging their handle, or by focusing it and pressing Space,
// the arrows, then Space again. Items with controls of their own drag by the handle only.
export const sortableList = definePrimitive({
  name: "sortable-list",
  options: { value: "list", defaultValue: "list", onValueChange: "callback" },
  controlled: ["value"],
  state: (options: SortableListOptions) => ({
    value: options.value ?? options.defaultValue ?? [],
    moving: notMoving,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context);

    const reorder = createReorder(context, {
      slot: "item",
      key: "value",
      draft: "moving",
      set: (value, details) => change("value", value, details),
    });

    return { reorder, move: (key: string, index: number) => reorder.move(key, index) };
  },
  slots: (slot) => ({
    root: slot({}),
    item: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "data-grabbed": part.api.reorder.moving(state, part.key) ? "" : undefined,
        "data-dragging": part.api.reorder.dragging(state, part.key) ? "" : undefined,
      }),
      bind: (el, part) => part.api.reorder.bind(el, part),
    }),
    handle: slot<{ value: string }>({
      props: { value: { kind: "string", from: "item", required: true } },
      attrs: (state, part) => ({
        type: "button",
        "aria-description": "Press Space to pick it up, the arrow keys to move it, and Space to drop it.",
        "data-grabbed": part.api.reorder.moving(state, part.key) ? "" : undefined,
      }),
      on: {
        keydown: (event, { api, key }) => {
          api.reorder.keydown(event, key);
        },
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event, key),
      },
    }),
  }),
  agent: { actions: ["move"] },
});

// The one item a drop moved, and where it landed, from 1. Null when nothing moved.
export const movedItem = (before: readonly string[], after: readonly string[]) => {
  const first = after.findIndex((key, index) => key !== before[index]);

  if (first === -1) {
    return null;
  }

  const last = after.findLastIndex((key, index) => key !== before[index]);

  // Moving down leaves the item at the end of the changed stretch; moving up, at its start.
  return before[first] === after[last]
    ? { key: after[last]!, position: last + 1 }
    : { key: after[first]!, position: first + 1 };
};
