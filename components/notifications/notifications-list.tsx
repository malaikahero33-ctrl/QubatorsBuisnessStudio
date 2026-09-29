"use client";

import { useTransition } from "react";
import {
  markNotificationsReadAction,
  deleteNotificationAction,
} from "@/lib/notifications/actions";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

const TONE: Record<string, string> = {
  new_order: "pill-brand",
  consultation: "pill-info",
  weekly_digest: "pill-info",
  info: "",
};

function when(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function NotificationsList({ rows }: { rows: NotificationRow[] }) {
  const [pending, startTransition] = useTransition();
  const unread = rows.filter((r) => !r.read_at).length;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <h2 className="text-sm font-bold">Nothing to report</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          New orders and consultation requests appear here. You choose what you get
          told about in Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {unread > 0 ? `${unread} unread of ${rows.length}` : `${rows.length}, all read`}
        </p>

        {unread > 0 && (
          <form
            action={(fd) =>
              startTransition(async () => {
                await markNotificationsReadAction(fd);
              })
            }
          >
            <button className="btn btn-sm" disabled={pending}>
              Mark all as read
            </button>
          </form>
        )}
      </div>

      <ul className="rounded-xl border border-border bg-surface">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border px-5 py-4 last:border-0 ${
              row.read_at ? "opacity-60" : ""
            }`}
          >
            {!row.read_at && (
              <span
                className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand"
                aria-label="Unread"
              />
            )}
            {row.read_at && <span className="mt-2 h-2 w-2 shrink-0" aria-hidden />}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.title}</span>
                <span className={`pill ${TONE[row.type] ?? ""}`}>{row.type.replace("_", " ")}</span>
              </div>
              {row.body && <p className="mt-1 text-sm text-muted">{row.body}</p>}
              <p className="mt-1 text-xs text-muted">{when(row.created_at)}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {row.href && (
                <a className="btn btn-sm" href={row.href}>
                  Open
                </a>
              )}

              {!row.read_at && (
                <form
                  action={(fd) =>
                    startTransition(async () => {
                      fd.set("id", row.id);
                      await markNotificationsReadAction(fd);
                    })
                  }
                >
                  <button className="btn btn-sm" disabled={pending}>
                    Mark read
                  </button>
                </form>
              )}

              <form
                action={(fd) =>
                  startTransition(async () => {
                    fd.set("id", row.id);
                    await deleteNotificationAction(fd);
                  })
                }
              >
                <button className="btn btn-sm" disabled={pending}>
                  Dismiss
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
