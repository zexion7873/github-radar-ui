import { fetchBlog } from "@/lib/data";
import { TABLES } from "@/lib/config";
import BlogList from "@/components/BlogList";
import { DataError } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await fetchBlog(TABLES.blog);
  if (!result.ok) return <DataError error={result.error} />;
  return <BlogList rows={result.rows} />;
}
