import { createParts } from "@ui-sdk/react/primitive";
import { sortableList } from "./SortableList.logic.ts";

export const {
  Root: SortableList,
  Item: SortableListItem,
  Handle: SortableListHandle,
} = createParts(sortableList, { root: "ul", item: "li", handle: "button" });
