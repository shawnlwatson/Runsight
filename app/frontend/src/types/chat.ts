// Request and stream shapes for POST /insights/chat. Matches app/backend/app/models/chat.py.
export type ChatRole = "user" | "assistant";

export type ChatTurn = { role: ChatRole; content: string };

// The shared analysis filters, so the assistant sees the same runs as the charts.
export type ChatFilters = {
  start?: string; // YYYY-MM-DD
  end?: string;
  excludedRunIds?: readonly string[];
  minPace?: number; // decimal min/mile
  maxPace?: number;
  minDistance?: number; // miles
  maxDistance?: number;
  elevation?: string; // dropdown range label, e.g. "0–100"
  temperature?: string;
};

export type ChatRequest = { messages: ChatTurn[]; filters: ChatFilters };

// One line of the NDJSON response stream.
export type ChatEvent =
  | { type: "status"; message: string } // a tool is running
  | { type: "delta"; text: string } // more answer text
  | { type: "done" }
  | { type: "error"; message: string };
