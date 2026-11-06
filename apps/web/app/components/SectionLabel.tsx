export function SectionLabel({ children, as: Tag = "p" }: { children: React.ReactNode; as?: "p" | "h2" }) {
  return <Tag className="label">{children}</Tag>;
}
