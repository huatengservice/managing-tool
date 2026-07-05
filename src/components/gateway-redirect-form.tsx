"use client";

import { useEffect, useRef } from "react";

/** Auto-submitting POST form that hands the browser to the NewebPay gateway. */
export function GatewayRedirectForm({
  action,
  fields,
  label,
}: {
  action: string;
  fields: Record<string, string>;
  label: string;
}) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.submit();
  }, []);

  return (
    <form ref={ref} method="POST" action={action} className="text-center">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <p className="text-sm text-slate-500 mb-4">{label}</p>
      <button className="bg-slate-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl">
        {label}
      </button>
    </form>
  );
}
