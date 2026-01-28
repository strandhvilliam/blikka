"use client"
import { createContext, useContext, useState } from "react";
import {
  parseAsInteger,
  useQueryState } from "nuqs";
import { PARTICIPANT_SUBMISSION_STEPS, BY_CAMERA_STEPS, type FlowMode } from "./constants";


interface StepStateContextValue {
  step: number;
  direction: number;
  maxSteps: number;
  flowMode: FlowMode;
  handleNextStep: () => void;
  handlePrevStep: () => void;
  handleSetStep: (step: number) => void;
}

const StepStateContext = createContext<StepStateContextValue>({
  step: 1,
  direction: 0,
  maxSteps: Object.keys(PARTICIPANT_SUBMISSION_STEPS).length,
  flowMode: "marathon",
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

interface StepStateProviderProps {
  children: React.ReactNode;
  flowMode?: FlowMode;
}

export function StepStateProvider({ children, flowMode = "marathon" }: StepStateProviderProps) {
  const steps = flowMode === "by-camera" ? BY_CAMERA_STEPS : PARTICIPANT_SUBMISSION_STEPS;
  const maxSteps = Object.keys(steps).length;

  const [step, setStep] = useQueryState(
    "s",
    parseAsInteger.withDefault(1).withOptions({ history: "push" }),
  );
  const [direction, setDirection] = useState(0);

  const handleNextStep = () => {
    const nextStep = Math.min(step + 1, maxSteps);
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
    <StepStateContext.Provider value={{ step, direction, maxSteps, flowMode, handleNextStep, handlePrevStep, handleSetStep }
    }>
      {children}
    </StepStateContext.Provider>
  );
} 