// Offered so a visitor who cannot be bothered to type still sees the point.
// The first is deliberately the kind of rule people actually write.
export const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "One sentence",
    text: "You can spend up to $10 on lunch.",
  },
  {
    label: "A careful policy",
    text: `Never spend more than $20 in any rolling 7 days.
Never spend more than $15 in one payment.
Only top up when the balance drops to 10 chops or below.
Only ever pay the ChopEazy merchant address.
If consumption rises above 3x the 14 day average, do not pay and ask me first.
Wait at least 60 minutes between recharges.`,
  },
  {
    label: "A refund rule",
    text: "Approve refunds under $50 automatically if the customer gives an order ID and the order shipped in the last 30 days.",
  },
];
