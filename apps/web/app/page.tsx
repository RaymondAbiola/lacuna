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
      <Hero />
      <main>
        <Showcase />
        <div id="method">
          <Steps />
        </div>
        <Scoreboard />
        <Contrast />
        <CallToAction />
      </main>
    </>
  );
}
