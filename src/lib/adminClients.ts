import { supabase } from "@/integrations/supabase/client";
import type { ClientProject, InvoiceOrder, ProjectInput } from "@/lib/clientProjects";

export type AdminClient = { id: string; email: string; name: string; company: string; phone: string; created_at: string; projects: number; orders: number; spent: number };
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-clients", { body });
  if (error) throw new Error("Impossible de charger ou d’enregistrer les données du client.");
  if (data.error) throw new Error(data.error);
  return data as T;
}
export const listAdminClients = () => call<{ clients: AdminClient[] }>({ action: "list" });
export const getAdminClient = (id: string) => call<{ projects: ClientProject[]; orders: InvoiceOrder[] }>({ action: "detail", client_id: id });
export async function saveAdminProject(clientId: string, input: ProjectInput, projectId?: string) {
  return (await call<{ project: ClientProject }>({ action: "save_project", client_id: clientId, input, project_id: projectId })).project;
}
export const assignAdminOrder = (clientId: string, orderId: string, projectId: string | null) => call({ action: "assign", client_id: clientId, order_id: orderId, project_id: projectId });