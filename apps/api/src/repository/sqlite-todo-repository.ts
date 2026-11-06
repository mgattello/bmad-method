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
  private readonly findStmt: Database.Statement<[string], TodoRow>;
  private readonly insertStmt: Database.Statement<[string, string, 0 | 1, string], unknown>;
  private readonly updateStmt: Database.Statement<[string, 0 | 1, string], unknown>;
  private readonly deleteStmt: Database.Statement<[string], unknown>;
  private readonly pingStmt: Database.Statement<[], unknown>;

  constructor(path: string) {
    this.db = openDatabase(path);
    this.listStmt = this.db.prepare<[], TodoRow>(
      this.scoped('SELECT id, description, completed, created_at FROM todos') +
        ' ORDER BY created_at DESC, rowid DESC',
    );
    this.findStmt = this.db.prepare<[string], TodoRow>(
      this.scoped('SELECT id, description, completed, created_at FROM todos') + ' WHERE id = ?',
    );
    // Owner becomes a bound column here when it arrives (AD-10).
    this.insertStmt = this.db.prepare<[string, string, 0 | 1, string], unknown>(
      'INSERT INTO todos (id, description, completed, created_at) VALUES (?, ?, ?, ?)',
    );
    this.updateStmt = this.db.prepare<[string, 0 | 1, string], unknown>(
      'UPDATE todos SET description = ?, completed = ? WHERE id = ?',
    );
    this.deleteStmt = this.db.prepare<[string], unknown>('DELETE FROM todos WHERE id = ?');
    this.pingStmt = this.db.prepare<[], unknown>('SELECT 1');
  }

  // Every todos read passes through here (AD-10); writes bind the owner as a column on their statement.
  private scoped(sql: string): string {
    return sql; // later: append a WHERE owner_id = ? clause
  }

  list(): Todo[] {
    return this.listStmt.all().map(toTodo);
  }

  findById(id: string): Todo | undefined {
    const row = this.findStmt.get(id);
    return row ? toTodo(row) : undefined;
  }

  // run() is synchronous and synchronous=FULL, so the row is on disk when this returns (AD-5).
  insert(todo: Todo): void {
    this.insertStmt.run(todo.id, todo.description, todo.completed ? 1 : 0, todo.createdAt);
  }

  // Same durability as insert: committed before this returns (AD-5).
  update(todo: Todo): void {
    this.updateStmt.run(todo.description, todo.completed ? 1 : 0, todo.id);
  }

  // Committed before this returns, like insert and update (AD-5).
  remove(id: string): void {
    this.deleteStmt.run(id);
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
