const base = "http://localhost:3100";
const checks = [
  ["/", 200, "入門版"],
  ["/auth/login", 200, null],
  ["/auth/signup", 200, "統一編號"],
  ["/legal/terms", 200, "服務條款"],
  ["/s/bad-token", 200, "連結已失效"],
  ["/invite/bogus", 200, "邀請連結無效"],
  ["/c/bogus", 200, "連結已失效"],
  ["/pay/00000000-0000-0000-0000-000000000000", 200, "無法付款"],
];
let fail = 0;
for (const [path, wantStatus, needle] of checks) {
  const res = await fetch(base + path, { redirect: "manual" });
  const body = await res.text();
  const ok = res.status === wantStatus && (!needle || body.includes(needle));
  console.log(`${ok ? "✓" : "✗"} ${res.status} ${path}${needle ? ` (${needle})` : ""}`);
  if (!ok) fail++;
}
// auth gating
for (const path of ["/bo/pipeline", "/portal", "/worker/jobs"]) {
  const res = await fetch(base + path, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const ok = res.status >= 300 && res.status < 400 && loc.includes("/auth/login");
  console.log(`${ok ? "✓" : "✗"} ${path} → ${res.status} ${loc}`);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
