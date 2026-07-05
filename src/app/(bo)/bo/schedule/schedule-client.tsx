"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { zhTW, enUS } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2, Truck, X } from "lucide-react";
import {
  createScheduleEntry, deleteScheduleEntry, findConflicts, moveScheduleEntry,
  type ScheduleConflict,
} from "@/lib/actions/schedule";
import { formatHours } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n/provider";
import type { Truck as TruckRow } from "@/lib/types";

export interface EntryRow {
  id: string;
  job_id: string;
  worker_id: string;
  truck_id: string | null;
  starts_at: string;
  ends_at: string;
  jobs: { code: string; description: string; needs_truck: boolean; customers: { name: string } | null } | null;
  workers: { name: string } | null;
  trucks: { name: string } | null;
}

export interface SchedulableJob {
  id: string;
  code: string;
  description: string;
  needs_truck: boolean;
  estimated_hours: number | null;
  customers: { name: string } | null;
}

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  workerId: string;
  truckName: string | null;
}

const DnDCalendar = withDragAndDrop<CalEvent>(Calendar<CalEvent>);

const WORKER_COLORS = [
  "#bae6fd", "#ddd6fe", "#fde68a", "#bbf7d0", "#fecdd3", "#e2e8f0",
];

/**
 * Google Calendar-style schedule board on react-big-calendar (MIT — spec
 * §13 explicitly rules out FullCalendar Premium). Drag blocks to
 * reschedule; workers and trucks are both bookable resources and conflicts
 * are surfaced for the BO to resolve manually.
 */
export function ScheduleClient({
  entries,
  workers,
  trucks,
  jobs,
  companyId,
}: {
  entries: EntryRow[];
  workers: { id: string; name: string }[];
  trucks: TruckRow[];
  jobs: SchedulableJob[];
  companyId: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<CalEvent | null>(null);

  const localizer = useMemo(
    () =>
      dateFnsLocalizer({
        format,
        parse,
        startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
        getDay,
        locales: { zh: zhTW, en: enUS },
      }),
    []
  );

  const colorByWorker = useMemo(() => {
    const map = new Map<string, string>();
    workers.forEach((w, i) => map.set(w.id, WORKER_COLORS[i % WORKER_COLORS.length]));
    return map;
  }, [workers]);

  const events: CalEvent[] = useMemo(
    () =>
      entries.map((e) => ({
        id: e.id,
        title: `${e.jobs?.customers?.name ?? ""} — ${e.jobs?.description?.slice(0, 20) ?? ""}${
          e.trucks ? `（${e.trucks.name}）` : ""
        }`,
        start: new Date(e.starts_at),
        end: new Date(e.ends_at),
        workerId: e.worker_id,
        truckName: e.trucks?.name ?? null,
      })),
    [entries]
  );

  async function onMove({ event, start, end }: EventInteractionArgs<CalEvent>) {
    await moveScheduleEntry({
      entryId: event.id,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("排程", "Schedule")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t(
              "依師傅與車輛安排每日工作 — 拖曳工作方塊即可調整時間",
              "Assign daily work by worker and truck — drag any block to reschedule"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView(Views.WEEK)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                view === Views.WEEK ? "bg-white shadow-sm text-slate-800" : "text-slate-500"
              }`}
            >
              {t("週檢視", "Week")}
            </button>
            <button
              onClick={() => setView(Views.MONTH)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                view === Views.MONTH ? "bg-white shadow-sm text-slate-800" : "text-slate-500"
              }`}
            >
              {t("月檢視", "Month")}
            </button>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() =>
                setDate((d) => {
                  const next = new Date(d);
                  next.setDate(d.getDate() + (view === Views.WEEK ? -7 : -30));
                  return next;
                })
              }
              className="p-1.5 hover:bg-slate-100 rounded-md"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-1">
              {lang === "en"
                ? format(date, "MMMM yyyy")
                : `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`}
            </span>
            <button
              onClick={() =>
                setDate((d) => {
                  const next = new Date(d);
                  next.setDate(d.getDate() + (view === Views.WEEK ? 7 : 30));
                  return next;
                })
              }
              className="p-1.5 hover:bg-slate-100 rounded-md"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800"
          >
            <Plus size={16} />
            {t("新增排程", "New Entry")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs flex-wrap">
        {workers.map((w) => (
          <span key={w.id} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ background: colorByWorker.get(w.id) }} />
            {w.name}
          </span>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-2" style={{ height: 640 }}>
        <DnDCalendar
          localizer={localizer}
          culture={lang}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          defaultView={Views.WEEK}
          views={[Views.WEEK, Views.MONTH]}
          min={new Date(1970, 0, 1, 7, 0)}
          max={new Date(1970, 0, 1, 20, 0)}
          onEventDrop={onMove}
          onEventResize={onMove}
          resizable
          onSelectEvent={(ev) => setSelected(ev)}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: colorByWorker.get(event.workerId) ?? "#e2e8f0",
              color: "#1e293b",
              border: "1px solid rgba(0,0,0,0.08)",
            },
          })}
        />
      </div>

      {showModal && (
        <NewEntryModal
          companyId={companyId}
          jobs={jobs}
          workers={workers}
          trucks={trucks}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}

      {selected && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-2">{selected.title}</h3>
            <p className="text-sm text-slate-500 mb-4">
              {selected.start.toLocaleString()} → {selected.end.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold"
              >
                {t("關閉", "Close")}
              </button>
              <button
                onClick={async () => {
                  await deleteScheduleEntry(selected.id);
                  setSelected(null);
                  router.refresh();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                {t("刪除此排程", "Delete entry")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * New Entry popup (spec §6): searchable job dropdown (Accepted+ only) →
 * worker → conditional truck (only if needs_truck, conflict-checked) →
 * estimated time auto-displayed read-only → date/time.
 */
function NewEntryModal({
  companyId,
  jobs,
  workers,
  trucks,
  onClose,
  onCreated,
}: {
  companyId: string;
  jobs: SchedulableJob[];
  workers: { id: string; name: string }[];
  trucks: TruckRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [jobSearch, setJobSearch] = useState("");
  const [jobId, setJobId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const job = jobs.find((j) => j.id === jobId) ?? null;
  const filteredJobs = jobs.filter((j) => {
    const q = jobSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      j.code.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q) ||
      (j.customers?.name ?? "").toLowerCase().includes(q)
    );
  });

  function window(): [string, string] {
    const durationH = job?.estimated_hours ?? 2;
    const start = new Date(`${day}T${time}:00`);
    const end = new Date(start.getTime() + durationH * 3600_000);
    return [start.toISOString(), end.toISOString()];
  }

  async function checkConflicts(nextWorkerId: string, nextTruckId: string) {
    if (!nextWorkerId || !day || !time) return setConflicts([]);
    const [startsAt, endsAt] = window();
    setConflicts(
      await findConflicts({
        companyId,
        workerId: nextWorkerId,
        truckId: nextTruckId || null,
        startsAt,
        endsAt,
      })
    );
  }

  async function submit() {
    if (!jobId || !workerId) {
      setError(t("請選擇案件與師傅", "Choose a job and a worker"));
      return;
    }
    if (job?.needs_truck && !truckId) {
      setError(t("此案件需要指派車輛", "This job needs a truck assigned"));
      return;
    }
    setBusy(true);
    setError(null);
    const [startsAt, endsAt] = window();
    const res = await createScheduleEntry({
      companyId,
      jobId,
      workerId,
      truckId: truckId || null,
      startsAt,
      endsAt,
    });
    if (res.error) {
      setError(
        res.error === "job_not_accepted"
          ? t("僅能排程已確認（報價已簽署）的案件", "Only accepted (quote-signed) jobs can be scheduled")
          : t("新增失敗", "Could not add the entry")
      );
      setBusy(false);
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Plus size={18} className="text-amber-500" />
            {t("新增排程", "New Schedule Entry")}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {t("選擇案件（僅顯示已確認的案件）", "Job (accepted jobs only)")}
            </label>
            <input
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              placeholder={t("搜尋案件編號、客戶、描述…", "Search job number, customer, description…")}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50"
            />
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              size={Math.min(4, Math.max(2, filteredJobs.length))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
            >
              {filteredJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} — {j.customers?.name}（{j.description.slice(0, 24)}）
                </option>
              ))}
              {filteredJobs.length === 0 && <option disabled>{t("無符合案件", "No matching jobs")}</option>}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {t("指派師傅", "Assign Worker")}
            </label>
            <select
              value={workerId}
              onChange={(e) => {
                setWorkerId(e.target.value);
                void checkConflicts(e.target.value, truckId);
              }}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-slate-50"
            >
              <option value="">{t("選擇師傅…", "Select a worker…")}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {job?.needs_truck && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                <Truck size={13} />
                {t("此案件需要車輛", "This job needs a truck")}
              </label>
              <select
                value={truckId}
                onChange={(e) => {
                  setTruckId(e.target.value);
                  void checkConflicts(workerId, e.target.value);
                }}
                className="mt-1 w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
              >
                <option value="">{t("選擇車輛…", "Select a truck…")}</option>
                {trucks.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t("日期", "Date")}
              </label>
              <input
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  void checkConflicts(workerId, truckId);
                }}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-slate-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t("時間", "Time")}
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  void checkConflicts(workerId, truckId);
                }}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-slate-50"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {t("預估工時（自動帶入，僅顯示）", "Estimated time (auto-filled, display only)")}
            </span>
            <span className="text-sm font-bold text-slate-700">
              {formatHours(job?.estimated_hours ?? null, lang)}
            </span>
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-600 space-y-1">
              {conflicts.map((c, i) => (
                <p key={i} className="flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  {c.kind === "worker"
                    ? t(
                        `師傅在此時段已有排程（${c.jobCode}）— 仍可建立，請自行確認`,
                        `Worker already booked in this window (${c.jobCode}) — you can still proceed`
                      )
                    : t(
                        `車輛在此時段已被使用（${c.jobCode}）— 仍可建立，請自行確認`,
                        `Truck already in use in this window (${c.jobCode}) — you can still proceed`
                      )}
                </p>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
          >
            {t("取消", "Cancel")}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? t("加入中…", "Adding…") : t("加入排程", "Add to Schedule")}
          </button>
        </div>
      </div>
    </div>
  );
}
