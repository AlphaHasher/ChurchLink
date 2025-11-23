import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

function stripLeadingTitle(md: string, title: string): string {
  if (!md || !title) return md;

  // Find first non-empty line
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;

  if (i >= lines.length) return md;

  // If that line is a markdown heading and matches the title, remove it
  const first = lines[i].trim();

  // Matches "# Title", "## Title", up to "###### Title"
  const m = first.match(/^#{1,6}\s+(.+)$/);
  if (!m) return md;

  const headingText = m[1].trim();

  // Compare case-insensitively
  if (headingText.toLowerCase() === title.trim().toLowerCase()) {
    // Drop that line (and an immediate blank line after it if present)
    const next = i + 1;
    if (next < lines.length && lines[next].trim() === "") {
      lines.splice(i, 2);
    } else {
      lines.splice(i, 1);
    }
    return lines.join("\n");
  }

  return md;
}

export default function LegalPage({ slug }: { slug: string }) {
  const [data, setData] = useState<{
    title: string;
    content_markdown: string;
  } | null>(null);

  useEffect(() => {
    axios.get(`/api/v1/legal/${slug}`).then((res) => setData(res.data));
  }, [slug]);

  if (!data) return <p>Loading...</p>;

  const cleaned = stripLeadingTitle(data.content_markdown || "", data.title);

  return (
    <div className="p-8 prose max-w-3xl mx-auto">
      {/* Keep one page title */}
      <h1>{data.title}</h1>
      <ReactMarkdown>{cleaned}</ReactMarkdown>
    </div>
  );
}