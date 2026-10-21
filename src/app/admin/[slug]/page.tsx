import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPracticeWithSlides } from "@/lib/db/repo";
import { getSession } from "@/lib/session";
import { EditorClient } from "@/components/admin/editor/EditorClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const practice = await getPracticeWithSlides(slug);
  if (!practice) return { title: "Not found" };
  return { title: `Edit ${practice.name || practice.slug}` };
}

export default async function EditorPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const practice = await getPracticeWithSlides(slug);
  if (!practice) notFound();
  // Canonical base for copyable links (falls back to the browser origin).
  const siteUrl = (process.env.SITE_URL ?? "").trim().replace(/\/$/, "");
  return <EditorClient practice={practice} siteUrl={siteUrl} />;
}
