import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/shared/layouts/Layout';
import api from '@/api/api';

interface Block {
  __component: string;
  id: number;
  body?: string;
}

interface Article {
  id: number;
  title: string;
  description: string;
  publishedAt: string;
  cover?: {
    url: string;
    formats?: {
      medium?: {
        url: string;
      }
    }
  };
  blocks: Block[];
}

function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = async () => {
    try {
      const response = await api.get(`/v1/strapi/articles/${id}`);
      setArticle(response.data.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching article:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchArticle();
    }
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <p>Loading article...</p>
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

  if (!article) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <p>No article found.</p>
        </div>
      </Layout>
    );
  }

  const getImageUrl = () => {
    if (!article.cover) return undefined;
    const imageUrl = article.cover.formats?.medium?.url || article.cover.url;
    return `${import.meta.env.VITE_STRAPI_URL}${imageUrl}`;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <article>
          <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
          <p className="text-gray-600 mb-2">
            {new Date(article.publishedAt).toLocaleDateString()}
          </p>
          
          {article.cover && (
            <div className="mb-6 flex justify-center">
              <img 
                src={getImageUrl()} 
                alt={article.title}
                className="max-w-full h-auto rounded"
                onError={(e) => {
                  console.error("Failed to load image:", getImageUrl());
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          
          <p className="text-lg mb-6">{article.description}</p>
          
          {article.blocks.map(block => (
            block.__component === 'shared.rich-text' && block.body ? (
              <div 
                key={block.id} 
                className="mb-4"
                dangerouslySetInnerHTML={{ __html: block.body }}
              />
            ) : null
          ))}
        </article>
      </div>
    </Layout>
  );
}

export default ArticlePage;