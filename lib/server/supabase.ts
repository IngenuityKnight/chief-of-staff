import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null | undefined;

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "";
}

export function getSupabaseUrl() {
  return firstDefined(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getSupabaseAdmin() {
  if (adminClient !== undefined) return adminClient;

  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    adminClient = null;
    return adminClient;
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

export function getN8nIntakeWebhookUrl() {
  return process.env.N8N_INTAKE_WEBHOOK_URL ?? process.env.N8N_INTAKE_WEBHOOK ?? "";
}

export function getN8nWebhookSecret() {
  return process.env.N8N_WEBHOOK_SECRET ?? "";
}

export function isN8nConfigured() {
  return Boolean(getN8nIntakeWebhookUrl());
}
