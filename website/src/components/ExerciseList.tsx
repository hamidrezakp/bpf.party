import { useEffect, useState } from "react";
import type { ContentMetadata } from "../lib/exercises-metadata";
import styles from "./ExerciseList.module.css";
import { readStorage } from "../lib/storage";

interface ExerciseListProps {
  metadata: ContentMetadata;
}

export default function ExerciseList({ metadata }: ExerciseListProps) {
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const completed = new Set<string>();
    metadata.chapters.forEach((chapter) => {
      chapter.exercises.forEach((exercise) => {
        if (
          readStorage(`exercise-completed-${exercise.exerciseId}`) === "true"
        ) {
          completed.add(exercise.exerciseId);
        }
      });
    });
    setCompletedExercises(completed);
  }, [metadata]);

  return (
    <div className="chaptersList">
      {metadata.chapters.map((chapter) => (
        <section key={chapter.slug} className={styles.chapter}>
          <h2 className={styles.chapterHeader}>
            <span className={styles.chapterNumber}>
              فصل {chapter.number.toLocaleString("fa-IR")}:
            </span>{" "}
            {chapter.title}
          </h2>
          <div className={styles.chapterBox}>
            {chapter.exercises
              .filter((exercise) => !exercise.incomplete || import.meta.env.DEV)
              .map((exercise, index) => {
                const url = `/exercises/${chapter.slug}/${exercise.slug}/`;
                const isCompleted = completedExercises.has(exercise.exerciseId);
                const hexNum = `0x${index.toString(16).padStart(2, "0")}`;

                return (
                  <div key={exercise.slug}>
                    <a href={url} className={styles.exerciseRow}>
                      <span
                        className={styles.exerciseHex}
                        dir="ltr"
                        aria-hidden="true"
                      >
                        {hexNum}
                      </span>{" "}
                      <span
                        className={styles.exerciseCompletion}
                        aria-label={isCompleted ? "تکمیل‌شده" : undefined}
                      >
                        {isCompleted && <span aria-hidden="true">✓</span>}
                      </span>{" "}
                      <span className={styles.exerciseTitle}>
                        {exercise.title}
                      </span>
                    </a>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
