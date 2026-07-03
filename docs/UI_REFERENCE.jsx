import React, { useState, useRef, createContext, useContext } from "react";
import {
  LayoutGrid, Calendar, Briefcase, Users, Truck, Search, Plus, X,
  CheckCircle2, Circle, Clock, Phone, MapPin, Camera, FileText,
  DollarSign, Share2, ChevronRight, ChevronLeft, Lock, QrCode,
  LogIn, PenTool, AlertTriangle, ArrowLeft, Tag, Download,
  Package, TrendingUp, TrendingDown, Wallet, UserCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ---------- i18n ----------
// Note: this translates the app's own interface (nav, buttons, labels, headers).
// It does NOT translate business data (customer names, addresses, job descriptions,
// supplier names) — that content is entered by Taiwan users about Taiwan customers
// and stays in the language it was actually entered in, same as any real system.
const LangContext = createContext("zh");
function useT() {
  const lang = useContext(LangContext);
  return (zh, en) => (lang === "en" ? en : zh);
}

// ---------- Mock data ----------
const WORKERS = [
  { id: "w1", name: "陳師傅", phone: "0912-345-678", status: "active", rateType: "hourly", rate: 350 },
  { id: "w2", name: "林師傅", phone: "0922-111-222", status: "active", rateType: "daily", rate: 2800 },
  { id: "w3", name: "黃師傅", phone: "0933-888-999", status: "inactive", rateType: "hourly", rate: 320 },
  { id: "w4", name: "許師傅", phone: "0955-222-333", status: "invited", rateType: "hourly", rate: 340 },
];

const MATERIALS = [
  { id: "m1", date: "2026-07-01", supplier: "永發水電材料行", item: "PVC 水管 1吋", qty: 10, unitPrice: 85, job: "J-1040" },
  { id: "m2", date: "2026-07-01", supplier: "永發水電材料行", item: "止水閥", qty: 2, unitPrice: 220, job: "J-1040" },
  { id: "m3", date: "2026-07-02", supplier: "全成電料行", item: "電源線 2.0mm", qty: 50, unitPrice: 28, job: "J-1041" },
  { id: "m4", date: "2026-07-02", supplier: "全成電料行", item: "無熔絲開關", qty: 6, unitPrice: 95, job: "J-1041" },
  { id: "m5", date: "2026-07-03", supplier: "永發水電材料行", item: "水龍頭零件組", qty: 1, unitPrice: 350, job: "J-1042" },
];

const TRUCKS = [
  { id: "t1", name: "一號車", status: "可用" },
  { id: "t2", name: "二號車", status: "使用中" },
];

const STAGES = ["已建立", "已報價", "已確認", "進行中", "已完工", "已請款", "已付款"];
const STAGES_EN = ["Created", "Quoted", "Accepted", "In Progress", "Work Done", "Invoiced", "Paid"];

// Note: laborCost/materialCost below are illustrative pre-computed values for this mockup.
// In the real build these derive from worker rate × actual_working_time (as structured hours,
// not free text) plus the linked materials log entries — see conversation notes on this.
const JOBS = [
  { id: "J-1042", customer: "王小姐", phone: "0955-123-456", address: "台北市大安區忠孝東路四段1號", category: "水電", desc: "浴室水龍頭漏水，需更換零件", urgency: "一般", needsTruck: false, est: "2 小時", actual: null, stage: 3, worker: "陳師傅", total: 1800, laborCost: 700, materialCost: 350 },
  { id: "J-1041", customer: "陳先生", phone: "0966-234-567", address: "台北市信義區松仁路5號", category: "電力", desc: "全室插座重新配線，含跳電問題排查", urgency: "緊急", needsTruck: true, est: "1.5 天", actual: null, stage: 2, worker: "林師傅", total: 24500, laborCost: 4200, materialCost: 1970 },
  { id: "J-1040", customer: "李太太", phone: "0977-345-678", address: "新北市板橋區文化路一段10號", category: "水電", desc: "廚房水管更新", urgency: "一般", needsTruck: true, est: "1 天", actual: "1.5 天", stage: 6, worker: "陳師傅", total: 15000, laborCost: 4200, materialCost: 1290 },
  { id: "J-1039", customer: "張先生", phone: "0988-456-789", address: "台北市中山區南京東路二段20號", category: "電力", desc: "新增電燈迴路", urgency: "一般", needsTruck: false, est: "3 小時", actual: null, stage: 1, worker: null, total: 3200, laborCost: 1050, materialCost: 0 },
  { id: "J-1038", customer: "許小姐", phone: "0912-987-654", address: "台北市大同區重慶北路三段8號", category: "水電", desc: "熱水器安裝", urgency: "緊急", needsTruck: true, est: "4 小時", actual: "4 小時", stage: 5, worker: "林師傅", total: 8500, laborCost: 1400, materialCost: 890 },
];

const STAGE_COLOR = [
  "bg-slate-100 text-slate-600 border-slate-200",
  "bg-sky-50 text-sky-700 border-sky-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-slate-800 text-white border-slate-800",
];

function StageBadge({ stage }) {
  const lang = useContext(LangContext);
  const labels = lang === "en" ? STAGES_EN : STAGES;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STAGE_COLOR[stage]}`}>
      {labels[stage]}
    </span>
  );
}

function UrgencyTag({ urgency }) {
  const t = useT();
  if (urgency === "緊急") {
    return <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-xs font-semibold"><AlertTriangle size={12}/>{t("緊急", "Urgent")}</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 text-xs">{t("一般", "Normal")}</span>;
}

// ---------- Stepper (job detail) ----------
function Stepper({ stage }) {
  const lang = useContext(LangContext);
  const t = useT();
  const labels = lang === "en" ? STAGES_EN : STAGES;
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-max">
        {labels.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-2 w-24">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 ${
                  done ? "bg-emerald-500 border-emerald-500 text-white" :
                  active ? "bg-amber-500 border-amber-500 text-white animate-pulse" :
                  "bg-white border-slate-200 text-slate-300"
                }`}>
                  {done ? <CheckCircle2 size={20} /> : active ? <Clock size={18}/> : <Circle size={16} />}
                </div>
                <span className={`text-xs font-semibold text-center ${done || active ? "text-slate-800" : "text-slate-400"}`}>{s}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  done ? "bg-emerald-50 text-emerald-600" : active ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                }`}>{done ? t("完成","Done") : active ? t("進行中","In progress") : t("尚未開始","Not started")}</span>
              </div>
              {i < labels.length - 1 && <div className={`h-0.5 w-8 ${i < stage ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Signature Pad (device handoff) ----------
// ---------- Reusable share modal (quotes & invoices) ----------
function ShareModal({ title, onClose }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const fakeLink = "https://huateng.app/s/q-7f3e2c";
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Share2 size={18} className="text-amber-500"/>{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">{t("此連結為唯讀、無法猜測的安全連結；地點與時間中繼資料已自動移除。","This is a read-only, unguessable link; location/timestamp metadata has been stripped automatically.")}</p>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
          <span className="flex-1 text-xs font-mono text-slate-600 truncate">{fakeLink}</span>
          <button onClick={() => setCopied(true)} className="text-xs font-semibold text-amber-600 flex-shrink-0">{copied ? t("已複製 ✓","Copied ✓") : t("複製","Copy")}</button>
        </div>
        <button className="w-full text-sm border border-slate-200 rounded-lg py-2.5 flex items-center justify-center gap-1.5 hover:bg-slate-50"><Share2 size={14}/>{t("透過裝置分享功能傳送（LINE、簡訊等）","Send via device share sheet (LINE, SMS, etc.)")}</button>
        <button onClick={onClose} className="w-full mt-3 text-xs text-slate-400">{t("關閉","Close")}</button>
      </div>
    </div>
  );
}

function SignaturePad({ onClose, title }) {
  const [signed, setSigned] = useState(false);
  const t = useT();
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <p className="text-sm text-slate-500 mb-3">{t("請將裝置交給客戶，於下方簽名確認", "Hand the device to the customer to sign below")}</p>
        <div
          onClick={() => setSigned(true)}
          className="h-40 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer relative overflow-hidden"
        >
          {signed ? (
            <svg viewBox="0 0 200 60" className="w-3/4 h-16 text-slate-700">
              <path d="M10,40 Q30,10 50,35 T90,30 T130,40 T170,20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <span className="text-slate-400 text-sm flex flex-col items-center gap-2"><PenTool size={22}/>{t("點擊此處模擬簽名", "Tap here to simulate a signature")}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">{t("簽名將與時間戳記一併永久保存於此工作紀錄", "The signature and timestamp are permanently saved with this job record")}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setSigned(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">{t("清除","Clear")}</button>
          <button disabled={!signed} onClick={onClose} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${signed ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-400"}`}>{t("確認簽名","Confirm signature")}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Schedule create modal ----------
function ScheduleModal({ onClose }) {
  const [job, setJob] = useState("");
  const [truckNeeded, setTruckNeeded] = useState(false);
  const t = useT();
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Plus size={18} className="text-amber-500"/>{t("新增排程","New Schedule Entry")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("選擇案件","Job")}</label>
            <select onChange={(e) => setTruckNeeded(e.target.value === "J-1041" || e.target.value === "J-1040")} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-slate-50">
              <option value="">{t("搜尋或選擇案件…","Search or select a job…")}</option>
              {JOBS.filter(j => j.stage >= 2).map(j => <option key={j.id} value={j.id}>{j.id} — {j.customer}（{j.desc}）</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("指派師傅","Assign Worker")}</label>
            <select className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-slate-50">
              <option value="">{t("選擇師傅…","Select a worker…")}</option>
              {WORKERS.filter(w => w.status === "active").map(w => <option key={w.id}>{w.name}</option>)}
            </select>
          </div>
          {truckNeeded && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1"><Truck size={13}/>{t("此案件需要車輛","This job needs a truck")}</label>
              <select className="mt-1 w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white">
                <option>{t("一號車（可用）","Truck 1 (available)")}</option>
                <option>{t("二號車（此時段已被使用 — 衝突）","Truck 2 (already booked — conflict)")}</option>
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("日期","Date")}</label>
              <input type="date" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-slate-50" defaultValue="2026-07-06"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("時間","Time")}</label>
              <input type="time" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-slate-50" defaultValue="09:00"/>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{t("預估工時（自動帶入，僅顯示）","Estimated time (auto-filled, display only)")}</span>
            <span className="text-sm font-bold text-slate-700">{t("1.5 天","1.5 days")}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">{t("取消","Cancel")}</button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">{t("加入排程","Add to Schedule")}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- BO: Pipeline dashboard ----------
function PipelineDashboard({ openJob }) {
  const t = useT();
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("案件進度總覽", "Job Pipeline")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t("一眼掌握每個案件目前所在階段", "See where every job stands at a glance")}</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage, si) => (
          <div key={stage} className="min-w-[220px] flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold text-slate-700">{t(stage, STAGES_EN[si])}</span>
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{JOBS.filter(j => j.stage === si).length}</span>
            </div>
            <div className="space-y-2">
              {JOBS.filter(j => j.stage === si).map(j => (
                <button key={j.id} onClick={() => openJob(j)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-slate-400">{j.id}</span>
                    <UrgencyTag urgency={j.urgency}/>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{j.customer}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{j.desc}</p>
                  {j.worker && <p className="text-[11px] text-slate-400 mt-2">{t("負責","Assigned to")}：{j.worker}</p>}
                </button>
              ))}
              {JOBS.filter(j => j.stage === si).length === 0 && (
                <div className="text-xs text-slate-300 border border-dashed border-slate-200 rounded-xl p-4 text-center">{t("無案件","No jobs")}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- BO: Schedule (Google Calendar style, draggable) ----------
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const WEEK_DAYS = ["週一 7/6", "週二 7/7", "週三 7/8", "週四 7/9", "週五 7/10", "週六 7/11", "週日 7/12"];
const WORKER_COLOR = { "陳師傅": "bg-sky-100 border-sky-300 text-sky-800", "林師傅": "bg-violet-100 border-violet-300 text-violet-800" };

const INITIAL_BLOCKS = [
  { id: "b1", day: 0, hour: 9, span: 2, worker: "陳師傅", label: "王小姐 — 水龍頭維修" },
  { id: "b2", day: 1, hour: 9, span: 9, worker: "林師傅", label: "陳先生 — 全室配線（需車輛）" },
  { id: "b3", day: 3, hour: 13, span: 4, worker: "陳師傅", label: "許小姐 — 熱水器安裝" },
  { id: "b4", day: 0, hour: 14, span: 1, worker: "林師傅", label: "張先生 — 現場評估" },
];

function ScheduleView() {
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState("week");
  const [blocks, setBlocks] = useState(INITIAL_BLOCKS);
  const [dragId, setDragId] = useState(null);
  const t = useT();

  function handleDrop(day, hour) {
    if (!dragId) return;
    setBlocks(bs => bs.map(b => b.id === dragId ? { ...b, day, hour } : b));
    setDragId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("排程","Schedule")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t("依師傅與車輛安排每日工作 — 拖曳工作方塊即可調整時間", "Assign daily work by worker and truck — drag any block to reschedule")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button onClick={() => setView("week")} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${view === "week" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{t("週檢視","Week")}</button>
            <button onClick={() => setView("month")} className={`text-xs font-semibold px-3 py-1.5 rounded-md ${view === "month" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>{t("月檢視","Month")}</button>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <button className="p-1.5 hover:bg-slate-100 rounded-md"><ChevronLeft size={16}/></button>
            <span className="text-sm font-semibold text-slate-700 px-1">{t("2026 年 7 月", "July 2026")}</span>
            <button className="p-1.5 hover:bg-slate-100 rounded-md"><ChevronRight size={16}/></button>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800">
            <Plus size={16}/>{t("新增排程","New Entry")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-sky-300"/>陳師傅</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-300"/>林師傅</span>
        <span className="flex items-center gap-1.5 text-slate-400 ml-2"><Truck size={13}/>{t("二號車：使用中（黃先生案件）","Truck 2: In use (Mr. Huang's job)")}</span>
      </div>

      {view === "week" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
            <div className="border-b border-r border-slate-100"/>
            {WEEK_DAYS.map(d => (
              <div key={d} className="text-xs font-bold text-slate-500 text-center py-2.5 border-b border-slate-100">{d}</div>
            ))}
            {HOURS.map(h => (
              <React.Fragment key={h}>
                <div className="text-[10px] text-slate-300 text-right pr-2 pt-1 border-r border-slate-100">{h}:00</div>
                {WEEK_DAYS.map((_, di) => {
                  const block = blocks.find(b => b.day === di && b.hour === h);
                  return (
                    <div
                      key={di}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(di, h)}
                      className="min-h-[42px] border-b border-r border-slate-50 relative px-1 py-0.5"
                    >
                      {block && (
                        <div
                          draggable
                          onDragStart={() => setDragId(block.id)}
                          style={{ minHeight: `${block.span * 42 - 6}px` }}
                          className={`rounded-lg border px-2 py-1.5 text-[11px] cursor-grab active:cursor-grabbing shadow-sm ${WORKER_COLOR[block.worker]}`}
                        >
                          <p className="font-semibold leading-tight">{block.label}</p>
                          <p className="opacity-60 mt-0.5">{t(`${h}:00 起，共 ${block.span} 小時`, `From ${h}:00, ${block.span}h`)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7">
            {(useContext(LangContext) === "en" ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] : ["一","二","三","四","五","六","日"]).map(d => (
              <div key={d} className="text-xs font-bold text-slate-500 text-center py-2.5 border-b border-r border-slate-100">{d}</div>
            ))}
            {Array.from({ length: 35 }).map((_, i) => {
              const dayNum = i - 2;
              const dayBlocks = blocks.filter(b => b.day === (i % 7));
              return (
                <div
                  key={i}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(i % 7, 9)}
                  className="min-h-[90px] border-b border-r border-slate-50 p-1.5"
                >
                  {dayNum > 0 && dayNum <= 31 && <span className="text-[11px] text-slate-400">{dayNum}</span>}
                  <div className="space-y-1 mt-1">
                    {dayNum > 0 && dayNum <= 31 && dayBlocks.slice(0, 2).map(b => (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={() => setDragId(b.id)}
                        className={`rounded px-1.5 py-0.5 text-[10px] truncate cursor-grab ${WORKER_COLOR[b.worker]}`}
                      >
                        {b.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && <ScheduleModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ---------- BO: Create job modal ----------
function CreateJobModal({ onClose }) {
  const [needsTruck, setNeedsTruck] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState([]);
  const t = useT();
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Plus size={18} className="text-amber-500"/>{t("建立案件","Create Job")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-500">{t("客戶姓名","Customer Name")}</label><input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
            <div><label className="text-xs font-semibold text-slate-500">{t("手機號碼","Phone Number")}</label><input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
          </div>
          <div><label className="text-xs font-semibold text-slate-500">{t("地址","Address")}</label><input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("類別","Category")}</label>
              <select className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"><option>{t("水","Water")}</option><option>{t("電","Electrical")}</option></select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("緊急程度","Urgency")}</label>
              <select className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"><option>{t("一般","Normal")}</option><option>{t("緊急","Urgent")}</option></select>
            </div>
          </div>
          <div><label className="text-xs font-semibold text-slate-500">{t("案件描述","Description")}</label><textarea rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-500">{t("預估工時","Estimated Time")}</label><input placeholder={t("例：2 小時","e.g. 2 hours")} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
            <label className="flex items-center gap-2 mt-5 text-sm text-slate-600"><input type="checkbox" checked={needsTruck} onChange={e => setNeedsTruck(e.target.checked)} className="rounded"/>{t("需要車輛","Needs a truck")}</label>
          </div>
          <PhotoUploadGrid label={t("施工前照片","Before Photos")} existingCount={0} newPhotos={beforePhotos} onAdd={(p) => setBeforePhotos(a => [...a, p])} allowUpload={true} required={false} />
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold">{t("取消","Cancel")}</button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">{t("建立案件","Create Job")}</button>
        </div>
      </div>
    </div>
  );
}

function JobList({ openJob }) {
  const [showCreate, setShowCreate] = useState(false);
  const t = useT();
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("案件列表","Job List")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t(`共 ${JOBS.length} 筆案件`, `${JOBS.length} jobs total`)}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800"><Plus size={16}/>{t("建立案件","Create Job")}</button>
      </div>
      <div className="flex items-center gap-2 mb-4 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
        <Search size={16} className="text-slate-400"/>
        <input placeholder={t("搜尋客戶姓名、地址、案件編號…","Search customer, address, job number…")} className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400"/>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left font-semibold px-4 py-3">{t("編號","ID")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("客戶","Customer")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("類別","Category")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("狀態","Status")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("負責師傅","Worker")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("緊急程度","Urgency")}</th>
            </tr>
          </thead>
          <tbody>
            {JOBS.map(j => (
              <tr key={j.id} onClick={() => openJob(j)} className="border-t border-slate-100 hover:bg-amber-50/40 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{j.id}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{j.customer}</td>
                <td className="px-4 py-3 text-slate-600">{j.category}</td>
                <td className="px-4 py-3"><StageBadge stage={j.stage}/></td>
                <td className="px-4 py-3 text-slate-600">{j.worker || t("尚未指派","Unassigned")}</td>
                <td className="px-4 py-3"><UrgencyTag urgency={j.urgency}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ---------- Photo upload with real preview (click/tap to upload, works without a backend) ----------
function PhotoUploadGrid({ label, existingCount, newPhotos, onAdd, allowUpload, required }) {
  const inputRef = useRef(null);
  const t = useT();
  const total = existingCount + newPhotos.length;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        {required && <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 border border-rose-200 rounded px-1.5">{t("必填","Required")}</span>}
        {total > 0 && <span className="text-[10px] text-slate-300">（{total} {t("張","photos")}）</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: existingCount }).map((_, i) => (
          <div key={"e" + i} className="h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300"><Camera size={18} /></div>
        ))}
        {newPhotos.map((src, i) => (
          <div key={"n" + i} className="h-20 rounded-lg overflow-hidden border-2 border-emerald-300 relative">
            <img src={src} alt="" className="w-full h-full object-cover" />
            <span className="absolute bottom-0.5 right-0.5 bg-emerald-500 text-white text-[8px] px-1 rounded">{t("新","New")}</span>
          </div>
        ))}
        {allowUpload && (
          <button onClick={() => inputRef.current.click()} className="h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-amber-400 hover:text-amber-500 gap-1">
            <Camera size={18} />
            <span className="text-[10px]">{t("拍照或選擇","Take/choose photo")}</span>
          </button>
        )}
      </div>
      {allowUpload && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            Array.from(e.target.files).forEach((f) => onAdd(URL.createObjectURL(f)));
            e.target.value = "";
          }}
        />
      )}
      {total === 0 && !allowUpload && <p className="text-[11px] text-slate-300 mt-1">{t("尚未上傳","Not uploaded yet")}</p>}
    </div>
  );
}


function JobDetail({ job, back, asWorker }) {
  const [tab, setTab] = useState("overview");
  const [signStep, setSignStep] = useState(null);
  const [showSign, setShowSign] = useState(null);
  const [lineItems, setLineItems] = useState([
    { desc: "水龍頭更換（含零件）", qty: 1, price: 1200 },
    { desc: "到府基本工資", qty: 1, price: 600 },
  ]);
  const [invoiceType, setInvoiceType] = useState("einvoice");
  const [newBeforePhotos, setNewBeforePhotos] = useState([]);
  const [newAfterPhotos, setNewAfterPhotos] = useState([]);
  const [shareModal, setShareModal] = useState(null); // "quote" | "invoice" | null
  const [justIssued, setJustIssued] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);
  const total = lineItems.reduce((s, i) => s + i.qty * i.price, 0);
  const t = useT();

  const quoteAlreadySigned = job.stage >= 2;
  const workDoneAlreadySigned = job.stage >= 4;
  const alreadyInvoiced = job.stage >= 5;
  const hasAfterPhoto = workDoneAlreadySigned || newAfterPhotos.length > 0;

  function addLine() { setLineItems(l => [...l, { desc: "", qty: 1, price: 0 }]); }
  function updateLine(i, field, val) { setLineItems(l => l.map((row, ri) => ri === i ? { ...row, [field]: val } : row)); }

  return (
    <div>
      <button onClick={back} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"><ArrowLeft size={15}/>{t("返回","Back")}</button>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">{job.customer}</h2>
            <span className="text-xs font-mono text-slate-400">{job.id}</span>
            <UrgencyTag urgency={job.urgency}/>
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1"><MapPin size={13}/>{job.address}</p>
        </div>
        {job.needsTruck && <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-2.5 py-1 text-xs font-semibold"><Truck size={13}/>{t("需要車輛","Needs Truck")}</span>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <Stepper stage={job.stage} />
      </div>

      {!asWorker && (
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {[["overview",t("案件詳情","Details")],["quote",t("報價","Quote")],["invoice",t("帳單","Invoice")]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab===k ? "border-amber-500 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{l}</button>
          ))}
        </div>
      )}

      {(tab === "overview" || asWorker) && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{t("案件描述","Job Description")}</h3>
            <p className="text-sm text-slate-600 mb-4">{job.desc}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-xs text-slate-400 block">{t("類別","Category")}</span>{job.category}</div>
              <div><span className="text-xs text-slate-400 block">{t("電話","Phone")}</span><span className="flex items-center gap-1"><Phone size={12}/>{job.phone}</span></div>
              <div><span className="text-xs text-slate-400 block">{t("預估工時","Estimated Time")}</span>{job.est}</div>
              <div><span className="text-xs text-slate-400 block">{t("實際工時","Actual Time")}</span>{job.actual || "—"}</div>
            </div>
            {job.actual && job.actual !== job.est && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700">
                {t("工時差異說明：現場發現舊管線鏽蝕，額外花費時間更換轉接頭。","Variance note: found corroded old pipes on-site, extra time spent replacing the connector.")}
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5"><Camera size={15}/>{t("照片紀錄","Photos")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <PhotoUploadGrid
                label={t("施工前","Before")}
                existingCount={1}
                newPhotos={newBeforePhotos}
                onAdd={(p) => setNewBeforePhotos((a) => [...a, p])}
                allowUpload={job.stage < 2}
                required={false}
              />
              <PhotoUploadGrid
                label={t("施工後","After")}
                existingCount={workDoneAlreadySigned ? 1 : 0}
                newPhotos={newAfterPhotos}
                onAdd={(p) => setNewAfterPhotos((a) => [...a, p])}
                allowUpload={!workDoneAlreadySigned}
                required={true}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-3 flex items-start gap-1"><AlertTriangle size={11} className="mt-0.5 flex-shrink-0"/>{t("老闆與師傅皆可上傳施工前後照片（例如老闆親自到場評估或施工時）。上傳後將自動壓縮並校正方向；地點與時間資訊會保留在原始檔案中作為留存證據，但透過「分享」功能送出的版本會自動移除，避免外流客戶地址。","Both owner and worker can upload before/after photos (e.g. when the owner personally visits or performs work). Photos are auto-compressed and orientation-corrected on upload; location/timestamp data is kept in the original for evidence, but stripped from anything sent via Share to avoid leaking the customer's address.")}</p>
          </div>
        </div>
      )}

      {tab === "quote" && !asWorker && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">{quoteAlreadySigned ? t("報價明細（已確認）","Quote Details (Accepted)") : t("建立報價","Create Quote")}</h3>
            {!quoteAlreadySigned && <span className="text-xs text-slate-400">{t("依案件描述與照片填寫項目","Based on the job description and photos")}</span>}
          </div>
          <table className="w-full text-sm mb-3">
            <thead><tr className="text-xs text-slate-400 border-b border-slate-100"><th className="text-left font-semibold py-2">{t("項目","Item")}</th><th className="text-right font-semibold py-2 w-16">{t("數量","Qty")}</th><th className="text-right font-semibold py-2 w-24">{t("單價","Unit Price")}</th><th className="text-right font-semibold py-2 w-24">{t("小計","Subtotal")}</th></tr></thead>
            <tbody>
              {lineItems.map((row, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5">
                    {quoteAlreadySigned ? row.desc : <input value={row.desc} onChange={e => updateLine(i, "desc", e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm" placeholder={t("項目名稱","Item name")}/>}
                  </td>
                  <td className="py-1.5 text-right">
                    {quoteAlreadySigned ? row.qty : <input type="number" value={row.qty} onChange={e => updateLine(i, "qty", Number(e.target.value))} className="w-14 border border-slate-200 rounded px-1.5 py-1 text-sm text-right"/>}
                  </td>
                  <td className="py-1.5 text-right">
                    {quoteAlreadySigned ? `NT$${row.price}` : <input type="number" value={row.price} onChange={e => updateLine(i, "price", Number(e.target.value))} className="w-20 border border-slate-200 rounded px-1.5 py-1 text-sm text-right"/>}
                  </td>
                  <td className="py-1.5 text-right font-medium">NT${(row.qty * row.price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3} className="text-right font-bold pt-3">{t("總計","Total")}</td><td className="text-right font-bold pt-3">NT${total.toLocaleString()}</td></tr></tfoot>
          </table>

          {!quoteAlreadySigned && <button onClick={addLine} className="text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 mb-4 flex items-center gap-1"><Plus size={12}/>{t("新增項目","Add Item")}</button>}

          <div className="bg-slate-50 rounded-lg p-3 text-xs mb-3">
            <p className="text-slate-500 mb-2 font-semibold">{t("雙方簽署紀錄","Signature Log")}</p>
            <div className="flex flex-col gap-1.5">
              <span className={`flex items-center gap-1.5 ${quoteAlreadySigned || signStep === "quote-bo-signed" || signStep === "quote-done" ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                {quoteAlreadySigned || signStep ? <CheckCircle2 size={13}/> : <Circle size={13}/>}
                {t(`老闆已簽署（系統帳號認證，${quoteAlreadySigned ? "7/3 09:12" : "剛剛"}）`, `Owner signed (authenticated account, ${quoteAlreadySigned ? "Jul 3, 9:12am" : "just now"})`)}
              </span>
              <span className={`flex items-center gap-1.5 ${quoteAlreadySigned || signStep === "quote-done" ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                {quoteAlreadySigned || signStep === "quote-done" ? <CheckCircle2 size={13}/> : <Circle size={13}/>}
                {t(`客戶已簽署（${quoteAlreadySigned ? "裝置代簽，7/3 09:15" : "等待簽署"}）`, `Customer signed (${quoteAlreadySigned ? "device handoff, Jul 3, 9:15am" : "awaiting signature"})`)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {!quoteAlreadySigned && !signStep && (
              <button onClick={() => setSignStep("quote-bo-signed")} className="text-sm bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold">{t("建立並簽署報價（老闆）","Create & Sign Quote (Owner)")}</button>
            )}
            {signStep === "quote-bo-signed" && (
              <button onClick={() => setShowSign("quote")} className="text-sm border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-2 font-semibold flex items-center gap-1.5"><PenTool size={14}/>{t("請客戶於此裝置簽署","Have Customer Sign on This Device")}</button>
            )}
            <button onClick={() => setShareModal("quote")} className="text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5"><Share2 size={14}/>{t("分享報價單","Share Quote")}</button>
          </div>
        </div>
      )}

      {tab === "invoice" && !asWorker && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5"><DollarSign size={15}/>{alreadyInvoiced ? t("帳單","Invoice") : t("建立帳單","Create Invoice")}</h3>
          {workDoneAlreadySigned ? (
            <>
              <p className="text-xs text-slate-400 mb-3">{t(`金額取自已簽署的報價單，總計 NT$${total.toLocaleString()}`, `Amount from the signed quote, total NT$${total.toLocaleString()}`)}</p>
              <div className="flex gap-3 mb-4">
                <label className={`flex-1 rounded-xl p-3 text-sm cursor-pointer border-2 ${invoiceType === "einvoice" ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
                  <input type="radio" name="inv" checked={invoiceType === "einvoice"} onChange={() => setInvoiceType("einvoice")} className="mr-2"/>{t("正式電子發票（統一發票）","Official E-Invoice")}
                </label>
                <label className={`flex-1 rounded-xl p-3 text-sm cursor-pointer border-2 ${invoiceType === "receipt" ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
                  <input type="radio" name="inv" checked={invoiceType === "receipt"} onChange={() => setInvoiceType("receipt")} className="mr-2"/>{t("一般收據","Informal Receipt")}
                </label>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 mb-3">
                <span className="text-sm text-slate-600">{t("付款狀態","Payment Status")}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${job.stage >= 6 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{job.stage >= 6 ? t("已付款（信用卡）","Paid (Card)") : t("尚未付款","Unpaid")}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setJustIssued(true)} className="text-sm bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold">{alreadyInvoiced ? t("重新開立","Reissue") : t("開立帳單","Issue Invoice")}</button>
                <button onClick={() => setShareModal("invoice")} className="text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5"><Share2 size={14}/>{t("分享帳單","Share Invoice")}</button>
                <button
                  onClick={() => { setJustDownloaded(true); setTimeout(() => setJustDownloaded(false), 2500); }}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Download size={14}/>{justDownloaded ? t("已產生 PDF ✓","PDF Ready ✓") : t("下載 PDF","Download PDF")}
                </button>
              </div>
              {justIssued && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={13}/>{t(`${invoiceType === "einvoice" ? "電子發票" : "收據"}已開立（單號 INV-2026-0${job.id.slice(-3)}）`, `${invoiceType === "einvoice" ? "E-invoice" : "Receipt"} issued (No. INV-2026-0${job.id.slice(-3)})`)}
                </div>
              )}
              {justDownloaded && (
                <p className="mt-2 text-[11px] text-slate-400">{t("（此預覽環境無法產生實際 PDF 檔案，實際版本將使用伺服器端 PDF 產生功能）","(This preview can't generate a real PDF file — the actual build uses server-side PDF generation)")}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">{t("工作完成並經雙方簽署後即可開立帳單。","You can issue an invoice once the work is done and both parties have signed off.")}</p>
          )}
        </div>
      )}

      {!workDoneAlreadySigned && (
        <div className="mt-5 bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2 font-semibold">{t("完工雙方簽署","Completion Sign-Off")}</p>
          <div className="flex flex-col gap-1.5 text-xs mb-3">
            <span className={`flex items-center gap-1.5 ${signStep === "done-worker-signed" || signStep === "done-done" ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
              {signStep === "done-worker-signed" || signStep === "done-done" ? <CheckCircle2 size={13}/> : <Circle size={13}/>}
              {t("施工人員已確認完工","Worker confirmed completion")}
            </span>
            <span className={`flex items-center gap-1.5 ${signStep === "done-done" ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
              {signStep === "done-done" ? <CheckCircle2 size={13}/> : <Circle size={13}/>}
              {t("客戶已簽署確認","Customer signed off")}
            </span>
          </div>
          {!signStep && (
            <button
              disabled={!hasAfterPhoto}
              onClick={() => setSignStep("done-worker-signed")}
              className={`w-full font-semibold rounded-xl py-3 flex items-center justify-center gap-2 ${hasAfterPhoto ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
            >
              <CheckCircle2 size={16}/>{t("確認完工（本人簽署）","Confirm Completion (Sign Yourself)")}
            </button>
          )}
          {!signStep && !hasAfterPhoto && <p className="text-[11px] text-rose-400 mt-2 text-center">{t("請先於上方上傳至少一張施工後照片才能標記完工","Upload at least one after photo above before marking this complete")}</p>}
          {signStep === "done-worker-signed" && (
            <button onClick={() => setShowSign("completion")} className="w-full bg-amber-500 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-amber-600">
              <PenTool size={16}/>{t("請客戶於此裝置簽署確認","Have Customer Sign on This Device")}
            </button>
          )}
        </div>
      )}

      {showSign && (
        <SignaturePad
          title={showSign === "quote" ? "客戶簽署報價單" : "客戶簽署完工確認"}
          onClose={() => {
            setShowSign(null);
            setSignStep(s => s === "quote-bo-signed" ? "quote-done" : s === "done-worker-signed" ? "done-done" : s);
          }}
        />
      )}
      {shareModal && (
        <ShareModal
          title={shareModal === "quote" ? t("分享報價單","Share Quote") : t("分享帳單","Share Invoice")}
          onClose={() => setShareModal(null)}
        />
      )}
    </div>
  );
}

// ---------- BO: Team management ----------
function InviteWorkerModal({ onClose }) {
  const [rateType, setRateType] = useState("hourly");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const fakeLink = "https://huateng.app/invite/8f2a-91cd";

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">邀請師傅</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>

        {!generated ? (
          <>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-slate-500">姓名</label><input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="text-xs font-semibold text-slate-500">手機號碼</label><input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
              <div>
                <label className="text-xs font-semibold text-slate-500">計薪方式</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setRateType("hourly")} className={`flex-1 text-sm py-2 rounded-lg border ${rateType==="hourly" ? "border-amber-400 bg-amber-50 font-semibold" : "border-slate-200 text-slate-500"}`}>時薪</button>
                  <button onClick={() => setRateType("daily")} className={`flex-1 text-sm py-2 rounded-lg border ${rateType==="daily" ? "border-amber-400 bg-amber-50 font-semibold" : "border-slate-200 text-slate-500"}`}>日薪</button>
                </div>
              </div>
              <div><label className="text-xs font-semibold text-slate-500">{rateType === "hourly" ? "時薪金額" : "日薪金額"}</label><input type="number" placeholder="NT$" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
              <p className="text-[11px] text-slate-400">此薪資資訊僅供老闆內部成本試算使用，師傅端不會顯示。</p>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold">取消</button>
              <button onClick={() => setGenerated(true)} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">產生邀請連結</button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1"><CheckCircle2 size={13}/>邀請連結已產生 — 已加入名單，狀態為「已邀請」</p>
              <p className="text-[11px] text-emerald-600 mb-3">請親自透過 LINE、簡訊或當面告知的方式，將此連結傳送給對方。此連結僅能使用一次。</p>
              <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <span className="flex-1 text-xs font-mono text-slate-600 truncate">{fakeLink}</span>
                <button onClick={() => setCopied(true)} className="text-xs font-semibold text-emerald-600 flex-shrink-0">{copied ? "已複製 ✓" : "複製"}</button>
              </div>
              <button className="w-full mt-2 text-xs border border-emerald-300 text-emerald-700 rounded-lg py-2 flex items-center justify-center gap-1.5 bg-white"><Share2 size={12}/>透過分享功能傳送</button>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">完成</button>
          </>
        )}
      </div>
    </div>
  );
}

function TeamPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [openWorkerId, setOpenWorkerId] = useState(null);
  const [workerTags, setWorkerTags] = useState({
    w1: ["準時可靠"],
    w2: ["電力工程經驗豐富", "偶爾晚到"],
  });
  const [workerLog, setWorkerLog] = useState({
    w1: "",
    w2: "2026/06 客訴一次：施工後未清理現場，已當面提醒。",
  });
  function addWorkerTag(id, tag) {
    setWorkerTags(prev => ({ ...prev, [id]: [...(prev[id] || []), tag] }));
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h2 className="text-xl font-bold text-slate-800">團隊管理</h2><p className="text-sm text-slate-500 mt-0.5">管理師傅名單、薪資與車輛（僅老闆可見）</p></div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800"><Plus size={16}/>邀請師傅</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase"><th className="text-left font-semibold px-4 py-3">姓名</th><th className="text-left font-semibold px-4 py-3">電話</th><th className="text-left font-semibold px-4 py-3">薪資</th><th className="text-left font-semibold px-4 py-3">狀態</th><th className="text-left font-semibold px-4 py-3">操作</th></tr></thead>
          <tbody>
            {WORKERS.map(w => (
              <React.Fragment key={w.id}>
                <tr className="border-t border-slate-100 cursor-pointer hover:bg-amber-50/30" onClick={() => setOpenWorkerId(openWorkerId === w.id ? null : w.id)}>
                  <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-1.5">
                    <ChevronRight size={14} className={`text-slate-300 transition ${openWorkerId === w.id ? "rotate-90" : ""}`}/>{w.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{w.phone}</td>
                  <td className="px-4 py-3 text-slate-600">NT${w.rate.toLocaleString()} / {w.rateType === "hourly" ? "小時" : "日"}</td>
                  <td className="px-4 py-3">
                    {w.status === "active" && <span className="text-xs bg-emerald-50 text-emerald-600 rounded-full px-2 py-0.5">在職</span>}
                    {w.status === "inactive" && <span className="text-xs bg-slate-100 text-slate-400 rounded-full px-2 py-0.5">停用</span>}
                    {w.status === "invited" && <span className="text-xs bg-amber-50 text-amber-600 rounded-full px-2 py-0.5 flex items-center gap-1 w-fit"><Clock size={10}/>已邀請，尚未接受</span>}
                  </td>
                  <td className="px-4 py-3">
                    {w.status === "invited" ? (
                      <button onClick={(e) => e.stopPropagation()} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"><Share2 size={11}/>複製邀請連結</button>
                    ) : (
                      <button onClick={(e) => e.stopPropagation()} className="text-xs text-slate-400 hover:text-rose-500">{w.status === "active" ? "停用" : "重新啟用"}</button>
                    )}
                  </td>
                </tr>
                {openWorkerId === w.id && (
                  <tr>
                    <td colSpan={5} className="bg-slate-50/60 border-t border-slate-100 px-4 py-4">
                      <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Lock size={11}/>私人備註（僅老闆可見，師傅本人不會看到）</p>
                      <div className="mb-3">
                        <TagEditor tags={workerTags[w.id] || []} onAdd={(tag) => addWorkerTag(w.id, tag)} color="sky" />
                      </div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">紀錄事項（例：客訴、表現、需要注意的細節）</label>
                      <textarea
                        rows={2}
                        value={workerLog[w.id] || ""}
                        onChange={(e) => setWorkerLog(prev => ({ ...prev, [w.id]: e.target.value }))}
                        placeholder="輸入這位師傅過去發生的狀況，供未來排班或評估參考…"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5"><Truck size={15}/>車輛</h3>
      <div className="grid grid-cols-2 gap-3">
        {TRUCKS.map(truck => (
          <div key={truck.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{truck.name}</span>
            <span className={`text-xs rounded-full px-2.5 py-1 ${truck.status === "可用" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{truck.status}</span>
          </div>
        ))}
      </div>
      {showInvite && <InviteWorkerModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

// ---------- BO: Customers directory (private notes live here) ----------
// ---------- Reusable tag editor (used for both customer and worker private notes) ----------
function TagEditor({ tags, onAdd, color = "rose" }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const t = useT();
  const colorClass = color === "rose" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-sky-50 text-sky-600 border-sky-200";
  function submit() {
    if (value.trim()) onAdd(value.trim());
    setValue("");
    setAdding(false);
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag, i) => <span key={i} className={`text-xs rounded-full px-3 py-1 border ${colorClass}`}>{tag}</span>)}
      {adding ? (
        <div className="flex items-center gap-1">
          <input autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder={t("輸入標籤…","Type a tag…")} className="text-xs border border-slate-300 rounded-full px-3 py-1 w-28 outline-none focus:border-amber-400"/>
          <button onClick={submit} className="text-xs bg-slate-900 text-white rounded-full px-2 py-1">{t("加","Add")}</button>
          <button onClick={() => { setAdding(false); setValue(""); }} className="text-slate-400"><X size={12}/></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs border border-dashed border-slate-300 text-slate-400 rounded-full px-3 py-1 flex items-center gap-1 hover:border-amber-400 hover:text-amber-500"><Plus size={11}/>{t("新增標籤","Add Tag")}</button>
      )}
    </div>
  );
}

function CustomersPage() {
  const [openId, setOpenId] = useState(null);
  const [noteTags, setNoteTags] = useState({
    "王小姐": ["首次客戶"],
    "李太太": ["付款較慢", "大樓需先登記警衛室"],
    "陳先生": ["高單價客戶"],
  });
  const t = useT();
  const customers = Array.from(new Set(JOBS.map(j => j.customer))).map(name => {
    const jobs = JOBS.filter(j => j.customer === name);
    return { name, phone: jobs[0].phone, jobCount: jobs.length, jobs };
  });
  function addTag(name, tag) {
    setNoteTags(prev => ({ ...prev, [name]: [...(prev[name] || []), tag] }));
  }
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">{t("客戶","Customers")}</h2>
      <p className="text-sm text-slate-500 mb-5 flex items-center gap-1"><Lock size={12}/>{t("私人備註僅老闆可見，客戶與師傅皆看不到","Private notes are visible only to the owner — never to customers or workers")}</p>
      <div className="space-y-3">
        {customers.map(c => (
          <div key={c.name} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button onClick={() => setOpenId(openId === c.name ? null : c.name)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><UserCircle size={20}/></div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Phone size={11}/>{c.phone} · {t(`${c.jobCount} 筆案件`, `${c.jobCount} jobs`)}</p>
                </div>
              </div>
              <ChevronRight size={16} className={`text-slate-300 transition ${openId === c.name ? "rotate-90" : ""}`}/>
            </button>
            {openId === c.name && (
              <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><Lock size={11}/>{t("私人備註","Private Notes")}</p>
                <div className="mb-4">
                  <TagEditor tags={noteTags[c.name] || []} onAdd={(tag) => addTag(c.name, tag)} />
                </div>
                <p className="text-xs font-semibold text-slate-500 mb-2">{t("案件紀錄","Job History")}</p>
                <div className="space-y-1.5">
                  {c.jobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between text-sm bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-slate-600">{j.desc}</span>
                      <StageBadge stage={j.stage}/>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- BO: Materials purchase log ----------
function MaterialsPage() {
  const suppliers = Array.from(new Set(MATERIALS.map(m => m.supplier)));
  const [filter, setFilter] = useState("全部");
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [preset, setPreset] = useState("month");

  function applyPreset(p) {
    setPreset(p);
    if (p === "month") { setStartDate("2026-07-01"); setEndDate("2026-07-31"); }
    if (p === "lastMonth") { setStartDate("2026-06-01"); setEndDate("2026-06-30"); }
    if (p === "week") { setStartDate("2026-07-01"); setEndDate("2026-07-07"); }
  }

  const rows = MATERIALS.filter(m => {
    const supplierMatch = filter === "全部" || m.supplier === filter;
    const dateMatch = m.date >= startDate && m.date <= endDate;
    return supplierMatch && dateMatch;
  });
  const total = rows.reduce((s, m) => s + m.qty * m.unitPrice, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">材料採購紀錄</h2>
          <p className="text-sm text-slate-500 mt-0.5">月底核對材料行請款金額是否正確</p>
        </div>
        <button className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800"><Plus size={16}/>新增採購紀錄</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-16">期間：</span>
          <button onClick={() => applyPreset("week")} className={`text-xs px-3 py-1.5 rounded-full ${preset==="week" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>本週</button>
          <button onClick={() => applyPreset("month")} className={`text-xs px-3 py-1.5 rounded-full ${preset==="month" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>本月</button>
          <button onClick={() => applyPreset("lastMonth")} className={`text-xs px-3 py-1.5 rounded-full ${preset==="lastMonth" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>上月</button>
          <button onClick={() => setPreset("custom")} className={`text-xs px-3 py-1.5 rounded-full ${preset==="custom" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>自訂</button>
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"/>
            <span className="text-slate-400 text-sm">至</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"/>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-16">供應商：</span>
          <button onClick={() => setFilter("全部")} className={`text-xs px-3 py-1.5 rounded-full ${filter==="全部" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>全部</button>
          {suppliers.map(s => <button key={s} onClick={() => setFilter(s)} className={`text-xs px-3 py-1.5 rounded-full ${filter===s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>{s}</button>)}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase"><th className="text-left font-semibold px-4 py-3">日期</th><th className="text-left font-semibold px-4 py-3">供應商</th><th className="text-left font-semibold px-4 py-3">項目</th><th className="text-right font-semibold px-4 py-3">數量</th><th className="text-right font-semibold px-4 py-3">單價</th><th className="text-right font-semibold px-4 py-3">小計</th><th className="text-left font-semibold px-4 py-3">關聯案件</th></tr></thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{m.date}</td>
                <td className="px-4 py-3 text-slate-700">{m.supplier}</td>
                <td className="px-4 py-3 text-slate-700">{m.item}</td>
                <td className="px-4 py-3 text-right">{m.qty}</td>
                <td className="px-4 py-3 text-right">NT${m.unitPrice}</td>
                <td className="px-4 py-3 text-right font-medium">NT${(m.qty * m.unitPrice).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{m.job}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center text-slate-300 py-8 text-sm">此區間內無採購紀錄</td></tr>}
          </tbody>
          <tfoot><tr className="bg-slate-50"><td colSpan={5} className="text-right font-bold px-4 py-3">此區間總計（{startDate} ~ {endDate}）</td><td className="text-right font-bold px-4 py-3">NT${total.toLocaleString()}</td><td/></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------- BO: Business insights ----------
function InsightsPage() {
  const revenue = JOBS.reduce((s, j) => s + j.total, 0);
  const labor = JOBS.reduce((s, j) => s + j.laborCost, 0);
  const material = JOBS.reduce((s, j) => s + j.materialCost, 0);
  const profit = revenue - labor - material;
  const margin = ((profit / revenue) * 100).toFixed(1);
  const unpaid = JOBS.filter(j => j.stage >= 5 && j.stage < 6).reduce((s, j) => s + j.total, 0);
  const chartData = [
    { week: "第1週", 營收: 12000, 成本: 5200 },
    { week: "第2週", 營收: 18500, 成本: 7800 },
    { week: "第3週", 營收: 24500, 成本: 9100 },
    { week: "第4週", 營收: 21000, 成本: 8000 },
  ];
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">營運分析</h2>
      <p className="text-sm text-slate-500 mb-5">本月營收、成本與獲利概況</p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Wallet size={12}/>總營收</p>
          <p className="text-xl font-bold text-slate-800">NT${revenue.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">人力成本</p>
          <p className="text-xl font-bold text-slate-800">NT${labor.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">材料成本</p>
          <p className="text-xl font-bold text-slate-800">NT${material.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 mb-1 flex items-center gap-1"><TrendingUp size={12}/>淨利（毛利率 {margin}%）</p>
          <p className="text-xl font-bold text-emerald-700">NT${profit.toLocaleString()}</p>
        </div>
      </div>

      {unpaid > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={15}/>目前有 NT${unpaid.toLocaleString()} 已請款但尚未收到款項
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">每週營收與成本</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="week" tick={{ fontSize: 12 }}/>
            <YAxis tick={{ fontSize: 12 }}/>
            <Tooltip/>
            <Bar dataKey="營收" fill="#f59e0b" radius={[4,4,0,0]}/>
            <Bar dataKey="成本" fill="#94a3b8" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-700">各案件獲利明細</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase"><th className="text-left font-semibold px-4 py-3">案件</th><th className="text-right font-semibold px-4 py-3">營收</th><th className="text-right font-semibold px-4 py-3">人力</th><th className="text-right font-semibold px-4 py-3">材料</th><th className="text-right font-semibold px-4 py-3">淨利</th><th className="text-right font-semibold px-4 py-3">毛利率</th></tr></thead>
          <tbody>
            {JOBS.map(j => {
              const p = j.total - j.laborCost - j.materialCost;
              const m = ((p / j.total) * 100).toFixed(0);
              const low = m < 40;
              return (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="px-4 py-3"><span className="font-semibold text-slate-800">{j.customer}</span><span className="text-xs text-slate-400 ml-2">{j.desc}</span></td>
                  <td className="px-4 py-3 text-right">NT${j.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-500">NT${j.laborCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-500">NT${j.materialCost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">NT${p.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${low ? "text-rose-500" : "text-emerald-600"}`}>{m}%{low && <TrendingDown size={11} className="inline ml-1"/>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Worker: My jobs ----------
function WorkerJobs({ openJob }) {
  const mine = JOBS.filter(j => j.worker === "陳師傅");
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">我的案件</h2>
      <p className="text-sm text-slate-500 mb-5">陳師傅 — 今日共 {mine.length} 件</p>
      <div className="space-y-3">
        {mine.map(j => (
          <button key={j.id} onClick={() => openJob(j)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-800">{j.customer}</span>
              <StageBadge stage={j.stage}/>
            </div>
            <p className="text-sm text-slate-500">{j.desc}</p>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><MapPin size={11}/>{j.address}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Customer: QR signup ----------
// ---------- Shared: OAuth continuation options (same 4 options for BO, Worker, and Customer) ----------
function OAuthOptions() {
  const t = useT();
  return (
    <>
      <div className="flex items-center gap-2 my-2"><div className="flex-1 h-px bg-slate-100"/><span className="text-xs text-slate-300">{t("或使用","Or continue with")}</span><div className="flex-1 h-px bg-slate-100"/></div>
      <button className="w-full border border-slate-200 rounded-lg py-2.5 text-sm font-semibold text-slate-600">{t("使用 Google 繼續","Continue with Google")}</button>
      <button className="w-full border border-slate-200 rounded-lg py-2.5 text-sm font-semibold text-slate-600">{t("使用 Facebook 繼續","Continue with Facebook")}</button>
      <button className="w-full border border-emerald-200 bg-emerald-50 rounded-lg py-2.5 text-sm font-semibold text-emerald-700">{t("使用 LINE 繼續","Continue with LINE")}</button>
    </>
  );
}

function CustomerSignup() {
  const t = useT();
  return (
    <div className="max-w-sm mx-auto py-10">
      <div className="text-center mb-6">
        <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3"><QrCode className="text-amber-400" size={26}/></div>
        <h2 className="text-lg font-bold text-slate-800">{t("建立您的帳戶","Create Your Account")}</h2>
        <p className="text-sm text-slate-500 mt-1">{t("掃描師傅裝置上的 QR code 後跳轉至此頁面","Reached by scanning the QR code on the worker's/owner's device")}</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-500">{t("手機號碼","Phone Number")}</label>
          <input defaultValue="0955-123-456" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500"/>
          <span className="text-[11px] text-slate-400">{t("已自動帶入","Auto-filled")}</span>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">{t("設定密碼","Set Password")}</label>
          <input type="password" placeholder="••••••••" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/>
        </div>
        <button className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 mt-2">{t("建立帳戶","Create Account")}</button>
        <OAuthOptions />
        <p className="text-center text-xs text-slate-400 pt-1">{t("忘記密碼？","Forgot password?")}</p>
      </div>
    </div>
  );
}

// ---------- Customer: portal ----------
function CustomerPortal() {
  return (
    <div className="max-w-lg mx-auto py-8">
      <h2 className="text-lg font-bold text-slate-800 mb-1">王小姐，您好</h2>
      <p className="text-sm text-slate-500 mb-5">與華騰工程行的服務紀錄</p>
      <div className="space-y-3">
        {JOBS.filter(j => j.customer === "王小姐" || j.customer === "許小姐").map(j => (
          <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-800 text-sm">{j.desc}</span>
              <StageBadge stage={j.stage}/>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-xs">施工前照片</div>
              <div className="h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-xs">施工後照片</div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">總金額</span>
              <span className="font-bold text-slate-800">NT${j.total.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
        <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Lock size={12}/>我的私人筆記（僅您可見）</p>
        <p className="text-sm text-slate-600">下次記得問陳師傅同款水龍頭的保固期限。</p>
      </div>
    </div>
  );
}

// ---------- Shared: 2FA enrollment (first-time setup, not just code entry) ----------
function TwoFactorEnrollment({ onDone }) {
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const t = useT();
  const backupCodes = ["4K2P-9XQZ", "7T1M-6VWB", "2R8N-4LKE", "9C3F-8ZYA", "5J6H-1QPT", "3W7G-2NRM", "8B4D-5FXK", "6Y9L-7CVU"];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-1">{t("設定雙重驗證（必要步驟）","Set Up Two-Factor Authentication (Required)")}</h3>
      <p className="text-xs text-slate-400 mb-4">{t("此帳號可存取客戶個資與營運數據，需設定雙重驗證才能繼續使用","This account can access customer data and business records — 2FA is required to continue")}</p>

      {!confirmed ? (
        <>
          <p className="text-xs font-semibold text-slate-500 mb-2">{t("步驟 1：使用驗證器 App 掃描","Step 1: Scan with an authenticator app")}</p>
          <div className="flex justify-center mb-3">
            <div className="h-32 w-32 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
              <QrCode size={56} className="text-slate-400"/>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center mb-1">{t("建議使用 Google Authenticator 或 Authy","We recommend Google Authenticator or Authy")}</p>
          <div className="bg-slate-50 rounded-lg p-2 text-center mb-4">
            <p className="text-[10px] text-slate-400">{t("無法掃描？手動輸入此金鑰","Can't scan? Enter this key manually")}</p>
            <p className="text-xs font-mono text-slate-600 tracking-wider">JBSW Y3DP EHPK 3PXP</p>
          </div>
          <p className="text-xs font-semibold text-slate-500 mb-2">{t("步驟 2：輸入 App 顯示的 6 位數驗證碼","Step 2: Enter the 6-digit code from the app")}</p>
          <div className="flex gap-2 mb-4">
            {code.map((c, i) => (
              <input key={i} maxLength={1} value={c} onChange={e => { const v=[...code]; v[i]=e.target.value.replace(/\D/,""); setCode(v); }} className="w-9 h-11 text-center text-base font-bold border border-slate-200 rounded-lg focus:border-amber-400 outline-none"/>
            ))}
          </div>
          <button onClick={() => setConfirmed(true)} className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5">{t("確認設定","Confirm Setup")}</button>
        </>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1"><AlertTriangle size={12}/>{t("請保存備用復原碼","Save your backup recovery codes")}</p>
            <p className="text-[11px] text-amber-600 mb-2">{t("若日後遺失驗證器裝置，可使用以下任一組復原碼登入。每組僅能使用一次，請截圖或抄寫保存於安全處。","If you ever lose your authenticator device, use any one of these codes to log in. Each works once — save them somewhere safe.")}</p>
            <div className="grid grid-cols-2 gap-1.5 bg-white rounded-lg p-2">
              {backupCodes.map(c => <span key={c} className="text-[11px] font-mono text-slate-600 text-center py-0.5">{c}</span>)}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <input type="checkbox" className="rounded"/>{t("我已保存復原碼","I've saved my recovery codes")}
          </label>
          <button onClick={onDone} className="w-full bg-emerald-600 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5"><CheckCircle2 size={15}/>{t("完成設定，進入系統","Finish setup and continue")}</button>
        </>
      )}
    </div>
  );
}

// ---------- BO: brand-new company signup ----------
function CompanySignupFlow({ onDone }) {
  const [step, setStep] = useState("info");
  const t = useT();
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-6">
        <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3"><Briefcase className="text-amber-400" size={24}/></div>
        <h2 className="text-lg font-bold text-slate-800">{t("建立公司帳號","Create Company Account")}</h2>
        <p className="text-sm text-slate-500 mt-1">{t("給第一次使用的老闆（BO）","For business owners setting up for the first time")}</p>
      </div>
      {step === "info" ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div><label className="text-xs font-semibold text-slate-500">{t("公司╱工程行名稱","Company Name")}</label><input placeholder={t("例：華騰工程行","e.g. Huateng Engineering")} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/></div>
          <div><label className="text-xs font-semibold text-slate-500">{t("統一編號（選填，日後開立正式電子發票需要）","Business Tax ID (optional, needed later for official e-invoices)")}</label><input placeholder={t("可稍後補上","Can add later")} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/></div>
          <div><label className="text-xs font-semibold text-slate-500">{t("您的手機號碼","Your Phone Number")}</label><input placeholder="09XX-XXX-XXX" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/></div>
          <div><label className="text-xs font-semibold text-slate-500">{t("設定密碼","Set Password")}</label><input type="password" placeholder="••••••••" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/></div>
          <button onClick={() => setStep("mfa")} className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 mt-2">{t("建立帳號並繼續","Create Account & Continue")}</button>
          <OAuthOptions />
        </div>
      ) : (
        <TwoFactorEnrollment onDone={onDone} />
      )}
    </div>
  );
}

// ---------- Worker: accept invite from BO ----------
function WorkerInviteFlow({ onDone }) {
  const [step, setStep] = useState("info");
  const t = useT();
  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-6">
        <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3"><Users className="text-amber-400" size={24}/></div>
        <h2 className="text-lg font-bold text-slate-800">{t("您受邀加入","You're Invited to Join")}</h2>
        <p className="text-sm font-semibold text-amber-600 mt-1">華騰工程行</p>
        <p className="text-xs text-slate-400 mt-1">{t("邀請連結來自老闆的團隊管理頁面","Invite link sent from the owner's Team Management page")}</p>
      </div>
      {step === "info" ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("手機號碼","Phone Number")}</label>
            <input defaultValue="0912-345-678" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500"/>
            <span className="text-[11px] text-slate-400">{t("老闆邀請時已填入","Filled in by the owner's invite")}</span>
          </div>
          <div><label className="text-xs font-semibold text-slate-500">{t("設定密碼","Set Password")}</label><input type="password" placeholder="••••••••" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/></div>
          <button onClick={() => setStep("mfa")} className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 mt-2">{t("設定密碼並繼續","Set Password & Continue")}</button>
          <OAuthOptions />
        </div>
      ) : (
        <TwoFactorEnrollment onDone={onDone} />
      )}
    </div>
  );
}

// ---------- Multi-company picker (shown only if one login is linked to 2+ companies) ----------
function CompanyPicker({ onPick }) {
  const t = useT();
  const companies = ["華騰工程行", t("信義水電行（兼職支援）","Xinyi Plumbing (part-time support)")];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-1">{t("選擇工作環境","Choose Workspace")}</h3>
      <p className="text-xs text-slate-400 mb-4">{t("此帳號隸屬於多間公司，請選擇要登入的公司","This account belongs to more than one company — choose which to log into")}</p>
      <div className="space-y-2">
        {companies.map(c => (
          <button key={c} onClick={onPick} className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 hover:border-amber-300 hover:bg-amber-50/40 text-left">
            <span className="text-sm font-semibold text-slate-700">{c}</span>
            <ChevronRight size={16} className="text-slate-300"/>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- BO/Worker: secure login (phone + password + 2FA) ----------
function LoginGate({ role, onLoggedIn }) {
  const [entry, setEntry] = useState("login"); // login | signup | invite
  const [step, setStep] = useState("credentials"); // credentials | company | mfa
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [multiCompanyDemo, setMultiCompanyDemo] = useState(false);
  const t = useT();
  const roleLabel = role === "bo" ? t("老闆","Owner") : t("師傅","Worker");

  if (entry === "signup") return <div className="min-h-screen flex items-center justify-center bg-slate-50"><CompanySignupFlow onDone={onLoggedIn} /></div>;
  if (entry === "invite") return <div className="min-h-screen flex items-center justify-center bg-slate-50"><WorkerInviteFlow onDone={onLoggedIn} /></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3"><Lock className="text-amber-400" size={24}/></div>
          <h2 className="text-lg font-bold text-slate-800">華騰工程行</h2>
          <p className="text-sm text-slate-500 mt-1">{roleLabel} {t("登入","Login")}</p>
        </div>

        {step === "credentials" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div><label className="text-xs font-semibold text-slate-500">{t("手機號碼","Phone Number")}</label><input placeholder="09XX-XXX-XXX" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/></div>
            <div><label className="text-xs font-semibold text-slate-500">{t("密碼","Password")}</label><input type="password" placeholder="••••••••" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"/></div>
            <button onClick={() => setStep(multiCompanyDemo ? "company" : "mfa")} className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 mt-2 flex items-center justify-center gap-1.5"><LogIn size={15}/>{t("登入","Log In")}</button>
            <p className="text-center text-xs text-slate-400 pt-1">{t("忘記密碼？","Forgot password?")}</p>
            <OAuthOptions />
            <div className="border-t border-slate-100 pt-3 mt-1 flex items-start gap-1.5 text-[11px] text-slate-400">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0"/>
              <span>{t("此帳號可存取客戶個資與營運數據，登入將要求雙重驗證，並在裝置閒置一段時間後自動登出。","This account can access customer data and business records. Login requires 2FA, and sessions auto-expire after inactivity.")}</span>
            </div>
          </div>
        )}

        {/* This is a REAL, always-visible part of the product for BO — not a demo toggle.
            Company signup must be publicly discoverable; worker accounts must not be
            (workers only ever arrive via a unique invite link sent by their BO, per
            PRODUCT_SPEC.md §8 — so no equivalent public link exists for the worker role). */}
        {step === "credentials" && role === "bo" && (
          <button onClick={() => setEntry("signup")} className="w-full text-center text-sm text-slate-500 mt-4">
            {t("還沒有公司帳號？","Don't have a company account yet?")} <span className="text-amber-600 font-semibold">{t("建立公司帳號","Create one")}</span>
          </button>
        )}

        {step === "company" && <CompanyPicker onPick={() => setStep("mfa")} />}

        {step === "mfa" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-sm text-slate-600 mb-1 font-semibold">{t("輸入雙重驗證碼","Enter Your 2FA Code")}</p>
            <p className="text-xs text-slate-400 mb-4">{t("請開啟驗證器 App（如 Google Authenticator）輸入 6 位數字","Open your authenticator app (e.g. Google Authenticator) and enter the 6-digit code")}</p>
            <div className="flex gap-2 mb-2">
              {code.map((c, i) => (
                <input key={i} maxLength={1} value={c} onChange={e => { const v=[...code]; v[i]=e.target.value.replace(/\D/,""); setCode(v); }} className="w-10 h-12 text-center text-lg font-bold border border-slate-200 rounded-lg focus:border-amber-400 outline-none"/>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mb-4">{t("遺失驗證器裝置？改用備用復原碼","Lost your authenticator? Use a backup recovery code instead")}</p>
            <button onClick={onLoggedIn} className="w-full bg-emerald-600 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5"><CheckCircle2 size={15}/>{t("驗證並登入","Verify & Log In")}</button>
            <button onClick={() => setStep("credentials")} className="w-full text-xs text-slate-400 mt-3">{t("返回上一步","Back")}</button>
          </div>
        )}

        {/* Mockup-navigation convenience only — a real worker never sees this screen at all
            for their first setup. They receive a unique link from their BO (generated in
            Team Management) and land directly on WorkerInviteFlow. This toggle exists purely
            so you can preview that screen here without simulating a real invite link. */}
        <div className="mt-5 border-t border-dashed border-slate-200 pt-4 space-y-2">
          <p className="text-[10px] text-slate-300 text-center">{t("— 以下僅供在此預覽環境中切換畫面，實際產品中不會出現 —","— mockup-navigation only, would not appear in the real product —")}</p>
          {role === "worker" && <button onClick={() => setEntry("invite")} className="w-full text-xs text-amber-600 font-semibold">{t("預覽：師傅點擊邀請連結後看到的畫面","Preview: what a worker sees after clicking their invite link")}</button>}
          <label className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <input type="checkbox" checked={multiCompanyDemo} onChange={e => setMultiCompanyDemo(e.target.checked)} className="rounded"/>
            {t("預覽：此帳號隸屬多間公司","Preview: this account belongs to multiple companies")}
          </label>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [role, setRole] = useState("bo");
  const [boPage, setBoPage] = useState("pipeline");
  const [selectedJob, setSelectedJob] = useState(null);
  const [customerView, setCustomerView] = useState("signup");
  const [boAuthed, setBoAuthed] = useState(false);
  const [workerAuthed, setWorkerAuthed] = useState(false);
  const [lang, setLang] = useState("zh");
  const t = (zh, en) => (lang === "en" ? en : zh);

  const NAV = [
    ["pipeline", t("案件進度","Pipeline"), LayoutGrid],
    ["schedule", t("排程","Schedule"), Calendar],
    ["jobs", t("案件列表","Jobs"), Briefcase],
    ["customers", t("客戶","Customers"), UserCircle],
    ["team", t("團隊管理","Team"), Users],
    ["materials", t("材料採購","Materials"), Package],
    ["insights", t("營運分析","Insights"), TrendingUp],
  ];

  return (
    <LangContext.Provider value={lang}>
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Role switcher — for demo purposes only, not part of the real product */}
      <div className="bg-slate-900 text-white text-xs px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-slate-400">{t("模擬檢視角色：","Preview as:")}</span>
        {[["bo",t("老闆","Owner")],["worker",t("師傅","Worker")],["customer",t("客戶","Customer")]].map(([k,l]) => (
          <button key={k} onClick={() => { setRole(k); setSelectedJob(null); }} className={`px-3 py-1 rounded-full font-semibold ${role===k ? "bg-amber-500 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{l}</button>
        ))}
        <div className="flex-1"/>
        <div className="flex bg-slate-800 rounded-full p-0.5">
          <button onClick={() => setLang("zh")} className={`px-2.5 py-1 rounded-full font-semibold ${lang==="zh" ? "bg-amber-500 text-slate-900" : "text-slate-300"}`}>中文</button>
          <button onClick={() => setLang("en")} className={`px-2.5 py-1 rounded-full font-semibold ${lang==="en" ? "bg-amber-500 text-slate-900" : "text-slate-300"}`}>EN</button>
        </div>
      </div>

      {role === "bo" && !boAuthed && <LoginGate role="bo" onLoggedIn={() => setBoAuthed(true)} />}
      {role === "bo" && boAuthed && (
        <div className="flex">
          <div className="w-56 bg-white border-r border-slate-200 min-h-screen p-4">
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="font-bold text-slate-800">華騰工程行</div>
              <button onClick={() => setBoAuthed(false)} className="text-[11px] text-slate-400 hover:text-slate-600">{t("登出","Log out")}</button>
            </div>
            <div className="space-y-1">
              {NAV.map(([k, l, Icon]) => (
                <button key={k} onClick={() => { setBoPage(k); setSelectedJob(null); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold ${boPage===k && !selectedJob ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-50"}`}>
                  <Icon size={16}/>{l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 p-6">
            {selectedJob ? (
              <JobDetail job={selectedJob} back={() => setSelectedJob(null)} asWorker={false} />
            ) : (
              <>
                {boPage === "pipeline" && <PipelineDashboard openJob={setSelectedJob} />}
                {boPage === "schedule" && <ScheduleView />}
                {boPage === "jobs" && <JobList openJob={setSelectedJob} />}
                {boPage === "customers" && <CustomersPage />}
                {boPage === "team" && <TeamPage />}
                {boPage === "materials" && <MaterialsPage />}
                {boPage === "insights" && <InsightsPage />}
              </>
            )}
          </div>
        </div>
      )}

      {role === "worker" && !workerAuthed && <LoginGate role="worker" onLoggedIn={() => setWorkerAuthed(true)} />}
      {role === "worker" && workerAuthed && (
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex justify-end mb-2"><button onClick={() => setWorkerAuthed(false)} className="text-[11px] text-slate-400 hover:text-slate-600">{t("登出","Log out")}</button></div>
          {selectedJob ? <JobDetail job={selectedJob} back={() => setSelectedJob(null)} asWorker={true} /> : <WorkerJobs openJob={setSelectedJob} />}
        </div>
      )}

      {role === "customer" && (
        <div>
          <div className="flex justify-center gap-2 pt-4">
            <button onClick={() => setCustomerView("signup")} className={`text-xs px-3 py-1 rounded-full ${customerView==="signup" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>{t("QR 註冊畫面","QR Signup Screen")}</button>
            <button onClick={() => setCustomerView("portal")} className={`text-xs px-3 py-1 rounded-full ${customerView==="portal" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>{t("已註冊帳戶畫面","Logged-in Portal")}</button>
          </div>
          {customerView === "signup" ? <CustomerSignup /> : <CustomerPortal />}
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}
