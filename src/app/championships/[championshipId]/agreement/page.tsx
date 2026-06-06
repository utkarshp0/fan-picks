import { ChampionshipRoutePage } from "@/components/championship/pages/championship-route-page";

type PageProps = {
  params: Promise<{ championshipId: string }>;
};

export default async function AgreementPage({ params }: PageProps) {
  const { championshipId } = await params;

  return <ChampionshipRoutePage championshipId={championshipId} page="agreement" />;
}
