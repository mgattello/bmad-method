import Database from 'better-sqlite3';
import type { Todo } from '@todo/contract';

import type { TodoRepository } from './todo-repository.js';

interface TodoRow {
  id: string;
  description: string;
  completed: number;
  created_at: string;
}

// Opens the file, applies the durability pragmas and creates the schema idempotently (AD-5).
export function openDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.exec(
    'CREATE TABLE IF NOT EXISTS todos (' +
      'id TEXT PRIMARY KEY, ' +
      'description TEXT NOT NULL, ' +
      'completed INTEGER NOT NULL CHECK (completed IN (0, 1)), ' +
      'created_at TEXT NOT NULL)',
  );
  return db;
}

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    description: row.description,
    completed: row.completed === 1,
    createdAt: row.created_at,
  };
}

// SQL lives only here; prepared statements with bound parameters.
export class SqliteTodoRepository implements TodoRepository {
  private readonly db: Database.Database;
  private readonly listStmt: Database.Statement<[], TodoRow>;
  private readonly pingStmt: Database.Statement<[], unknown>;

  constructor(path: string) {
    this.db = openDatabase(path);
    this.listStmt = this.db.prepare<[], TodoRow>(
      this.scoped('SELECT id, description, completed, created_at FROM todos') +
        ' ORDER BY created_at DESC, rowid DESC',
    );
    this.pingStmt = this.db.prepare<[], unknown>('SELECT 1');
  }

  // Every todos query passes through here; the multi-user seam (AD-10).
  private scoped(sql: string): string {
    return sql; // later: append a WHERE owner_id = ? clause
  }

  list(): Todo[] {
    return this.listStmt.all().map(toTodo);
  }

  ping(): void {
    this.pingStmt.get();
  }

  close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }
}
