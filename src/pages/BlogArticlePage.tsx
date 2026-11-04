import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Footer from "../footer";
import { posts, blogImage, readingMinutes } from "../blog/posts";

export default function BlogArticlePage() {
  const { slug } = useParams();
  const post = posts.find((value) => value.slug === slug);
  const cover = blogImage("cover", post?.imageFolder);
  useEffect(() => {
    const previous = document.title;
    document.title = post
      ? `${post.title} | Kopi’s Records`
      : "Story not found | Kopi’s Records";
    return () => {
      document.title = previous;
    };
  }, [post]);
  return (
    <>
      <main
        id="main-content"
        className="min-h-[70svh] bg-[#15120f] px-[18px] py-8 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6 sm:py-12 lg:px-10 lg:py-16"
      >
        <div className="mx-auto max-w-[820px]">
          <Link
            to="/blog"
            className="mb-8 inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c]"
          >
            ← All stories
          </Link>
          {!post ? (
            <div className="py-12">
              <h1 className="mb-5 font-marcellus text-4xl">Story not found.</h1>
              <p className="text-base leading-7 text-[#c0b4a3]">
                This story isn’t here. Browse the blog to find something to
                read.
              </p>
            </div>
          ) : (
            <article>
              <header className="border-b border-[#cbb79c33] pb-8 sm:pb-10">
                <p className="mb-5 text-xs uppercase tracking-[.18em] text-[#cbb79c]">
                  {post.category}
                </p>
                <h1 className="mb-7 font-marcellus text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[1.12] tracking-[-.02em]">
                  {post.title}
                </h1>
                <p className="text-sm text-[#c0b4a3]">
                  By {post.author} <span aria-hidden="true">·</span>{" "}
                  {readingMinutes(post)} min read
                </p>
              </header>
              {cover && (
                <figure className="mt-8 sm:mt-10">
                  <img
                    src={cover}
                    alt={post.coverAlt || "Kopi’s Records — welcome to the shop"}
                    className="max-h-[520px] w-full rounded object-contain"
                  />
                </figure>
              )}
              <nav
                aria-label="In this story"
                className="my-8 flex flex-wrap gap-x-5 gap-y-1 border-b border-white/10 pb-6 sm:my-10"
              >
                {post.sections
                  .filter((section) => section.title)
                  .map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="inline-flex min-h-11 items-center text-xs leading-6 text-[#cbb79c] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c]"
                    >
                      {section.title}
                    </a>
                  ))}
              </nav>
              <div className="mx-auto max-w-[720px]">
                {post.sections.map((section) => {
                  const images = (section.gallery || []).flatMap((name) => {
                    const src = blogImage(name, post.imageFolder);
                    return src ? [{ name, src }] : [];
                  });
                  const scene = section.image
                    ? blogImage(section.image, post.imageFolder)
                    : undefined;
                  return (
                    <section
                      key={section.id}
                      id={section.id}
                      className="mb-12 scroll-mt-28 sm:mb-16"
                    >
                      {section.title && (
                        <h2 className="mb-6 font-marcellus text-[clamp(1.65rem,3.5vw,2.25rem)] leading-snug">
                          {section.title}
                        </h2>
                      )}
                      {section.paragraphs.map((paragraph, i) => (
                        <p
                          key={i}
                          className="mb-6 break-words text-base leading-[1.9] text-[#ddd3c6] sm:text-[18px]"
                        >
                          {paragraph}
                        </p>
                      ))}
                      {images.length > 0 && (
                        <div
                          aria-label={section.galleryAlt || "Photos of Kopi"}
                          className="mt-8 grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4"
                        >
                          {images.map(({ name, src }, i) => (
                            <figure
                              key={name}
                              className={
                                images.length === 3 && i === 2
                                  ? "col-span-2 mx-auto w-full max-w-[320px] sm:col-span-1 sm:max-w-none"
                                  : ""
                              }
                            >
                              <img
                                src={src}
                                alt={`${section.galleryAlt || "Kopi, the tabby cat the shop is named after"} — photo ${i + 1}`}
                                loading="lazy"
                                className="aspect-square w-full rounded border border-white/10 object-cover"
                              />
                            </figure>
                          ))}
                        </div>
                      )}
                      {scene && (
                        <figure className="mt-8">
                          <img
                            src={scene}
                            alt={section.imageAlt || "Behind the scenes at Kopi’s Records"}
                            loading="lazy"
                            className="max-h-[560px] w-full rounded border border-white/10 object-contain"
                          />
                        </figure>
                      )}
                    </section>
                  );
                })}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#cbb79c33] pt-7">
                  <Link
                    to="/blog"
                    className="inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline underline-offset-4"
                  >
                    ← Back to the blog
                  </Link>
                  <Link
                    to="/shop"
                    className="inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline underline-offset-4"
                  >
                    Have a dig through the records ↗
                  </Link>
                </div>
              </div>
            </article>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
