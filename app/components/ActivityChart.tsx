"use client";

import { useState } from "react";

export interface DayPoint {
  date: string; // YYYY-MM-DD
  sent: number;
  opened: number;
  replied: number;
}

/**
 * 14-day outreach activity line chart (inline SVG, no library).
 * Palette: categorical slots 1–3 (blue/aqua/yellow) in fixed order, validated
 * for CVD separation; sub-3:1 slots are relieved by direct labels + tooltip.
 */

const SERIES = [
  { key: "sent", label: "Sent", color: "#2a78d6" },
  { key: "opened", label: "Opened", color: "#1baf7a" },
  { key: "replied", label: "Replied", color: "#eda100" },
] as const;

const W = 720;
const H = 210;
const PAD = { top: 14, right: 96, bottom: 26, left: 36 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

function fmtDay(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function ActivityChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<{ i: number; px: number; cw: number } | null>(null);

  if (!data.length) return null;
  const empty = data.every((d) => d.sent === 0 && d.opened === 0 && d.replied === 0);
  if (empty) {
    return (
      <p className="text-sm text-zinc-400 py-10 text-center">
        No activity in the last 14 days — the chart fills in as campaigns send.
      </p>
    );
  }

  const yMax = Math.max(4, ...data.flatMap((d) => [d.sent, d.opened, d.replied]));
  const x = (i: number) => PAD.left + (data.length === 1 ? IW / 2 : (i * IW) / (data.length - 1));
  const y = (v: number) => PAD.top + IH - (v / yMax) * IH;
  const ticks = [0, Math.round(yMax / 2), yMax];

  const path = (key: (typeof SERIES)[number]["key"]) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  // Direct labels at line ends, nudged apart so they never overlap
  const endLabels = SERIES.map((s) => ({ ...s, ly: y(data[data.length - 1][s.key]) }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].ly - endLabels[i - 1].ly < 14) {
      endLabels[i].ly = endLabels[i - 1].ly + 14;
    }
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width / W;
    const sx = (e.clientX - rect.left) / scale;
    const i = Math.max(
      0,
      Math.min(data.length - 1, Math.round(((sx - PAD.left) / IW) * (data.length - 1)))
    );
    setHover({ i, px: x(i) * scale, cw: rect.width });
  }

  const hovered = hover ? data[hover.i] : null;

  return (
    <div className="relative">
      <div className="flex items-center gap-4 mb-2">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Outreach activity over the last 14 days: sent, opened, and replied per day`}
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
              stroke={t === 0 ? "#c3c2b7" : "#e9e8e2"}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={11}
              fill="#898781"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t}
            </text>
          </g>
        ))}

        {/* x labels every other day */}
        {data.map((d, i) =>
          i % 2 === 1 ? (
            <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#898781">
              {fmtDay(d.date)}
            </text>
          ) : null
        )}

        {/* crosshair */}
        {hover && (
          <line
            x1={x(hover.i)}
            x2={x(hover.i)}
            y1={PAD.top}
            y2={PAD.top + IH}
            stroke="#c3c2b7"
            strokeWidth={1}
          />
        )}

        {/* series lines */}
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        ))}

        {/* hover markers with surface ring */}
        {hover &&
          SERIES.map((s) => (
            <circle
              key={s.key}
              cx={x(hover.i)}
              cy={y(data[hover.i][s.key])}
              r={4}
              fill={s.color}
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}

        {/* direct labels at line ends (relief for sub-3:1 slots) */}
        {endLabels.map((s) => (
          <g key={s.key}>
            <circle cx={W - PAD.right + 10} cy={s.ly} r={3} fill={s.color} />
            <text x={W - PAD.right + 17} y={s.ly + 3.5} fontSize={11} fill="#52514e">
              {s.label}
            </text>
          </g>
        ))}
      </svg>

      {hovered && hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs"
          style={{
            left: Math.min(hover.px + 12, hover.cw - 130),
            top: 30,
          }}
        >
          <div className="font-medium text-zinc-700 mb-1">{fmtDay(hovered.date)}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-zinc-500">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              <span className="ml-auto pl-3 font-medium text-zinc-700 tabular-nums">
                {hovered[s.key]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
