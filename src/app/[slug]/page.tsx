import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPracticeBySlug, getPublishedSnapshot } from "@/lib/db/repo";
import { DisplayClient } from "@/components/display/DisplayClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const practice = await getPracticeBySlug(slug);
  return {
    title: practice ? practice.name : "Display",
    robots: { index: false, follow: false },
  };
}

export default async function DisplayPage({ params }: Props) {
  const { slug } = await params;
  const practice = await getPracticeBySlug(slug);
  if (!practice) notFound();

  const snapshot = await getPublishedSnapshot(slug);
  return (
    <DisplayClient
      slug={slug}
      name={practice.name}
      initialSnapshot={snapshot ?? null}
    />
  );
}
