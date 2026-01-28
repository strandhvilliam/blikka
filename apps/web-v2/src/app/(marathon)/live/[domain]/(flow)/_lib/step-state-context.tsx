"use client"
import { createContext, useContext, useState } from "react";
import {
  parseAsInteger,
  useQueryState } from "nuqs";
import { PARTICIPANT_SUBMISSION_STEPS } from "./constants";


const StepStateContext = createContext({
  step: 1,
  direction: 0,
  handleNextStep: () => { },
  handlePrevStep: () => { },
  handleSetStep: (step: number) => { },
});

export function useStepState() {
  const context = useContext(StepStateContext);
  if (!context) {
    throw new Error("useStepState must be used within a StepStateProvider");
  }
  return context;
}


export function StepStateProvider({ children }: { children: React.ReactNode }) {

  const [step, setStep] = useQueryState(
    "s",
    parseAsInteger.withDefault(1).withOptions({ history: "push" }),
  );
  const [direction, setDirection] = useState(0);

  const handleNextStep = () => {
    const nextStep = Math.min(
      step + 1,
      Object.keys(PARTICIPANT_SUBMISSION_STEPS).length,
    );
    setDirection(1);
    setStep(nextStep);
  };

  const handlePrevStep = () => {
    const prevStep = Math.max(step - 1, 1);
    setDirection(-1);
    setStep(prevStep);
  };
  const handleSetStep = (newStep: number) => {
    setDirection(newStep > step ? 1 : -1);
    setStep(newStep);
  };

  return (
    <StepStateContext.Provider value={{ step, direction, handleNextStep, handlePrevStep, handleSetStep }
    }>
      {children}
    </StepStateContext.Provider>
  );
} 