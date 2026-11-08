import { BlogFaqItem } from '@/types/blog';

interface BlogFaqProps {
  faq: BlogFaqItem[];
}

export function BlogFaq({ faq }: BlogFaqProps) {
  if (!faq.length) {
    return null;
  }

  return (
    <section
      className="max-w-4xl mx-auto mt-12 pt-8 border-t border-border"
      aria-labelledby="blog-faq-heading"
    >
      <div
        className="prose prose-lg max-w-none dark:prose-invert
          prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight
          prose-h2:text-2xl prose-h2:mt-0 prose-h2:mb-6 prose-h2:font-bold prose-h2:text-gray-900
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-h3:font-semibold prose-h3:text-gray-800
          prose-p:text-gray-700 prose-p:leading-7 prose-p:mb-4 prose-p:text-base"
      >
        <h2 id="blog-faq-heading">FAQ</h2>
        {faq.map((item) => (
          <div key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
