import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export interface Page {
  id: number;
  title: string;
  content: string;
  slug: string;
}

const DynamicPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>(); // Get the slug from the URL
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
        const response = await fetch(`http://localhost:1339/api/dynamic-pages?filters[slug][$eq]=${slug}`); // Correct API URL
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
