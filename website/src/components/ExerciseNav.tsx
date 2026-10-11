import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./ExerciseNav.module.css";

export interface Exercise {
  url?: string;
  incomplete?: boolean;
  frontmatter: {
    title: string;
  };
}

interface ExerciseNavProps {
  prevExercise?: Exercise | null;
  nextExercise?: Exercise | null;
}

export default function ExerciseNav({
  prevExercise,
  nextExercise,
}: ExerciseNavProps) {
  return (
    <nav className={styles.exerciseNav} aria-label="تمرین قبلی و بعدی">
      {prevExercise && (
        <a
          href={prevExercise.url}
          className={`${styles.navLink} ${styles.prev}`}
        >
          <span className={styles.navArrow}>
            <ChevronRight aria-hidden="true" />
          </span>
          <div className={styles.navText}>
            <div className={styles.navLabel}>قبلی</div>
            <div className={styles.navTitle}>
              {prevExercise.frontmatter.title}
            </div>
          </div>
        </a>
      )}
      {nextExercise && !nextExercise.incomplete && (
        <a
          href={nextExercise.url}
          className={`${styles.navLink} ${styles.next}`}
        >
          <div className={styles.navText}>
            <div className={styles.navLabel}>بعدی</div>
            <div className={styles.navTitle}>
              {nextExercise.frontmatter.title}
            </div>
          </div>
          <span className={styles.navArrow}>
            <ChevronLeft aria-hidden="true" />
          </span>
        </a>
      )}
    </nav>
  );
}
