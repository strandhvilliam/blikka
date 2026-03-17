"use client";

import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

const dialogParser = parseAsStringEnum([
  "create",
  "edit",
  "delete",
  "submission-window",
]);

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

  const openSubmissionWindow = (topicId: number) => {
    setParams({ dialog: "submission-window", topicId });
  };

  return {
    dialog: params.dialog,
    topicId: params.topicId,
    closeDialog,
    openCreate,
    openEdit,
    openDelete,
    openSubmissionWindow,
    setParams,
  };
}
