"use client";

import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";


const dialogParser = parseAsStringEnum(["create", "edit", "delete"]);

export function useTopicsByCameraDialogState() {
  const [params, setParams] = useQueryStates({
    dialog: dialogParser,
    topicId: parseAsInteger,
  });

  const closeDialog = () => {
    setParams({ dialog: null, topicId: null });
  };

  const openCreate = () => {
    setParams({ dialog: "create", topicId: null });
  };

  const openEdit = (topicId: number) => {
    setParams({ dialog: "edit", topicId });
  };

  const openDelete = (topicId: number) => {
    setParams({ dialog: "delete", topicId });
  };

  return {
    dialog: params.dialog,
    topicId: params.topicId,
    closeDialog,
    openCreate,
    openEdit,
    openDelete,
    setParams,
  };
}
