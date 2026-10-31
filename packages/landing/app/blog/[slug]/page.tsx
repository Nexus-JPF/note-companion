import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlogContent } from "../components/blog-content";
import { BlogFaq } from "../components/blog-faq";
import { BlogFaqSchema } from "../components/blog-faq-schema";
import { BlogPostingSchema } from "../components/blog-posting-schema";
import { BreadcrumbSchema } from "@/components/breadcrumb-schema";
import { RelatedPosts } from "../components/related-posts";
import { getPostBySlug, getAllPosts, getRelatedPosts } from "@/lib/blog";
import { getSiteBaseUrl } from "@/lib/site-url";

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const metadata: Metadata = {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `/blog/${slug}`,
      type: "article",
      publishedTime: post.date,
      ...(post.updated && { modifiedTime: post.updated }),
      ...(post.image && { images: [post.image] }),
    },
    ...(post.image && {
      twitter: {
        card: "summary_large_image",
        images: [post.image],
      },
    }),
  };
  return metadata;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(slug);
  const siteUrl = getSiteBaseUrl();

  return (
    <div className="bg-background">
      <BlogPostingSchema post={post} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: siteUrl },
          { name: 'Blog', url: `${siteUrl}/blog` },
          {
            name: post.headline ?? post.title,
            url: `${siteUrl}/blog/${post.slug}`,
          },
        ]}
      />
      {post.faq && post.faq.length > 0 && <BlogFaqSchema faq={post.faq} />}
      <div className="max-w-4xl mx-auto px-6 py-12 lg:px-8">
        {/* Back Button */}
        <Link href="/blog">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
        </Link>

        {/* Article Header */}
        <header className="mb-12 pb-8 border-b border-border">
          <div className="flex items-center gap-2 mb-6">
            <Badge variant="secondary" className="text-xs font-medium">
              {post.category}
            </Badge>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
              {post.updated && post.updated !== post.date && (
                <span>
                  Updated{" "}
                  <time dateTime={post.updated}>
                    {new Date(post.updated).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </span>
              )}
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight text-gray-900">
            {post.headline ?? post.title}
          </h1>
          <p className="text-xl text-gray-600 mb-6 leading-relaxed">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </header>

        {post.image && (
          <div className="relative w-full aspect-video max-w-4xl mx-auto mb-12 rounded-lg overflow-hidden bg-muted">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 896px) 100vw, 896px"
            />
          </div>
        )}

        {/* Article Content */}
        <BlogContent post={post} />

        {post.faq && post.faq.length > 0 && <BlogFaq faq={post.faq} />}

        <RelatedPosts posts={relatedPosts} />

        {/* Footer */}
        <div className="mt-12 pt-8 border-t">
          <Link href="/blog">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

