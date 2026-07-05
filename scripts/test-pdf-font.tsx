/** Sanity check: fontkit must accept the bundled Noto Sans TC OTF and render CJK. */
import path from "path";
import React from "react";
import { Document, Font, Page, Text, renderToBuffer } from "@react-pdf/renderer";

Font.register({
  family: "NotoSansTC",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSansTC-Regular.otf"),
});

async function main() {
  const buf = await renderToBuffer(
    <Document>
      <Page size="A4" style={{ fontFamily: "NotoSansTC", fontSize: 12 }}>
        <Text>華騰工程行 電子發票測試 NT$1,800 浴室水龍頭漏水，需更換零件</Text>
      </Page>
    </Document>
  );
  console.log("PDF bytes:", buf.length, buf.slice(0, 5).toString() === "%PDF-" ? "valid PDF header" : "INVALID");
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
