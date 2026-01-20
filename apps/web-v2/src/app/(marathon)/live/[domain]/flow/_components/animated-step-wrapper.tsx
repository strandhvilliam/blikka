"use client";
import { motion } from "motion/react";

export function AnimatedStepWrapper({
  children,
  direction,
}: {
  children: React.ReactNode;
  direction: number;
}) {
  const cardVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };
  return (
    <motion.div
      custom={direction}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        x: { type: "tween", stiffness: 300, damping: 20, duration: 0.2 },
        opacity: { duration: 0.2 },
      }}
    >
      {children}
    </motion.div>
  );
}
