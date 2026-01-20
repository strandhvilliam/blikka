import { useEffect } from "react";

export function useHandleBeforeUnload() {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log("beforeunload", step);
      event.preventDefault();
      return "Are you sure you want to leave? All progress will be lost.";
    };

    const isOnIOS =
      navigator.userAgent.match(/iPad/i) ||
      navigator.userAgent.match(/iPhone/i);

    if (isOnIOS) {
      window.addEventListener("pagehide", handleBeforeUnload);
    } else {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      if (isOnIOS) {
        window.removeEventListener("pagehide", handleBeforeUnload);
      } else {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
    };
  }, []);
}