export interface NHTSARecall {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
}

export async function getRecalls(make: string, model: string, year: number): Promise<NHTSARecall[]> {
  try {
    const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results ?? []).map((r: any) => ({
      campaignNumber: r.NHTSACampaignNumber ?? "",
      component: r.Component ?? "",
      summary: r.Summary ?? "",
      consequence: r.Consequence ?? "",
      remedy: r.Remedy ?? "",
    }));
  } catch {
    return [];
  }
}
