import styles from './ErrorBanner.module.css';

type Props = {
  message: string | null;
  messageId?: string;
  action?: { label: string; onClick: () => void };
};

// The only live region in the app; always in the DOM and in flow (unstyled when empty).
export function ErrorBanner({ message, messageId, action }: Props) {
  return (
    <div role="status" className={message ? styles.banner : undefined}>
      {message ? (
        <>
          <p id={messageId} className={styles.message}>
            {message}
          </p>
          {action ? (
            <button type="button" className={styles.action} onClick={action.onClick}>
              {action.label}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
