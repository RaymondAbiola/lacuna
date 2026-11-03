import { CallToAction } from "./components/CallToAction";
import { Contrast } from "./components/Contrast";
import { Masthead } from "./components/Masthead";
import { Showcase } from "./components/Showcase";
import { Steps } from "./components/Steps";
import { Thesis } from "./components/Thesis";

// Static by construction. The landing argues from a recorded run and makes no
// API call, so a reader who never types costs nothing and the credit balance
// cannot be drained by people merely looking.
export default function Landing() {
  return (
    <main>
      <Masthead />
      <Thesis />
      <Showcase />
      <Steps />
      <Contrast />
      <CallToAction />
    </main>
  );
}
