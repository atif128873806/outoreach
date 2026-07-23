"use client";

import { useState } from "react";

export interface DayPoint {
  date: string; // YYYY-MM-DD
  sent: number;
  opened: number;
  replied: number;
}

/**
 * 14-day outreach activity. Two things a user actually wants to know:
 *  1. the rates (headline KPI tiles) — you think in "open rate", not counts;
 *  2. the daily shape (chart) — sent as volume bars, opened/replied as thin
 *     lines on the SAME count axis (never a second scale).
 * Inline SVG, no chart library. Palette validated for CVD + ≥3:1 contrast.
 */

const SENT = "#2a78d6";
const OPENED = "#0e9f6e";
const REPLIED = "#d97706";

const W = 720;
const H = 190;
const PAD = { top: 12, right: 14, bottom: 24, left: 30 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

function fmtDay(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function Tile({
  label,
  value,
  sub,
  dot,
}: {
  label: string;
  value: string;
  sub: string;
  dot: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="text-xs text-zinc-400">{sub}</div>
    </div>
  );
}

export default function ActivityChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<{ i: number; px: number; cw: number } | null>(null);

  if (!data.length) return null;

  const totalSent = data.reduce((a, d) => a + d.sent, 0);
  const totalOpened = data.reduce((a, d) => a + d.opened, 0);
  const totalReplied = data.reduce((a, d) => a + d.replied, 0);
  const openRate = totalSent ? Math.round((totalOpened / totalSent) * 100) : 0;
  const replyRate = totalSent ? Math.round((totalReplied / totalSent) * 100) : 0;
  const perDay = totalSent ? (totalSent / data.length).toFixed(1) : "0";

  const empty = totalSent === 0 && totalOpened === 0 && totalReplied === 0;

  // KPI tiles always render — they read even when the chart is empty.
  const tiles = (
    <div className="grid grid-cols-3 gap-3">
      <Tile label="Sent" value={String(totalSent)} sub={`${perDay}/day avg`} dot={SENT} />
      <Tile
        label="Open rate"
        value={`${openRate}%`}
        sub={`${totalOpened} opened`}
        dot={OPENED}
      />
      <Tile
        label="Reply rate"
        value={`${replyRate}%`}
        sub={`${totalReplied} replied`}
        dot={REPLIED}
      />
    </div>
  );

  if (empty) {
    return (
      <div>
        {tiles}
        <p className="text-sm text-zinc-400 py-8 text-center">
          No activity in the last 14 days — this fills in as your campaigns send.
        </p>
      </div>
    );
  }

  const yMax = Math.max(4, ...data.flatMap((d) => [d.sent, d.opened, d.replied]));
  const n = data.length;
  const band = IW / n; // one slot per day
  const cx = (i: number) => PAD.left + band * (i + 0.5);
  const barW = Math.min(22, band * 0.6);
  const y = (v: number) => PAD.top + IH - (v / yMax) * IH;
  const ticks = [0, Math.round(yMax / 2), yMax];

  const line = (key: "opened" | "replied") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width / W;
    const sx = (e.clientX - rect.left) / scale;
    const i = Math.max(0, Math.min(n - 1, Math.floor((sx - PAD.left) / band)));
    setHover({ i, px: cx(i) * scale, cw: rect.width });
  }

  const hovered = hover ? data[hover.i] : null;

  return (
    <div>
      {tiles}

      <div className="relative mt-5">
        {/* legend */}
        <div className="mb-2 flex items-center gap-4">
          {[
            ["Sent", SENT],
            ["Opened", OPENED],
            ["Replied", REPLIED],
          ].map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Outreach activity over the last 14 days: emails sent, opened, and replied per day"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* gridlines + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "#d4d4d8" : "#f0efe9"}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 7}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={11}
                fill="#a1a1aa"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t}
              </text>
            </g>
          ))}

          {/* hover column highlight */}
          {hover && (
            <rect
              x={PAD.left + band * hover.i}
              y={PAD.top}
              width={band}
              height={IH}
              fill="#2a78d6"
              opacity={0.05}
            />
          )}

          {/* SENT — volume bars */}
          {data.map((d, i) => (
            <rect
              key={d.date}
              x={cx(i) - barW / 2}
              y={y(d.sent)}
              width={barW}
              height={Math.max(0, PAD.top + IH - y(d.sent))}
              rx={3}
              fill={SENT}
              opacity={hover && hover.i !== i ? 0.35 : 0.9}
            />
          ))}

          {/* OPENED / REPLIED — thin lines on the same axis */}
          <path d={line("opened")} fill="none" stroke={OPENED} strokeWidth={2} strokeLinejoin="round" />
          <path d={line("replied")} fill="none" stroke={REPLIED} strokeWidth={2} strokeLinejoin="round" />

          {/* markers so sparse data is visible */}
          {data.map((d, i) => (
            <g key={d.date}>
              <circle cx={cx(i)} cy={y(d.opened)} r={2.6} fill={OPENED} />
              <circle cx={cx(i)} cy={y(d.replied)} r={2.6} fill={REPLIED} />
            </g>
          ))}

          {/* hover markers with white ring */}
          {hover && (
            <g>
              <circle cx={cx(hover.i)} cy={y(data[hover.i].opened)} r={4} fill={OPENED} stroke="#fff" strokeWidth={2} />
              <circle cx={cx(hover.i)} cy={y(data[hover.i].replied)} r={4} fill={REPLIED} stroke="#fff" strokeWidth={2} />
            </g>
          )}

          {/* x labels every other day */}
          {data.map((d, i) =>
            i % 2 === 1 ? (
              <text key={d.date} x={cx(i)} y={H - 7} textAnchor="middle" fontSize={11} fill="#a1a1aa">
                {fmtDay(d.date)}
              </text>
            ) : null
          )}
        </svg>

        {hovered && hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{ left: Math.min(hover.px + 12, hover.cw - 140), top: 24 }}
          >
            <div className="mb-1 font-medium text-zinc-700">{fmtDay(hovered.date)}</div>
            {[
              ["Sent", hovered.sent, SENT],
              ["Opened", hovered.opened, OPENED],
              ["Replied", hovered.replied, REPLIED],
            ].map(([label, val, color]) => (
              <div key={label as string} className="flex items-center gap-1.5 text-zinc-500">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: color as string }} />
                {label}
                <span className="ml-auto pl-4 font-medium tabular-nums text-zinc-700">{val as number}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
