import { useEffect, useState } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import ArticleCard from '@/components/ArticleCard';

interface Article {
  id: number;
  documentId: string;
  title: string;
  description: string;
  publishedAt: string;
}

function ArticlesListPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_HOST}/api/v1/strapi/articles`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      console.log("API Response:", result); // Debug log
      setArticles(result.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching articles:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  if (loading) {
    return (
      <PublicLayout>
        <div className="container mx-auto p-6">
          <p>Loading articles...</p>
        </div>
      </PublicLayout>
    );
  }

  if (error) {
    return (
      <PublicLayout>
        <div className="container mx-auto p-6">
          <p>Error: {error}</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Articles</h1>
        
        {!articles || articles.length === 0 ? (
          <p>No articles found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                id={article.documentId.toString()}
                title={article.title}
                excerpt={article.description}
                publishedAt={article.publishedAt}
              />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default ArticlesListPage;
