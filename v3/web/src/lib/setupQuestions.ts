export type SetupQuestion = "name" | "topics" | "order" | "time-limit" | "window";

export const isSetupQuestion = (step: string): step is SetupQuestion =>
  ["name", "topics", "order", "time-limit", "window"].includes(step);

// The event setup's questions in order, each only when it applies (adr/0009): one topic has no
// order, and a time limit only goes with one topic at a time. Each answer is saved as it's given,
// so the answers here are the saved ones.
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
