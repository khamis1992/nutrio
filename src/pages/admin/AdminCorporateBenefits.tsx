import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, FileText, Loader2, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminEmptyState,
  AdminKpiStrip,
  AdminPanel,
  AdminPanelHeader,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";

interface Organization {
  id: string;
  name: string;
  status: "draft" | "active" | "suspended" | "closed";
  billing_model: "per_redeemed_meal" | "fixed_allowance";
  default_monthly_meal_allowance: number;
  sponsor_rate_per_meal: number;
  contract_reference: string | null;
  membership_count: number;
  active_members: number;
  created_at: string;
  starts_on: string | null;
  ends_on: string | null;
}

interface SponsorAggregate {
  redeemed_meals?: number;
  reversed_meals?: number;
  consented_redeemed_meals?: number;
  sponsor_amount?: number;
}

type Rpc = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message?: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;

const initialOrganization = {
  name: "",
  status: "draft" as Organization["status"],
  billingModel: "per_redeemed_meal" as Organization["billing_model"],
  allowance: 20,
  rate: 0,
  contractReference: "",
};

export default function AdminCorporateBenefits() {
  const featureEnabled = isPhaseOneFeatureEnabled("corporateBenefits");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationForm, setOrganizationForm] = useState(initialOrganization);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberAllowance, setMemberAllowance] = useState(20);
  const [sponsorUserId, setSponsorUserId] = useState("");
  const [aggregate, setAggregate] = useState<SponsorAggregate | null>(null);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      if (!featureEnabled) return;
      const { data, error } = await rpc<unknown>("admin_list_corporate_organizations");
      if (error) throw new Error(error.message || "Could not load organizations");
      setOrganizations(Array.isArray(data) ? data as Organization[] : []);
    } catch (error) {
      console.error("Could not load corporate organizations:", error);
      toast.error(error instanceof Error ? error.message : "Could not load organizations");
    } finally {
      setLoading(false);
    }
  }, [featureEnabled]);

  useEffect(() => { void loadOrganizations(); }, [loadOrganizations]);

  const selectedOrganization = organizations.find((item) => item.id === selectedOrganizationId) ?? null;
  const totals = useMemo(() => ({
    active: organizations.filter((item) => item.status === "active").length,
    members: organizations.reduce((sum, item) => sum + item.membership_count, 0),
    activeMembers: organizations.reduce((sum, item) => sum + item.active_members, 0),
  }), [organizations]);

  if (!featureEnabled) {
    return (
      <AdminLayout title="Corporate Benefits" subtitle="Feature rollout is disabled">
        <div className="bg-[#F6F8FB] p-5"><AdminEmptyState icon={ShieldCheck} title="Corporate benefits are not enabled" description="Apply and verify migration 20260720247000, then enable competitive-corporate-benefits for the approved cohort." /></div>
      </AdminLayout>
    );
  }

  const createOrganization = async () => {
    if (organizationForm.name.trim().length < 2) {
      toast.error("Enter an organization name");
      return;
    }
    setSaving(true);
    try {
      const { error } = await rpc<string>("admin_upsert_corporate_organization", {
        p_organization_id: null,
        p_name: organizationForm.name.trim(),
        p_status: organizationForm.status,
        p_billing_model: organizationForm.billingModel,
        p_default_monthly_meal_allowance: organizationForm.allowance,
        p_sponsor_rate_per_meal: organizationForm.rate,
        p_contract_reference: organizationForm.contractReference.trim() || null,
        p_starts_on: null,
        p_ends_on: null,
      });
      if (error) throw new Error(error.message || "Could not create organization");
      toast.success("Organization created");
      setOrganizationForm(initialOrganization);
      await loadOrganizations();
    } catch (error) {
      console.error("Could not create corporate organization:", error);
      toast.error(error instanceof Error ? error.message : "Could not create organization");
    } finally { setSaving(false); }
  };

  const assignMember = async () => {
    if (!selectedOrganization || !memberUserId.trim()) return;
    setSaving(true);
    try {
      const { error } = await rpc<string>("admin_set_corporate_membership", {
        p_organization_id: selectedOrganization.id,
        p_user_id: memberUserId.trim(),
        p_status: "eligible",
        p_eligible_from: new Date().toISOString().slice(0, 10),
        p_eligible_until: null,
        p_monthly_meal_allowance: memberAllowance,
        p_eligibility_reference_hash: null,
      });
      if (error) throw new Error(error.message || "Could not assign member");
      toast.success("Employee eligibility created");
      setMemberUserId("");
      await loadOrganizations();
    } catch (error) {
      console.error("Could not assign corporate member:", error);
      toast.error(error instanceof Error ? error.message : "Could not assign member");
    } finally { setSaving(false); }
  };

  const setOrganizationStatus = async (status: Organization["status"]) => {
    if (!selectedOrganization) return;
    setSaving(true);
    try {
      const { error } = await rpc<string>("admin_upsert_corporate_organization", {
        p_organization_id: selectedOrganization.id,
        p_name: selectedOrganization.name,
        p_status: status,
        p_billing_model: selectedOrganization.billing_model,
        p_default_monthly_meal_allowance: selectedOrganization.default_monthly_meal_allowance,
        p_sponsor_rate_per_meal: selectedOrganization.sponsor_rate_per_meal,
        p_contract_reference: selectedOrganization.contract_reference,
        p_starts_on: selectedOrganization.starts_on,
        p_ends_on: selectedOrganization.ends_on,
      });
      if (error) throw new Error(error.message || "Could not update organization");
      toast.success(`Organization ${status}`);
      await loadOrganizations();
    } catch (error) {
      console.error("Could not update corporate organization:", error);
      toast.error(error instanceof Error ? error.message : "Could not update organization");
    } finally { setSaving(false); }
  };

  const assignSponsorAdmin = async () => {
    if (!selectedOrganization || !sponsorUserId.trim()) return;
    setSaving(true);
    try {
      const { error } = await rpc<boolean>("admin_set_corporate_sponsor_admin", {
        p_organization_id: selectedOrganization.id,
        p_user_id: sponsorUserId.trim(),
        p_role: "sponsor_admin",
      });
      if (error) throw new Error(error.message || "Could not assign sponsor admin");
      toast.success("Sponsor administrator assigned");
      setSponsorUserId("");
    } catch (error) {
      console.error("Could not assign sponsor administrator:", error);
      toast.error(error instanceof Error ? error.message : "Could not assign sponsor admin");
    } finally { setSaving(false); }
  };

  const loadAggregate = async (organizationId: string) => {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    try {
      const { data, error } = await rpc<SponsorAggregate>("get_corporate_sponsor_aggregate", {
        p_organization_id: organizationId,
        p_period_start: periodStart,
        p_period_end: now.toISOString().slice(0, 10),
      });
      if (error) throw new Error(error.message || "Could not load aggregate");
      setAggregate(data ?? null);
    } catch (error) {
      console.error("Could not load sponsor aggregate:", error);
      setAggregate(null);
    }
  };

  const generateInvoice = async () => {
    if (!selectedOrganization) return;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    setSaving(true);
    try {
      const { error } = await rpc<string>("admin_generate_corporate_invoice", {
        p_organization_id: selectedOrganization.id,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });
      if (error) throw new Error(error.message || "Could not generate invoice");
      toast.success("Previous-month invoice draft generated");
    } catch (error) {
      console.error("Could not generate sponsor invoice:", error);
      toast.error(error instanceof Error ? error.message : "Could not generate invoice");
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout title="Corporate Benefits" subtitle="Eligibility, sponsored meals, privacy, and billing">
      <div className="space-y-5 bg-[#F6F8FB] p-3 text-[#020617] sm:p-5">
        <AdminWorkbenchHeader
          eyebrow="B2B operations"
          title="Corporate benefit control"
          description="Manage eligibility and sponsor billing without exposing employee meals, goals, or health records. All privileged actions require an elevated admin session."
          icon={Building2}
          accent="#38BDF8"
          actions={<Button type="button" variant="outline" onClick={() => void loadOrganizations()} disabled={loading} className="min-h-11 rounded-lg border-[#E5EAF1] bg-white font-black"><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh</Button>}
        />
        <AdminKpiStrip items={[
          { label: "Organizations", value: organizations.length, helper: "All contract states", icon: Building2, accent: "#38BDF8" },
          { label: "Active", value: totals.active, helper: "Accepting benefits", icon: ShieldCheck, accent: "#22C7A1" },
          { label: "Eligible people", value: totals.members, helper: "No health data shown", icon: Users, accent: "#7C83F6" },
          { label: "Activated", value: totals.activeMembers, helper: "Customer consent recorded", icon: UserPlus, accent: "#FB6B7A" },
        ]} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <AdminPanel>
            <AdminPanelHeader title="Organizations" eyebrow="Privacy-isolated contracts" description="Select an organization to manage employee eligibility and billing." />
            {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#38BDF8]" /></div> : organizations.length === 0 ? <AdminEmptyState icon={Building2} title="No organizations yet" description="Create a draft contract from the operations panel." /> : (
              <div className="divide-y divide-[#E5EAF1]">
                {organizations.map((organization) => (
                  <button key={organization.id} type="button" onClick={() => { setSelectedOrganizationId(organization.id); setMemberAllowance(organization.default_monthly_meal_allowance); void loadAggregate(organization.id); }} className={cn("flex min-h-20 w-full items-center gap-3 p-4 text-left active:bg-[#F6F8FB]", selectedOrganizationId === organization.id && "bg-[#EAF8FF]")}> 
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white text-[#38BDF8] ring-1 ring-[#E5EAF1]"><Building2 className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{organization.name}</span><span className="mt-1 block text-xs font-semibold text-[#64748B]">{organization.membership_count} eligible · {organization.active_members} active · {organization.default_monthly_meal_allowance}/month</span></span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase", organization.status === "active" ? "bg-[#E9FBF6] text-[#0A8F73]" : "bg-[#F6F8FB] text-[#64748B]")}>{organization.status}</span>
                  </button>
                ))}
              </div>
            )}
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel>
              <AdminPanelHeader title="New organization" eyebrow="Contract setup" />
              <div className="space-y-3 p-4">
                <div><Label htmlFor="corporate-name">Organization name</Label><Input id="corporate-name" value={organizationForm.name} onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 min-h-11 rounded-lg" /></div>
                <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="corporate-allowance">Meals/month</Label><Input id="corporate-allowance" type="number" min={0} max={200} value={organizationForm.allowance} onChange={(event) => setOrganizationForm((current) => ({ ...current, allowance: Number(event.target.value) }))} className="mt-1 min-h-11 rounded-lg" /></div><div><Label htmlFor="corporate-rate">Sponsor rate</Label><Input id="corporate-rate" type="number" min={0} step="0.01" value={organizationForm.rate} onChange={(event) => setOrganizationForm((current) => ({ ...current, rate: Number(event.target.value) }))} className="mt-1 min-h-11 rounded-lg" /></div></div>
                <div><Label htmlFor="corporate-reference">Contract reference</Label><Input id="corporate-reference" value={organizationForm.contractReference} onChange={(event) => setOrganizationForm((current) => ({ ...current, contractReference: event.target.value }))} className="mt-1 min-h-11 rounded-lg" /></div>
                <Button type="button" onClick={() => void createOrganization()} disabled={saving} className="min-h-12 w-full rounded-lg bg-[#020617] font-black text-white">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}Create draft</Button>
              </div>
            </AdminPanel>

            {selectedOrganization && <AdminPanel><AdminPanelHeader title={selectedOrganization.name} eyebrow="Selected organization" /><div className="space-y-4 p-4"><div className="grid grid-cols-3 gap-2 rounded-lg bg-[#F6F8FB] p-3 text-center"><div><p className="text-lg font-black">{aggregate?.redeemed_meals ?? 0}</p><p className="text-[9px] font-black uppercase text-[#94A3B8]">Redeemed</p></div><div><p className="text-lg font-black">{aggregate?.consented_redeemed_meals ?? 0}</p><p className="text-[9px] font-black uppercase text-[#94A3B8]">Consented</p></div><div><p className="text-lg font-black">{aggregate?.sponsor_amount ?? 0}</p><p className="text-[9px] font-black uppercase text-[#94A3B8]">Sponsor QAR</p></div></div><div className="grid grid-cols-2 gap-2"><Button type="button" onClick={() => void setOrganizationStatus(selectedOrganization.status === "active" ? "suspended" : "active")} disabled={saving} className={cn("min-h-11 rounded-lg font-black text-white", selectedOrganization.status === "active" ? "bg-[#FB6B7A]" : "bg-[#22C7A1]")}>{selectedOrganization.status === "active" ? "Suspend" : "Activate"}</Button><Button type="button" variant="outline" onClick={() => void loadAggregate(selectedOrganization.id)} className="min-h-11 rounded-lg border-[#E5EAF1] bg-white font-black"><RefreshCw className="mr-2 h-4 w-4" />Metrics</Button></div><div><Label htmlFor="corporate-user">Employee user ID</Label><Input id="corporate-user" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} placeholder="Supabase user UUID" className="mt-1 min-h-11 rounded-lg" /></div><div><Label htmlFor="member-allowance">Monthly allowance</Label><Input id="member-allowance" type="number" min={0} max={200} value={memberAllowance} onChange={(event) => setMemberAllowance(Number(event.target.value))} className="mt-1 min-h-11 rounded-lg" /></div><Button type="button" onClick={() => void assignMember()} disabled={saving || !memberUserId.trim()} className="min-h-11 w-full rounded-lg bg-[#7C83F6] font-black text-white"><UserPlus className="mr-2 h-4 w-4" />Add eligibility</Button><div className="border-t border-[#E5EAF1] pt-4"><Label htmlFor="sponsor-user">Sponsor administrator user ID</Label><Input id="sponsor-user" value={sponsorUserId} onChange={(event) => setSponsorUserId(event.target.value)} placeholder="Supabase user UUID" className="mt-1 min-h-11 rounded-lg" /><Button type="button" variant="outline" onClick={() => void assignSponsorAdmin()} disabled={saving || !sponsorUserId.trim()} className="mt-2 min-h-11 w-full rounded-lg border-[#E5EAF1] bg-white font-black"><ShieldCheck className="mr-2 h-4 w-4" />Assign sponsor admin</Button></div><Button type="button" variant="outline" onClick={() => void generateInvoice()} disabled={saving} className="min-h-11 w-full rounded-lg border-[#E5EAF1] bg-white font-black"><FileText className="mr-2 h-4 w-4" />Draft previous-month invoice</Button></div></AdminPanel>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
