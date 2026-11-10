import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import SupportLayout, { supportLink } from "../support/SupportLayout";

// Edit the questions and answers here as your shop policies evolve.
const groups = [
  {
    id: "ordering", title: "Orders & payment",
    questions: [
      { question: "How do I pay for my order?", answer: "We accept PayNow. Follow the checkout instructions and check the recipient, amount and reference before paying. Once you’ve transferred, press ‘I’ve made payment’ so we know to check it." },
      { question: "I’ve paid. What happens next?", answer: "Please give us 1–2 hours to check your payment manually. You’ll receive an email when we confirm it, and we’ll use the Telegram username or phone number you provided to arrange collection or delivery. If you’ve already paid, please don’t pay again." },
      { question: "Does putting a record in my cart reserve it?", answer: "Adding a record to your cart does not reserve it. At checkout, follow the hold timer shown on the payment page. Report your payment before the hold ends. Do not pay using an expired QR; if you already transferred after expiry, contact us with your order reference." },
      { question: "Where can I check my order?", answer: "Keep your private order link from checkout or your order email. That link shows your latest order status. Anyone with the link can view the order summary, so keep it private. If you can’t find it, email us with your order reference." },
    ],
  },
  {
    id: "collection-delivery", title: "Collection & delivery",
    questions: [
      { question: "Where do I collect my records?", answer: "Self collection is free at Rocks Cafe, 98 Arab Street, Level 2, Back Alley Entrance, Singapore 199794. Please wait for your ready-for-collection email and confirm arrangements with us before heading down. Bring your collection / bag number or show your order page." },
      { question: "How much is delivery, and how long does it take?", answer: "Singapore delivery is $4.50. Please allow 2–3 days after dispatch for your records to arrive. We’ll email you when your order has been mailed out. This delivery window starts after dispatch, rather than when you place the order." },
      { question: "My delivery hasn’t arrived. What should I do?", answer: "If your records haven’t arrived after 3 days from dispatch, drop us an email with your order reference. We’ll help check on the delivery." },
    ],
  },
  {
    id: "records", title: "Records, preorders & requests",
    questions: [
      { question: "What does the Preorder tag mean?", answer: "A preorder listing is for an upcoming release. Its product page shows the release date, or says the date is to be announced. It is not an in-stock item for immediate collection or delivery. Its expected arrival at the shop is separate from the release date. Your private order page shows preorder progress, and we’ll email you if the expected arrival changes." },
      { question: "What happens if I order in-stock records and preorders together?", answer: "We hold the complete order until every preorder item is ready, then arrange one collection or delivery. A preorder marked Ready means that title has arrived; please wait for your separate ready-for-collection or dispatch confirmation." },
      { question: "Can you help me find a record?", answer: "Yes! Use Request a record to tell us the artist, album and any pressing details you’re after. Leave your email and contact details so we can get back to you. Sending a request does not place an order or guarantee availability." },
      { question: "A record I want is sold out. Can I get an alert?", answer: "Use ‘Notify me when available’ on a sold-out product page and follow the email confirmation instructions. We’ll email you if that listing becomes available again. A notification does not reserve a copy." },
      { question: "Are your records new or used?", answer: "We carry both new and used records. Check each listing’s description and variant / pressing details before ordering. If you’d like to know more about a particular copy, send us the product link and ask." },
      { question: "My record came broken, warped, or damaged", answer: "Please email us with your order reference, a description of the issue and photos if relevant. We’ll look into it with you. Contact us before sending anything back so we can agree on the next steps." },
    ],
  },
];

export default function FAQPage() {
  return (
    <SupportLayout title="A few things you might ask" intro="Payment, picking up your records, preorders and everything in between. If your question isn’t here, drop us a message.">
      <div className="grid items-start gap-8 lg:grid-cols-[220px_1fr] lg:gap-14">
        <nav aria-label="FAQ topics" className="flex flex-wrap gap-x-5 gap-y-3 lg:sticky lg:top-28 lg:flex-col">
          {groups.map((group) => <a key={group.id} href={`#${group.id}`} className={`${supportLink} inline-flex min-h-11 items-center text-sm`}>{group.title}</a>)}
        </nav>
        <div className="min-w-0">
          {groups.map((group) => (
            <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="mb-12 scroll-mt-28">
              <h2 id={`${group.id}-title`} className="mb-5 font-marcellus text-2xl sm:text-3xl">{group.title}</h2>
              <div className="divide-y divide-white/10 rounded-lg border border-white/10 bg-[#211b16] px-5 sm:px-6">
                {group.questions.map(({ question, answer }) => (
                  <details key={question} className="group py-1">
                    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 text-base leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] [&::-webkit-details-marker]:hidden">
                      {question}<Plus size={18} aria-hidden="true" className="shrink-0 text-[#cbb79c] transition-transform group-open:rotate-45 motion-reduce:transition-none" />
                    </summary>
                    <p className="pb-5 pr-4 text-sm leading-7 text-[#c0b4a3] sm:text-base">{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
          <aside className="rounded-lg border border-[#cbb79c33] p-6 sm:p-8">
            <h2 className="mb-3 font-marcellus text-2xl">Still wondering?</h2>
            <p className="mb-5 text-sm leading-7 text-[#c0b4a3]">We are happy to help. Include your order reference if you’re asking about an order.</p>
            <Link to="/contact" className={`${supportLink} inline-flex min-h-11 items-center`}>Get in touch ↗</Link>
          </aside>
        </div>
      </div>
    </SupportLayout>
  );
}
