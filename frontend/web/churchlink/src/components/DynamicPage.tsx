import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // Import useLocation to capture the full path

export interface Page {
  id: number;
  title: string;
  content: string;
  slug: string;
}

const DynamicPage: React.FC = () => {
  const location = useLocation(); // Use useLocation to get the full path
  const slug = location.pathname.replace(/^\/|\/$/g, ''); // Capture full path and remove the leading and trailing slashes
  console.log("Captured slug:", slug); // Log the captured slug

  const [pageData, setPageData] = useState<Page | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Invalid slug');
      setLoading(false);
      return;
    }

    const fetchPageData = async () => {
      try {
        const encodedSlug = encodeURIComponent(slug);
        const apiUrl = import.meta.env.VITE_STRAPI_URL;
        if (!apiUrl) {
          throw new Error('API URL is not defined in the environment variables');
        }
        const response = await fetch(`${apiUrl}/api/dynamic-pages?filters[slug][$eq]=${encodedSlug}`);
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();

        if (data.data && data.data.length > 0) {
          setPageData(data.data[0]); // Set the page data
        } else {
          setError('Page not found'); // Handle page not found
        }
      } catch {
        setError('Error fetching page data');
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();
  }, [slug]);

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-semibold mb-4">{pageData?.title}</h1>
      <div className="prose">{pageData?.content}</div>
    </div>
  );
};

export default DynamicPage;
