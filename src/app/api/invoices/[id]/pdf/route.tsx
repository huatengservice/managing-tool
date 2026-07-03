import path from "path";
import { NextResponse } from "next/server";
import {
  Document, Font, Page, StyleSheet, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, QuoteLineItem } from "@/lib/types";

export const runtime = "nodejs";

// CJK support: business data (names, descriptions) is Traditional Chinese.
Font.register({
  family: "NotoSansTC",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSansTC-Regular.otf"),
});

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansTC", fontSize: 10, padding: 40, color: "#1e293b" },
  company: { fontSize: 14, fontWeight: 700 },
  title: { fontSize: 18, marginTop: 6 },
  meta: { color: "#64748b", marginTop: 2 },
  table: { marginTop: 18 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 5,
  },
  colItem: { flex: 1 },
  colNum: { width: 70, textAlign: "right" },
  totalRow: { flexDirection: "row", marginTop: 8 },
  totalLabel: { flex: 1, textAlign: "right", fontSize: 12 },
  totalValue: { width: 90, textAlign: "right", fontSize: 12 },
  paidBadge: { marginTop: 14, color: "#059669" },
  unpaidBadge: { marginTop: 14, color: "#b45309" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, color: "#cbd5e1", fontSize: 8 },
});

/**
 * Server-side PDF for an invoice/receipt (spec §3.6). Auth: the RLS-scoped
 * read below returns nothing unless the requester (BO or that customer)
 * can see the invoice.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, jobs(description, code, customers(name, address)), companies(name, tax_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });

  const inv = data as unknown as Invoice & {
    jobs: { description: string; code: string; customers: { name: string; address: string } };
    companies: { name: string; tax_id: string | null };
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

  const pdf = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.company}>{inv.companies.name}</Text>
        {inv.companies.tax_id && <Text style={styles.meta}>統一編號：{inv.companies.tax_id}</Text>}
        <Text style={styles.title}>
          {inv.type === "einvoice" ? "電子發票 E-Invoice" : "收據 Receipt"}
        </Text>
        <Text style={styles.meta}>
          單號：{inv.number}
          {inv.einvoice_number ? `　發票號碼：${inv.einvoice_number}` : ""}
        </Text>
        <Text style={styles.meta}>
          客戶：{inv.jobs.customers.name}　案件：{inv.jobs.code} {inv.jobs.description}
        </Text>
        <Text style={styles.meta}>
          開立日期:{new Date(inv.issued_at).toLocaleDateString("zh-TW")}
        </Text>

        <View style={styles.table}>
          <View style={[styles.row, { borderBottomColor: "#cbd5e1" }]}>
            <Text style={styles.colItem}>項目</Text>
            <Text style={styles.colNum}>數量</Text>
            <Text style={styles.colNum}>單價</Text>
            <Text style={styles.colNum}>小計</Text>
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
              <Text style={styles.colItem}>工程服務</Text>
              <Text style={styles.colNum}>1</Text>
              <Text style={styles.colNum}>{money(inv.amount)}</Text>
              <Text style={styles.colNum}>{money(inv.amount)}</Text>
            </View>
          )}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>總計 Total：</Text>
          <Text style={styles.totalValue}>{money(inv.amount)}</Text>
        </View>

        <Text style={inv.status === "paid" ? styles.paidBadge : styles.unpaidBadge}>
          {inv.status === "paid"
            ? `已付款 PAID${inv.paid_at ? `（${new Date(inv.paid_at).toLocaleDateString("zh-TW")}）` : ""}`
            : "尚未付款 UNPAID"}
        </Text>

        <Text style={styles.footer}>
          本文件由系統產生。此份文件不含照片之時間與位置中繼資料。 Generated document;
          contains no photo timestamp/location metadata.
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
