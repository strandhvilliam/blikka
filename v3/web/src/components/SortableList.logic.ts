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

const easeOut = "cubic-bezier(0.23, 1, 0.32, 1)";

// Moves items to their new places from where they were on screen instead of letting them jump:
// the others as a dragged item passes them, and the dropped item from the pointer into its slot.
// Keyboard moves stay instant.
const slideItems = (list: HTMLElement) => {
  const doc = list.ownerDocument;
  const view = doc.defaultView;

  if (!view) {
    return;
  }

  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const items = () => [...list.querySelectorAll<HTMLElement>(":scope > *")];
  const dragged = () => list.querySelector<HTMLElement>(":scope > [data-dragging]");
  // Where each item sat in the layout after the last change, transforms aside.
  const tops = new Map<Element, number>();

  const remember = () => {
    tops.clear();

    for (const item of items()) {
      tops.set(item, item.offsetTop);
    }
  };

  const observer = new MutationObserver(() => {
    const moving = dragged();

    if (moving && !reduced.matches) {
      for (const item of items()) {
        const before = tops.get(item);

        if (before === undefined || item === moving) {
          continue;
        }

        // From where it shows now, partway through an earlier slide included.
        const shown = before + new DOMMatrixReadOnly(view.getComputedStyle(item).transform).m42;
        const from = shown - item.offsetTop;

        for (const animation of item.getAnimations()) {
          animation.cancel();
        }

        if (Math.abs(from) >= 1) {
          item.animate([{ transform: `translateY(${from}px)` }, { transform: "none" }], {
            duration: 200,
            easing: easeOut,
          });
        }
      }
    }

    remember();
  });

  // Before the drag ends and takes its copy away: the item glides from the copy into its slot.
  const settle = () => {
    const item = dragged();
    const preview = doc.querySelector<HTMLElement>("[data-drag-preview]");

    if (!item || !preview || reduced.matches) {
      return;
    }

    const from = preview.getBoundingClientRect();
    const to = item.getBoundingClientRect();
    const x = from.left + from.width / 2 - (to.left + to.width / 2);
    const y = from.top + from.height / 2 - (to.top + to.height / 2);
    const lifted = view.getComputedStyle(preview);

    item.setAttribute("data-settling", "");

    const animation = item.animate(
      [
        {
          transform: `translate(${x}px, ${y}px) scale(${lifted.scale === "none" ? 1 : lifted.scale})`,
          boxShadow: lifted.boxShadow,
        },
        { transform: "none", boxShadow: "none" },
      ],
      { duration: 220, easing: easeOut },
    );

    const done = () => item.removeAttribute("data-settling");

    animation.finished.then(done, done);
  };

  remember();
  observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-grabbed"] });
  view.addEventListener("pointerup", settle, true);

  return () => {
    observer.disconnect();
    view.removeEventListener("pointerup", settle, true);
  };
};

// A list whose items are reordered by dragging them, or by focusing the handle and pressing Space,
// the arrows, then Space again. A mouse drags an item from anywhere but its controls; touch drags
// by the handle only, so swiping the list still scrolls the page. Render the items in the root's
// `order`, which follows the drag, so the others move aside while an item is picked up.
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
      // A copy follows the pointer above the page, so the list's edges don't clip it and a long
      // list scrolls near them, while the item itself stays behind to show where it will land.
      preview: true,
    });

    return { reorder, move: (key: string, index: number) => reorder.move(key, index) };
  },
  slots: (slot) => ({
    root: slot({
      state: (state, { api }) => ({ order: api.reorder.order(state) }),
      bind: (el) => slideItems(el),
    }),
    item: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "data-grabbed": part.api.reorder.moving(state, part.key) ? "" : undefined,
        "data-dragging": part.api.reorder.dragging(state, part.key) ? "" : undefined,
      }),
      on: {
        pointerdown: (event, { el, api, key }) => {
          // Its controls keep their clicks, and an item without a handle can't be moved.
          if (
            event.pointerType !== "mouse" ||
            !(event.target instanceof Element) ||
            event.target.closest("button, input, a, [role='menuitem']") ||
            !el?.querySelector("[data-slot='sortable-list-handle']")
          ) {
            return;
          }

          api.reorder.pointerdown(event, key);
        },
      },
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
