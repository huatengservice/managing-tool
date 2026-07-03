"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, ChevronRight, Clock, Lock, Plus, RefreshCw, Share2, Truck as TruckIcon, X,
} from "lucide-react";
import { TagEditor } from "@/components/tag-editor";
import {
  addTruck, addWorkerWithInvite, regenerateInvite, revokeInvite,
  saveWorkerNotes, setTruckActive, setWorkerActive, updateWorkerRate,
} from "@/lib/actions/team";
import { formatPhone } from "@/lib/auth/phone";
import { useT } from "@/lib/i18n/provider";
import type { RateType, Truck, WorkerStatus } from "@/lib/types";

export interface WorkerRow {
  id: string;
  name: string;
  phone: string;
  status: WorkerStatus;
  hasPendingInvite: boolean;
  rateType: RateType;
  rate: number;
  tags: string[];
  log: string;
}

export function TeamClient({
  workers,
  trucks,
  companyId,
  maxWorkers,
}: {
  workers: WorkerRow[];
  trucks: Truck[];
  companyId: string;
  maxWorkers: number | null;
}) {
  const t = useT();
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [openWorkerId, setOpenWorkerId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newTruck, setNewTruck] = useState("");
  const activeCount = workers.filter((w) => w.status !== "inactive").length;
  const atLimit = maxWorkers !== null && activeCount >= maxWorkers;

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function resend(workerId: string) {
    const res = await regenerateInvite(workerId);
    if (res.inviteUrl) setInviteLink(res.inviteUrl);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("團隊管理", "Team")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("管理師傅名單、薪資與車輛（僅老闆可見）", "Manage the roster, rates and trucks (owner-only)")}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          disabled={atLimit}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50"
        >
          <Plus size={16} />
          {t("邀請師傅", "Invite Worker")}
        </button>
      </div>
      {atLimit && (
        <p className="text-xs text-amber-600 mb-3">
          {t(
            `目前方案最多 ${maxWorkers} 位師傅 — 升級方案以邀請更多`,
            `Your plan allows up to ${maxWorkers} workers — upgrade to invite more`
          )}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left font-semibold px-4 py-3">{t("姓名", "Name")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("電話", "Phone")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("薪資", "Rate")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("狀態", "Status")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("操作", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <WorkerRowView
                key={w.id}
                worker={w}
                companyId={companyId}
                open={openWorkerId === w.id}
                onToggle={() => setOpenWorkerId(openWorkerId === w.id ? null : w.id)}
                onResend={() => resend(w.id)}
              />
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-300 py-10">
                  {t("尚未邀請任何師傅", "No workers invited yet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
        <TruckIcon size={15} />
        {t("車輛", "Trucks")}
      </h3>
      <div className="grid sm:grid-cols-3 gap-3">
        {trucks.map((truck) => (
          <div key={truck.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{truck.name}</span>
            <button
              onClick={async () => {
                await setTruckActive(truck.id, !truck.active);
                router.refresh();
              }}
              className={`text-xs rounded-full px-2.5 py-1 ${
                truck.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
              }`}
            >
              {truck.active ? t("可調度", "In service") : t("停用", "Out of service")}
            </button>
          </div>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newTruck.trim()) return;
            await addTruck(companyId, newTruck);
            setNewTruck("");
            router.refresh();
          }}
          className="border-2 border-dashed border-slate-200 rounded-xl p-3 flex items-center gap-2"
        >
          <input
            value={newTruck}
            onChange={(e) => setNewTruck(e.target.value)}
            placeholder={t("新增車輛，例：一號車", "Add truck, e.g. Truck 1")}
            className="flex-1 text-sm outline-none bg-transparent"
          />
          <button className="text-xs font-semibold text-slate-500 hover:text-amber-600">
            <Plus size={16} />
          </button>
        </form>
      </div>

      {showInvite && (
        <InviteWorkerModal
          companyId={companyId}
          onClose={() => setShowInvite(false)}
          onInvited={() => router.refresh()}
        />
      )}

      {inviteLink && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
              <CheckCircle2 size={13} />
              {t("新的邀請連結已產生（舊連結立即失效）", "New invite link generated (the old one no longer works)")}
            </p>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
              <span className="flex-1 text-xs font-mono text-slate-600 truncate">{inviteLink}</span>
              <button onClick={() => copyLink(inviteLink)} className="text-xs font-semibold text-emerald-600 flex-shrink-0">
                {copied ? t("已複製 ✓", "Copied ✓") : t("複製", "Copy")}
              </button>
            </div>
            <button
              onClick={() => setInviteLink(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
            >
              {t("完成", "Done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkerRowView({
  worker,
  companyId,
  open,
  onToggle,
  onResend,
}: {
  worker: WorkerRow;
  companyId: string;
  open: boolean;
  onToggle: () => void;
  onResend: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [tags, setTags] = useState(worker.tags);
  const [log, setLog] = useState(worker.log);
  const [rate, setRate] = useState(worker.rate.toString());
  const [rateType, setRateType] = useState<RateType>(worker.rateType);
  const [saved, setSaved] = useState(false);

  async function persistNotes(nextTags: string[], nextLog: string) {
    await saveWorkerNotes({ workerId: worker.id, companyId, tags: nextTags, log: nextLog });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <tr className="border-t border-slate-100 cursor-pointer hover:bg-amber-50/30" onClick={onToggle}>
        <td className="px-4 py-3 font-semibold text-slate-800">
          <span className="flex items-center gap-1.5">
            <ChevronRight size={14} className={`text-slate-300 transition ${open ? "rotate-90" : ""}`} />
            {worker.name}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-600">{formatPhone(worker.phone)}</td>
        <td className="px-4 py-3 text-slate-600">
          NT${worker.rate.toLocaleString()} / {worker.rateType === "hourly" ? t("小時", "hr") : t("日", "day")}
        </td>
        <td className="px-4 py-3">
          {worker.status === "active" && (
            <span className="text-xs bg-emerald-50 text-emerald-600 rounded-full px-2 py-0.5">
              {t("在職", "Active")}
            </span>
          )}
          {worker.status === "inactive" && (
            <span className="text-xs bg-slate-100 text-slate-400 rounded-full px-2 py-0.5">
              {t("停用", "Inactive")}
            </span>
          )}
          {worker.status === "invited" && (
            <span className="text-xs bg-amber-50 text-amber-600 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
              <Clock size={10} />
              {worker.hasPendingInvite
                ? t("已邀請，尚未接受", "Invited, not yet accepted")
                : t("邀請已撤銷／過期", "Invite revoked/expired")}
            </span>
          )}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {worker.status === "invited" ? (
            <span className="flex items-center gap-3">
              <button onClick={onResend} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                <RefreshCw size={11} />
                {t("重新產生連結", "Regenerate link")}
              </button>
              {worker.hasPendingInvite && (
                <button
                  onClick={async () => {
                    await revokeInvite(worker.id);
                    router.refresh();
                  }}
                  className="text-xs text-slate-400 hover:text-rose-500"
                >
                  {t("撤銷", "Revoke")}
                </button>
              )}
            </span>
          ) : (
            <button
              onClick={async () => {
                await setWorkerActive(worker.id, worker.status !== "active");
                router.refresh();
              }}
              className="text-xs text-slate-400 hover:text-rose-500"
            >
              {worker.status === "active" ? t("停用", "Deactivate") : t("重新啟用", "Reactivate")}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-slate-50/60 border-t border-slate-100 px-4 py-4">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                {/* Private layer #2: BO's notes about this worker (spec §7) */}
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                  <Lock size={11} />
                  {t(
                    "私人備註（僅老闆可見，師傅本人不會看到）",
                    "Private notes (owner-only — the worker never sees this)"
                  )}
                  {saved && <span className="text-emerald-600">✓</span>}
                </p>
                <div className="mb-3">
                  <TagEditor
                    tags={tags}
                    color="sky"
                    onChange={(next) => {
                      setTags(next);
                      void persistNotes(next, log);
                    }}
                  />
                </div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t("紀錄事項（例：客訴、表現、需要注意的細節）", "Log (e.g. complaints, strengths, things to watch)")}
                </label>
                <textarea
                  rows={3}
                  value={log}
                  onChange={(e) => setLog(e.target.value)}
                  onBlur={() => persistNotes(tags, log)}
                  placeholder={t(
                    "輸入這位師傅過去發生的狀況，供未來排班或評估參考…",
                    "Notes about this worker to inform future staffing decisions…"
                  )}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  {t("薪資（用於成本試算，師傅端不會顯示）", "Rate (for cost analysis — never shown to the worker)")}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                    {(["hourly", "daily"] as const).map((rt) => (
                      <button
                        key={rt}
                        onClick={() => setRateType(rt)}
                        className={`text-xs px-3 py-1.5 rounded-md font-semibold ${
                          rateType === rt ? "bg-amber-50 text-amber-700" : "text-slate-400"
                        }`}
                      >
                        {rt === "hourly" ? t("時薪", "Hourly") : t("日薪", "Daily")}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  <button
                    onClick={async () => {
                      await updateWorkerRate({
                        workerId: worker.id,
                        companyId,
                        rateType,
                        rate: Number(rate) || 0,
                      });
                      router.refresh();
                    }}
                    className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50"
                  >
                    {t("儲存", "Save")}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function InviteWorkerModal({
  companyId,
  onClose,
  onInvited,
}: {
  companyId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({ name: "", phone: "", rateType: "hourly" as RateType, rate: "" });
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await addWorkerWithInvite({
      companyId,
      name: form.name,
      phone: form.phone,
      rateType: form.rateType,
      rate: Number(form.rate) || 0,
    });
    if (res.error || !res.inviteUrl) {
      setError(t("建立失敗，請確認姓名與手機號碼", "Could not create — check the name and phone number"));
      setBusy(false);
      return;
    }
    setLink(res.inviteUrl);
    onInvited();
    setBusy(false);
  }

  async function share() {
    if (!link) return;
    if (navigator.share) await navigator.share({ url: link }).catch(() => {});
    else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">{t("邀請師傅", "Invite Worker")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {!link ? (
          <form onSubmit={submit}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">{t("姓名", "Name")}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">{t("手機號碼", "Phone Number")}</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  inputMode="tel"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">{t("計薪方式", "Rate Type")}</label>
                <div className="flex gap-2 mt-1">
                  {(["hourly", "daily"] as const).map((rt) => (
                    <button
                      type="button"
                      key={rt}
                      onClick={() => setForm((f) => ({ ...f, rateType: rt }))}
                      className={`flex-1 text-sm py-2 rounded-lg border ${
                        form.rateType === rt
                          ? "border-amber-400 bg-amber-50 font-semibold"
                          : "border-slate-200 text-slate-500"
                      }`}
                    >
                      {rt === "hourly" ? t("時薪", "Hourly") : t("日薪", "Daily")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">
                  {form.rateType === "hourly" ? t("時薪金額", "Hourly Rate") : t("日薪金額", "Daily Rate")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  placeholder="NT$"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {t(
                  "此薪資資訊僅供老闆內部成本試算使用，師傅端不會顯示。",
                  "Rate is used only for the owner's internal cost analysis and is never shown to the worker."
                )}
              </p>
            </div>
            {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold"
              >
                {t("取消", "Cancel")}
              </button>
              <button
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
              >
                {busy ? t("產生中…", "Generating…") : t("產生邀請連結", "Generate Invite Link")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                <CheckCircle2 size={13} />
                {t(
                  "邀請連結已產生 — 已加入名單，狀態為「已邀請」",
                  "Invite link generated — added to the roster as Invited"
                )}
              </p>
              <p className="text-[11px] text-emerald-600 mb-3">
                {t(
                  "請親自透過 LINE、簡訊或當面告知的方式，將此連結傳送給對方。此連結僅能使用一次，7 天內有效。",
                  "Send this link personally via LINE, SMS, or in person. It works once and expires in 7 days."
                )}
              </p>
              <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <span className="flex-1 text-xs font-mono text-slate-600 truncate">{link}</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  }}
                  className="text-xs font-semibold text-emerald-600 flex-shrink-0"
                >
                  {copied ? t("已複製 ✓", "Copied ✓") : t("複製", "Copy")}
                </button>
              </div>
              <button
                onClick={share}
                className="w-full mt-2 text-xs border border-emerald-300 text-emerald-700 rounded-lg py-2 flex items-center justify-center gap-1.5 bg-white"
              >
                <Share2 size={12} />
                {t("透過分享功能傳送", "Send via share sheet")}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
            >
              {t("完成", "Done")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
