import { useEffect } from "react";
import { writeStorage } from "../lib/storage";

interface MarkCompletedProps {
  exerciseId: string;
}

export default function MarkCompleted({ exerciseId }: MarkCompletedProps) {
  useEffect(() => {
    writeStorage(`exercise-completed-${exerciseId}`, "true");
  }, [exerciseId]);

  return null;
}
