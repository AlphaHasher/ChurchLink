import { Link } from 'react-router-dom';

interface ArticleCardProps {
  id: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  publishedAt: string;
}

function ArticleCard({ id, title, excerpt, publishedAt }: ArticleCardProps) {
  return (
    <Link to={`/articles/${id}`} className="block border rounded-lg p-4 hover:shadow-md">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-2">
        {new Date(publishedAt).toLocaleDateString()}
      </p>
      {excerpt && <p className="text-gray-700">{excerpt}</p>}
    </Link>
  );
}

export default ArticleCard;
