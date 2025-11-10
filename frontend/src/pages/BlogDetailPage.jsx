import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { blogService } from '../services/blogs';
import { 
  Calendar, 
  Tag, 
  FolderOpen, 
  Clock,
  ArrowLeft,
  Loader2,
  FileText
} from 'lucide-react';

const BlogDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBlog();
  }, [slug]);

  const fetchBlog = async () => {
    try {
      setLoading(true);
      setError(null);
      // Decode the slug - React Router may have already decoded it, but handle both cases
      let decodedSlug = slug;
      try {
        decodedSlug = decodeURIComponent(decodeURIComponent(slug)); // Try double decode first
        if (decodedSlug === slug) {
          decodedSlug = decodeURIComponent(slug); // If no change, try single decode
        }
      } catch (e) {
        decodedSlug = slug; // If decoding fails, use as-is
      }
      console.log('Fetching blog with slug (original):', slug, 'decoded:', decodedSlug);
      const response = await blogService.getBlogBySlug(decodedSlug);
      console.log('Blog response:', response);
      if (response.blog) {
        setBlog(response.blog);
      } else {
        setError('Blog not found');
      }
    } catch (err) {
      console.error('Error fetching blog:', err);
      setError(err.message || 'Failed to load blog. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#9E005C] mx-auto mb-4" />
          <p className="text-gray-600">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Blog Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The blog post you are looking for does not exist.'}</p>
          <Link
            to="/blog"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9E005C] to-[#FF4D94] text-white rounded-lg hover:from-[#FF4D94] hover:to-[#9E005C] transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Featured Image */}
        {(blog.featured_image || blog.metadata?.featured_image) && (
          <div className="mb-8 rounded-lg overflow-hidden w-full max-w-full">
            <img 
              src={blog.featured_image || blog.metadata?.featured_image} 
              alt={blog.title || 'Featured'} 
              className="w-full h-auto max-h-96 object-contain sm:object-cover"
              style={{ maxWidth: '100%', height: 'auto', width: '100%' }}
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent mb-4 sm:mb-6">
          {blog.title || 'Untitled'}
        </h1>

        {/* Meta Information */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-gray-200">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            {formatDate(blog.created_at)}
          </div>
          {blog.reading_time > 0 && (
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {blog.reading_time} min read
            </div>
          )}
          {blog.word_count > 0 && (
            <div className="flex items-center">
              <span>{blog.word_count.toLocaleString()} words</span>
            </div>
          )}
        </div>

        {/* Excerpt */}
        {blog.excerpt && (
          <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
            <p className="text-base sm:text-lg md:text-xl text-gray-700 italic leading-relaxed">
              {blog.excerpt}
            </p>
          </div>
        )}

        {/* Categories and Tags */}
        {(blog.categories?.length > 0 || blog.tags?.length > 0) && (
          <div className="mb-8 flex flex-wrap gap-4">
            {blog.categories && blog.categories.length > 0 && (
              <div>
                <span className="text-sm font-semibold text-gray-700 mr-2">Categories:</span>
                {blog.categories.map((category, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-2 mb-2"
                  >
                    <FolderOpen className="w-3 h-3 mr-1" />
                    {category}
                  </span>
                ))}
              </div>
            )}
            {blog.tags && blog.tags.length > 0 && (
              <div>
                <span className="text-sm font-semibold text-gray-700 mr-2">Tags:</span>
                {blog.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm mr-2 mb-2"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blog Content */}
        <div 
          className="prose prose-sm sm:prose-base md:prose-lg max-w-none blog-content"
          dangerouslySetInnerHTML={{ __html: blog.content || '' }}
        />

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            to="/blog"
            className="inline-flex items-center bg-gradient-to-r from-[#9E005C] to-[#FF4D94] bg-clip-text text-transparent hover:from-[#FF4D94] hover:to-[#9E005C] font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2 text-[#9E005C]" />
            Back to All Blogs
          </Link>
        </div>
      </article>
    </div>
  );
};

export default BlogDetailPage;

