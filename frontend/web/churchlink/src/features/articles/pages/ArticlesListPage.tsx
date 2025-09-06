import { useEffect, useState } from 'react';
import Layout from '@/shared/layouts/Layout';
import ArticleCard from '../components/ArticleCard';
import api from '@/api/api';

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
      const response = await api.get("/v1/strapi/articles");
      setArticles(response.data.data);
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
      <Layout>
        <div className="container mx-auto p-6">
          <p>Loading articles...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <p>Error: {error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
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
    </Layout>
  );
}

export default ArticlesListPage;
