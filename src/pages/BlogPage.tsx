import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import Footer from "../footer";
import { posts, blogImage, readingMinutes } from "../blog/posts";
import { typography as type } from "../styles/typography";

export default function BlogPage() {
  const cover = blogImage("cover");
  return (
    <>
      <main
        id="main-content"
        className="min-h-[70svh] bg-[#15120f] px-[18px] py-10 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6 sm:py-16 lg:px-10 lg:py-20"
      >
        <div className="mx-auto max-w-[1160px]">
          <header className="mb-10 border-b border-[#cbb79c33] pb-8 sm:mb-14 sm:pb-12">
            <p className={`${type.eyebrow} mb-4 text-[#cbb79c]`}>
              Notes from behind the crates
            </p>
            <h1 className={`${type.pageTitle} mb-6`}>Grab a kopi, stay for a story</h1>
            <p className="max-w-[700px] text-base leading-8 text-[#c0b4a3] sm:text-lg">
              Life running the shop, our records on repeat,
              and the stories we pick up along the way.
            </p>
          </header>
          <div className="space-y-10">
            {posts.map((post, index) => (
              <article key={post.slug}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="group grid overflow-hidden rounded-lg border border-white/10 bg-[#211b16] text-inherit no-underline transition-colors hover:border-[#cbb79c66] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbb79c] md:grid-cols-[.9fr_1.1fr]"
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt="A glimpse into Kopi’s Records"
                      className="aspect-[4/3] h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="relative flex aspect-[4/3] flex-col justify-between overflow-hidden border-b border-white/10 bg-[#30261d] p-7 md:border-r md:border-b-0 sm:p-10"
                    >
                      <span className="text-xs uppercase tracking-[.22em] text-[#cbb79c]">
                        Blog Post
                      </span>
                      <div className="absolute -right-14 -bottom-16 h-64 w-64 rounded-full border border-[#cbb79c33] shadow-[0_0_0_20px_#cbb79c08,0_0_0_40px_#cbb79c08,0_0_0_60px_#cbb79c08]" />
                      <span className="relative font-marcellus text-5xl leading-[1.15] sm:text-6xl">
                        {post.title}
                      </span>
                      <span className="relative text-xs tracking-[.18em] text-[#c0b4a3]">
                        NO. {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
                    <p className="mb-6 text-xs text-[#c0b4a3]">
                      By {post.author} <span aria-hidden="true">·</span>{" "}
                      {readingMinutes(post)} min read
                    </p>
                    <p className="mb-7 text-sm leading-7 text-[#c0b4a3] sm:text-base">
                      {post.excerpt}
                    </p>
                    
                    <span className="flex min-h-11 items-center justify-between gap-4 border-t border-white/15 pt-4 text-sm text-[#cbb79c]">
                      Read the story{" "}
                      <ArrowUpRight size={20} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
