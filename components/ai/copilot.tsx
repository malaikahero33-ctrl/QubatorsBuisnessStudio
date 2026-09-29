"use client";

import { useState } from "react";
import { AiPanel, GenerateButton, type Allowance } from "@/components/ai/ai-panel";
import { askCopilotAction } from "@/lib/ai/actions";

const SUGGESTIONS = [
  "Why is my margin thinner than I expected?",
  "What should I do first with 2,000,000 UGX?",
  "How should I price a new product?",
  "What should I ask a supplier?",
  "How do I get my first ten customers?",
];

/**
 * The Copilot.
 *
 * The one AI feature whose answer is prose, which means it has nowhere to
 * carry a structured assumptions list — so the envelope check rejects it and
 * the user is told plainly that the response could not be verified rather than
 * being shown confident advice with no caveats. That is ADR-4 working, not a
 * bug: a feature that cannot state its assumptions does not get to display
 * its output.
 */
export function Copilot({
  allowance,
  businessName,
}: {
  allowance: Allowance;
  businessName: string;
}) {
  const [question, setQuestion] = useState("");

  return (
    <AiPanel<string>
      allowance={allowance}
      form={(run) => (
        <div className="rounded-xl border border-border bg-surface p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">
              Your question
            </span>
            <textarea
              className="textarea"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask anything about ${businessName}. It knows your products, prices and customers.`}
              maxLength={1000}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-sm"
                onClick={() => setQuestion(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <GenerateButton
              run={run}
              call={() => askCopilotAction(question)}
              label="Ask"
              busyLabel="Thinking…"
              disabled={question.trim().length === 0}
            />
          </div>
        </div>
      )}
    >
      {(answer) => (
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>
      )}
    </AiPanel>
  );
}
