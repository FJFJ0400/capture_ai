"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { TodoItemDTO } from "@capture-ai/shared";

export default function TodosPage() {
  const [items, setItems] = useState<TodoItemDTO[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadTodos = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ data: TodoItemDTO[] }>("/v1/todos");
      setItems(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodos();
  }, []);

  const addTodo = async () => {
    if (!title.trim()) return;
    try {
      await apiFetch("/v1/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      setTitle("");
      await loadTodos();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleTodo = async (item: TodoItemDTO) => {
    setActionId(item.id);
    setError(null);
    try {
      await apiFetch(`/v1/todos/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !item.done })
      });
      await loadTodos();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const deleteTodo = async (id: string) => {
    if (!window.confirm("이 TODO를 삭제할까요?")) return;
    setActionId(id);
    setError(null);
    try {
      await apiFetch(`/v1/todos/${id}`, { method: "DELETE" });
      await loadTodos();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="card">
      <h2>Todo 리스트</h2>
      {error && <p>{error}</p>}
      <div className="panel-grid">
        <input
          className="input"
          placeholder="새로운 Todo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="button" onClick={addTodo} disabled={loading}>
          추가
        </button>
      </div>
      <div className="list">
        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          items.map((item) => (
            <div className="todo-item" key={item.id}>
              <label className={`todo-title ${item.done ? "done" : ""}`}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleTodo(item)}
                  disabled={actionId === item.id}
                />
                <div>
                  <strong>{item.title}</strong>
                  <p className="eyebrow">{formatDateTime(item.createdAt)}</p>
                </div>
              </label>
              <div className="todo-actions">
                <button
                  className="button secondary"
                  onClick={() => deleteTodo(item.id)}
                  disabled={actionId === item.id}
                >
                  삭제
                </button>
                <span className="status-badge">{item.done ? "DONE" : "OPEN"}</span>
              </div>
            </div>
          ))
        )}
        {!items.length && !loading && <p>등록된 TODO가 없습니다.</p>}
      </div>
    </section>
  );
}
