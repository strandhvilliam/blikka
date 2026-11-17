export type SetupQuestion = "name" | "topics" | "order" | "time-limit" | "window";

export const isSetupQuestion = (step: string): step is SetupQuestion =>
  ["name", "topics", "order", "time-limit", "window"].includes(step);

export const setupQuestions = (answers: { topics: number; inSequence: boolean }): Array<SetupQuestion> => {
  const questions: Array<SetupQuestion> = ["name", "topics"];

  if (answers.topics > 1) {
    questions.push("order");

    if (answers.inSequence) {
      questions.push("time-limit");
    }
  }

  questions.push("window");

  return questions;
};
