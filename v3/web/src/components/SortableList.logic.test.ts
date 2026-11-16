import { expect, test } from "bun:test";
import { movedItem, sortableList } from "./SortableList.logic.ts";

test("moving an item reports the new order with the imperative reason", () => {
  const changes: Array<[string[], string]> = [];

  const list = sortableList({
    id: "topics",
    defaultValue: ["a", "b", "c", "d"],
    onValueChange: (value, details) => changes.push([value, details.reason]),
  });

  list.api.move("a", 2);

  expect(list.get().value).toEqual(["b", "c", "a", "d"]);
  expect(changes).toEqual([[["b", "c", "a", "d"], "imperative"]]);
});

test("a controlled list keeps its value until the app passes the new one", () => {
  const list = sortableList({ id: "topics", value: ["a", "b", "c"] });

  list.api.move("c", 0);

  expect(list.get().value).toEqual(["a", "b", "c"]);
});

test("movedItem finds the item a drop moved and its position from 1", () => {
  expect(movedItem(["a", "b", "c", "d"], ["b", "c", "a", "d"])).toEqual({ key: "a", position: 3 });
  expect(movedItem(["a", "b", "c", "d"], ["a", "d", "b", "c"])).toEqual({ key: "d", position: 2 });
  expect(movedItem(["a", "b"], ["b", "a"])).toEqual({ key: "a", position: 2 });
  expect(movedItem(["a", "b", "c"], ["a", "b", "c"])).toBeNull();
});
