import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';

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
      const response = await fetch(`${import.meta.env.VITE_API_HOST}/api/v1/strapi/articles/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      console.log("Article API Response:", result); // Debug log
      setArticle(result.data);
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
      <PublicLayout>
        <div className="container mx-auto p-6">
          <p>Loading article...</p>
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

  if (!article) {
    return (
      <PublicLayout>
        <div className="container mx-auto p-6">
          <p>No article found.</p>
        </div>
      </PublicLayout>
    );
  }

  // Helper function to get image URL
  const getImageUrl = () => {
    if (!article.cover) return undefined;
    const imageUrl = article.cover.formats?.medium?.url || article.cover.url;
    return `${import.meta.env.VITE_STRAPI_URL}${imageUrl}`;
  };

  return (
    <PublicLayout>
      <div className="container mx-auto p-6">
        <article>
          <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
          <p className="text-gray-600 mb-2">
            {new Date(article.publishedAt).toLocaleDateString()}
          </p>
          
          {article.cover && (
            <img 
              src={getImageUrl()} 
              alt={article.title}
              className="w-full max-h-96 object-cover mb-6 rounded"
            />
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
    </PublicLayout>
  );
}

export default ArticlePage;
