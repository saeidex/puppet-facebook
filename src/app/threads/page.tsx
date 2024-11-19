"use client";

import { useEffect, useState } from "react";

type LogEntry = {
  message: string;
  timestamp: string;
  type: "info" | "error" | "success";
};

export default function ThreadsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [config, setConfig] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Retrieve configuration from localStorage
    const savedConfig = localStorage.getItem("automationConfig");
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }

    // Set up WebSocket or Server-Sent Events connection here
    // For now, we'll simulate some logs
    const mockLogs = [
      {
        message: "Success",
        timestamp: new Date().toISOString(),
        type: "success" as const,
      },
    ];

    setLogs(mockLogs);
  }, [config?.threads]);

  return (
    <div className="mx-auto mt-10 max-w-4xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Logs</h1>

      {config && (
        <div className="mb-6 rounded-lg bg-gray-100 p-4">
          <h2 className="mb-2 text-xl font-semibold">Configuration</h2>
          <p>Threads: {config.threads}</p>
          <p>Fast Mode: {config.fastMode ? "Enabled" : "Disabled"}</p>
          <p>Started: {new Date(config.startTime).toLocaleString()}</p>
        </div>
      )}

      <div className="space-y-2">
        {logs.map((log, index) => (
          <div
            key={index}
            className={`rounded-lg p-3 ${
              log.type === "error"
                ? "bg-red-100 text-red-800"
                : log.type === "success"
                  ? "bg-green-100 text-green-800"
                  : "bg-blue-100 text-blue-800"
            }`}
          >
            <span className="text-sm opacity-75">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="ml-2">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
