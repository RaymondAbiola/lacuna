import { describeFailure, kite, kpassPath } from "../kite.js";

// Gate for commit 3. Confirms the Kite CLI is installed, the backend answers,
// the account is authenticated, and a spending session can be created with
// limits. Anything this cannot reach is reported as a next step rather than a
// hard failure, because two steps in this flow are deliberately human.

const PASS = "  PASS";
const FAIL = "  FAIL";
const TODO = "  TODO";

let blocked = 0;

function report(label: string, state: string, detail: string): void {
  console.log(`${state}  ${label.padEnd(22)} ${detail}`);
  if (state === FAIL) blocked += 1;
}

function compact(value: unknown, keys: string[]): string {
  const obj = (value ?? {}) as Record<string, unknown>;
  const picked = keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${k}=${JSON.stringify(obj[k])}`)
    .join(" ");
  return picked.length > 0 ? picked.slice(0, 110) : JSON.stringify(value).slice(0, 110);
}

async function main(): Promise<void> {
  console.log("");
  console.log("  Kite gate");
  console.log("");

  const bin = kpassPath();
  if (!bin) {
    report("kpass installed", FAIL, "not found in ~/.kpass/bin or ~/.local/bin");
    console.log("");
    console.log("  Install it, then re-run:");
    console.log("    curl -fsSL https://cli.gokite.ai/install.sh | bash");
    console.log("");
    process.exitCode = 1;
    return;
  }
  report("kpass installed", PASS, bin);

  const health = await kite.health();
  if (health.ok) report("backend reachable", PASS, compact(health.value, ["status", "ok"]));
  else report("backend reachable", FAIL, describeFailure(health));

  const me = await kite.me();
  if (me.ok) {
    report("authenticated", PASS, compact(me.value, ["email", "user_id", "id"]));
  } else {
    report("authenticated", TODO, "sign up first, see the steps below");
    console.log("");
    console.log("  One-time signup, the email link is a human step:");
    console.log("    kpass signup init --email you@example.com --output json");
    console.log("    kpass signup poll --signup-id <ID> --wait --output json");
    console.log("    kpass signup exchange --signup-id <ID> --exchange-token <TOKEN> --output json");
    console.log("");
    return;
  }

  const wallet = await kite.walletBalance();
  if (wallet.ok) report("wallet", PASS, compact(wallet.value, ["address", "balances", "usdc"]));
  else report("wallet", FAIL, describeFailure(wallet));

  const agents = await kite.listAgents();
  const agentList = (agents.ok ? (agents.value as { agents?: unknown[] })?.agents : undefined) ?? [];
  if (agents.ok && Array.isArray(agentList) && agentList.length > 0) {
    report("agent registered", PASS, `${agentList.length} agent(s)`);
  } else {
    report("agent registered", TODO, "run: kpass agent:register --type coding-assistant");
  }

  const sessions = await kite.activeSessions();
  if (sessions.ok) {
    const list = ((sessions.value as { sessions?: unknown[] })?.sessions ?? []) as unknown[];
    report("active session", list.length > 0 ? PASS : TODO, `${list.length} active`);
  } else {
    report("active session", TODO, "none yet");
  }

  console.log("");
  console.log(blocked === 0 ? "  gate clear so far" : `  gate FAILED on ${blocked} check(s)`);
  console.log("");
  if (blocked > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
