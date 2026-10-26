import { emptyStateCopy } from '../copy.js';
import styles from './EmptyState.module.css';

export function EmptyState() {
  return <p className={styles.empty}>{emptyStateCopy}</p>;
}
