import Link from "next/link";

export function CallToAction() {
  return (
    <section className="cta">
      <hr className="rule" />
      <p className="cta-ask">Now try it on a rule of your own.</p>
      <Link className="cta-link" href="/arena">
        Open the arena
      </Link>
      <p className="footnote">
        It takes 30 to 60 seconds, because your sentence is read, attacked from five directions,
        put to an agent twice per case and then judged. The procedure is shown as it runs.
      </p>
      <p className="credit">
        Hero plate rendered from a photograph of aged parchment by Caleb Kimbrough,{" "}
        <a href="https://commons.wikimedia.org/wiki/File:Parchment.00.jpg">CC BY 2.0</a>.
      </p>
    </section>
  );
}
