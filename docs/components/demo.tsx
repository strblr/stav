import { create } from "stav";
import { react } from "stav/react";

const store = react(
  create(
    {
      count: 0,
      history: [] as number[]
    },
    {
      increment: () => {
        store.set(state => ({
          count: state.count + 1,
          history: [...state.history, state.count + 1]
        }));
      },
      decrement: () => {
        store.set(state => ({
          count: state.count - 1,
          history: [...state.history, state.count - 1]
        }));
      },
      reset: () => {
        store.set({ count: 0, history: [0] });
      }
    }
  )
);

export function CounterDemo() {
  const count = store.use(state => state.count);
  const history = store.use(state => state.history);

  return (
    <div
      style={{
        padding: "1.5rem",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
        backgroundColor: "#f9fafb"
      }}
    >
      <h3 style={{ marginTop: 0 }}>Interactive Counter</h3>
      <div
        style={{
          fontSize: "3rem",
          fontWeight: "bold",
          margin: "1rem 0",
          color: count > 0 ? "#10b981" : count < 0 ? "#ef4444" : "#6b7280"
        }}
      >
        {count}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={store.increment}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
            border: "none",
            borderRadius: "0.25rem",
            backgroundColor: "#3b82f6",
            color: "white"
          }}
        >
          Increment
        </button>
        <button
          onClick={store.decrement}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
            border: "none",
            borderRadius: "0.25rem",
            backgroundColor: "#ef4444",
            color: "white"
          }}
        >
          Decrement
        </button>
        <button
          onClick={store.reset}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
            border: "1px solid #d1d5db",
            borderRadius: "0.25rem",
            backgroundColor: "white",
            color: "#374151"
          }}
        >
          Reset
        </button>
      </div>
      {history.length > 0 && (
        <div>
          <strong>History:</strong> {history.join(", ")}
        </div>
      )}
    </div>
  );
}
