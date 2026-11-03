// The lacuna itself: the missing part of a manuscript. The only decorative
// mark in the interface, and it only ever stands for a real absence.
export function Gap({ label }: { label?: string }) {
  return (
    <span className="gap" aria-label={label ?? "missing"}>
      [ &#x22ef; ]
    </span>
  );
}
