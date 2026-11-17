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

const slideItems = (list: HTMLElement) => {
  const doc = list.ownerDocument;
  const view = doc.defaultView;

  if (!view) {
    return;
  }

  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const items = () => [...list.querySelectorAll<HTMLElement>(":scope > *")];
  const dragged = () => list.querySelector<HTMLElement>(":scope > [data-dragging]");
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

export const movedItem = (before: readonly string[], after: readonly string[]) => {
  const first = after.findIndex((key, index) => key !== before[index]);

  if (first === -1) {
    return null;
  }

  const last = after.findLastIndex((key, index) => key !== before[index]);

  return before[first] === after[last]
    ? { key: after[last]!, position: last + 1 }
    : { key: after[first]!, position: first + 1 };
};
