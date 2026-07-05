import path from "path";
import { NextResponse } from "next/server";
import {
  Document, Font, Page, StyleSheet, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { zhAmount } from "@/lib/zh-amount";
import type { Invoice, QuoteLineItem } from "@/lib/types";

export const runtime = "nodejs";

// CJK support: business data (names, descriptions) is Traditional Chinese.
Font.register({
  family: "NotoSansTC",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSansTC-Regular.otf"),
});

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansTC", fontSize: 10, padding: 44, color: "#1e293b" },
  title: { fontSize: 20, textAlign: "center", letterSpacing: 8 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#64748b", marginTop: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  metaText: { color: "#334155" },
  box: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, padding: 10, marginTop: 10 },
  boxTitle: { fontSize: 8, color: "#94a3b8", marginBottom: 4 },
  partyLine: { marginTop: 2 },
  table: { marginTop: 14 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
  },
  headRow: { borderBottomColor: "#94a3b8" },
  colItem: { flex: 1 },
  colNum: { width: 70, textAlign: "right" },
  totalBlock: { marginTop: 12, alignItems: "flex-end" },
  totalDigits: { fontSize: 13 },
  totalZh: { fontSize: 10, color: "#334155", marginTop: 3 },
  statusLine: { marginTop: 14, fontSize: 11 },
  paid: { color: "#059669" },
  unpaid: { color: "#b45309" },
  stampRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  stampBox: {
    width: 150,
    height: 80,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
  },
  stampLabel: { fontSize: 8, color: "#94a3b8" },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, color: "#cbd5e1", fontSize: 7.5, textAlign: "center" },
});

/**
 * 免用統一發票收據 — the billing document for a small-scale business
 * (小規模營業人) that doesn't issue 統一發票. Carries the conventional
 * fields: receipt no./date, seller block (名稱/統編/地址/電話), buyer
 * (+optional 統編), itemized lines, total in digits AND capital Chinese
 * numerals (大寫), payment status, and a stamp area (蓋章欄).
 *
 * Auth: the RLS-scoped read returns nothing unless the requester (BO or
 * that customer) can see the invoice.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "*, jobs(description, code, customers(name, address)), companies(name, tax_id, address, phone)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });

  const inv = data as unknown as Invoice & {
    jobs: { description: string; code: string; customers: { name: string; address: string } };
    companies: { name: string; tax_id: string | null; address: string; phone: string };
  };

  let items: QuoteLineItem[] = [];
  if (inv.quote_id) {
    const { data: lineItems } = await supabase
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", inv.quote_id)
      .order("position");
    items = (lineItems ?? []) as QuoteLineItem[];
  }

  const money = (n: number) => `NT$${Math.round(n).toLocaleString()}`;
  const dateZh = (d: string) => {
    const dt = new Date(d);
    return `中華民國 ${dt.getFullYear() - 1911} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
  };
  const seller = inv.companies;

  const pdf = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>收　據</Text>
        <Text style={styles.subtitle}>（免用統一發票）</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>收據編號：{inv.number}</Text>
          <Text style={styles.metaText}>開立日期：{dateZh(inv.issued_at)}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>出具收據商號（賣方）</Text>
          <Text style={styles.partyLine}>商號名稱：{seller.name}</Text>
          {seller.tax_id && <Text style={styles.partyLine}>統一編號：{seller.tax_id}</Text>}
          {seller.address && <Text style={styles.partyLine}>地　　址：{seller.address}</Text>}
          {seller.phone && <Text style={styles.partyLine}>電　　話：{seller.phone}</Text>}
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>買受人</Text>
          <Text style={styles.partyLine}>客戶名稱：{inv.jobs.customers.name}</Text>
          {inv.buyer_ubn && <Text style={styles.partyLine}>統一編號：{inv.buyer_ubn}</Text>}
          <Text style={styles.partyLine}>
            工程案件：{inv.jobs.code}　{inv.jobs.description}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={styles.colItem}>品名／施工項目</Text>
            <Text style={styles.colNum}>數量</Text>
            <Text style={styles.colNum}>單價</Text>
            <Text style={styles.colNum}>金額</Text>
          </View>
          {items.map((li) => (
            <View key={li.id} style={styles.row}>
              <Text style={styles.colItem}>{li.description}</Text>
              <Text style={styles.colNum}>{li.qty}</Text>
              <Text style={styles.colNum}>{money(li.unit_price)}</Text>
              <Text style={styles.colNum}>{money(li.qty * li.unit_price)}</Text>
            </View>
          ))}
          {items.length === 0 && (
            <View style={styles.row}>
              <Text style={styles.colItem}>工程施工費用</Text>
              <Text style={styles.colNum}>1</Text>
              <Text style={styles.colNum}>{money(inv.amount)}</Text>
              <Text style={styles.colNum}>{money(inv.amount)}</Text>
            </View>
          )}
        </View>

        <View style={styles.totalBlock}>
          <Text style={styles.totalDigits}>合計：{money(inv.amount)}</Text>
          <Text style={styles.totalZh}>新臺幣（大寫）：{zhAmount(inv.amount)}</Text>
        </View>

        <Text style={[styles.statusLine, inv.status === "paid" ? styles.paid : styles.unpaid]}>
          {inv.status === "paid"
            ? `✓ 已收訖${
                inv.payment_method === "card" ? "（信用卡）" : inv.payment_method === "transfer" ? "（轉帳）" : "（現金）"
              }${inv.paid_at ? `　${dateZh(inv.paid_at)}` : ""}`
            : "尚未收款"}
        </Text>

        <View style={styles.stampRow}>
          <View style={styles.stampBox}>
            <Text style={styles.stampLabel}>商號印章（大小章）</Text>
          </View>
          <View style={styles.stampBox}>
            <Text style={styles.stampLabel}>經手人簽章</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          本收據由系統開立，明細與雙方簽署紀錄保存於系統內。此文件不含照片之時間與位置中繼資料。
        </Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdf);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.number}.pdf"`,
    },
  });
}
