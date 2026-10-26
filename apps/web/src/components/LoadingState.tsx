import { loadingCopy } from '../copy.js';
import styles from './LoadingState.module.css';

const SKELETON_ROWS = [0, 1, 2];

// Skeleton only; no live region here (ErrorBanner owns the single role="status").
export function LoadingState() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className={styles.visuallyHidden}>{loadingCopy}</span>
      {SKELETON_ROWS.map((row) => (
        <div key={row} className={styles.row} aria-hidden="true" />
      ))}
    </div>
  );
}
