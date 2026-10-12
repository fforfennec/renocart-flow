import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClientProject = Database["public"]["Tables"]["client_projects"]["Row"];
export type ProjectInput = Pick<ClientProject, "name" | "code" | "address1" | "city" | "province" | "postal_code" | "contact_name" | "contact_phone" | "notes">;
export type InvoiceItem = { id: string; name: string; variant_title: string | null; sku: string | null; quantity: number; unit_price: number | null };
export type InvoiceOrder = {
  id: string; order_number: string; created_at: string; client_name: string; client_address: string; status: string;
  project_id: string | null; project_name: string | null; project_code: string | null;
  subtotal_price: number | null; total_tax: number | null; shipping_price_total: number | null; total_price: number | null; currency: string | null;
  order_items: InvoiceItem[];
};

export const emptyProject: ProjectInput = { name: "", code: "", address1: "", city: "", province: "QC", postal_code: "", contact_name: "", contact_phone: "", notes: "" };

export async function listProjects(): Promise<ClientProject[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("client_projects").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const clean = (p: ProjectInput) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, typeof v === "string" ? (v.trim() || null) : v])) as ProjectInput;

export async function saveProject(input: ProjectInput, id?: string): Promise<ClientProject> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Connecte-toi d'abord.");
  const v = clean(input);
  if (!v.name || !v.code) throw new Error("Le nom et le code du projet sont obligatoires.");
  const q = id
    ? supabase.from("client_projects").update(v).eq("id", id).select().single()
    : supabase.from("client_projects").insert({ ...v, name: v.name, code: v.code, owner_id: user.id }).select().single();
  const { data, error } = await q;
  if (error) throw new Error(error.code === "23505" ? "Ce code de projet existe déjà." : error.message);
  return data;
}

export async function listInvoices(): Promise<InvoiceOrder[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return [];
  const { data, error } = await supabase.from("orders")
    .select("id, order_number, created_at, client_name, client_address, status, project_id, project_name, project_code, subtotal_price, total_tax, shipping_price_total, total_price, currency, order_items(id, name, variant_title, sku, quantity, unit_price)")
    .ilike("customer_email", user.email)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceOrder[];
}

export async function assignOrder(orderId: string, projectId: string | null) {
  const { error } = await supabase.rpc("assign_order_project", { _order_id: orderId, _project_id: projectId as string });
  if (error) throw error;
}

export const money = (n: number | null | undefined, cur = "CAD") =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: cur || "CAD" }).format(n);

export const projectAddress = (p: Pick<ClientProject, "address1" | "city" | "province" | "postal_code">) =>
  [p.address1, p.city, p.province, p.postal_code].filter(Boolean).join(", ");

export function totals(orders: InvoiceOrder[]) {
  const spent = orders.reduce((s, o) => s + (o.total_price ?? 0), 0);
  const subtotal = orders.reduce((s, o) => s + (o.subtotal_price ?? 0), 0);
  const tax = orders.reduce((s, o) => s + (o.total_tax ?? 0), 0);
  const map = new Map<string, { name: string; quantity: number; amount: number }>();
  for (const o of orders) for (const i of o.order_items) {
    const k = `${i.name}`;
    const cur = map.get(k) ?? { name: i.name, quantity: 0, amount: 0 };
    cur.quantity += i.quantity; cur.amount += (i.unit_price ?? 0) * i.quantity;
    map.set(k, cur);
  }
  const materials = [...map.values()].sort((a, b) => b.quantity - a.quantity);
  return { spent, subtotal, tax, materials, units: materials.reduce((s, m) => s + m.quantity, 0), missingPrices: orders.some((o) => o.total_price == null) };
}

function invoicePdf(o: InvoiceOrder): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const cur = o.currency || "CAD";
  const W = doc.internal.pageSize.getWidth();
  let y = 56;
  doc.setFont("helvetica", "bold").setFontSize(22).text("RENOCART", 48, y);
  doc.setFontSize(14).text("FACTURE", W - 48, y, { align: "right" });
  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Commande #${o.order_number}`, W - 48, y, { align: "right" });
  doc.text(new Date(o.created_at).toLocaleDateString("fr-CA"), W - 48, y + 14, { align: "right" });
  y += 40;
  doc.setFont("helvetica", "bold").text("Livré à", 48, y);
  doc.setFont("helvetica", "normal").text(doc.splitTextToSize(`${o.client_name}\n${o.client_address}`, 260), 48, y + 14);
  if (o.project_name) {
    doc.setFont("helvetica", "bold").text("Projet", W / 2 + 20, y);
    doc.setFont("helvetica", "normal").text([o.project_name, `Code : ${o.project_code ?? "—"}`], W / 2 + 20, y + 14);
  }
  y += 70;
  doc.setFillColor(240, 240, 240).rect(48, y - 12, W - 96, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Article", 54, y + 2); doc.text("Qté", W - 220, y + 2, { align: "right" });
  doc.text("Prix", W - 140, y + 2, { align: "right" }); doc.text("Total", W - 54, y + 2, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 24;
  for (const i of o.order_items) {
    const lines = doc.splitTextToSize(i.variant_title && !i.name.includes(i.variant_title) ? `${i.name} — ${i.variant_title}` : i.name, W - 330);
    if (y + lines.length * 12 > 700) { doc.addPage(); y = 56; }
    doc.text(lines, 54, y);
    doc.text(String(i.quantity), W - 220, y, { align: "right" });
    doc.text(money(i.unit_price, cur), W - 140, y, { align: "right" });
    doc.text(i.unit_price == null ? "—" : money(i.unit_price * i.quantity, cur), W - 54, y, { align: "right" });
    y += lines.length * 12 + 8;
  }
  y += 10; doc.line(W - 260, y, W - 48, y); y += 18;
  const row = (l: string, v: number | null, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(l, W - 220, y, { align: "right" }); doc.text(money(v, cur), W - 54, y, { align: "right" }); y += 16;
  };
  row("Sous-total", o.subtotal_price);
  if (o.shipping_price_total) row("Livraison", o.shipping_price_total);
  row("Taxes", o.total_tax);
  row("Total", o.total_price, true);
  if (o.total_price == null) {
    doc.setFont("helvetica", "italic").setFontSize(9).text("Prix non disponibles pour cette commande (importée avant l'ajout des factures).", 48, y + 16);
  }
  return doc;
}

const fileName = (o: InvoiceOrder) => `Facture-${o.order_number}${o.project_code ? `-${o.project_code}` : ""}.pdf`.replace(/[^\w.-]+/g, "_");

export function downloadInvoice(o: InvoiceOrder) { invoicePdf(o).save(fileName(o)); }

export async function downloadInvoicesZip(orders: InvoiceOrder[], zipName: string) {
  const zip = new JSZip();
  for (const o of orders) zip.file(fileName(o), invoicePdf(o).output("arraybuffer"));
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${zipName.replace(/[^\w.-]+/g, "_")}.zip`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
