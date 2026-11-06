import { BuiltOn } from "./components/BuiltOn";
import { CallToAction } from "./components/CallToAction";
import { Contrast } from "./components/Contrast";
import { Hero } from "./components/Hero";
import { Scoreboard } from "./components/Scoreboard";
import { Showcase } from "./components/Showcase";
import { SiteHeader } from "./components/SiteHeader";
import { Steps } from "./components/Steps";

// Static by construction. The landing argues from a recorded run and makes no
// API call, so a reader who never types costs nothing and the credit balance
// cannot be drained by people merely looking.
export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="landing-main">
        <Hero />
        <div className="shell landing-sections">
          <Scoreboard />
          <Showcase />
          <Steps />
          <Contrast />
          <BuiltOn />
          <CallToAction />
          <footer className="site-footer">
            <span className="footer-name">Lacuna<span aria-hidden="true">.</span></span>
            <p>Find out what your agent&apos;s rules actually permit.</p>
            <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
          </footer>
        </div>
      </main>
    </>
  );
}
