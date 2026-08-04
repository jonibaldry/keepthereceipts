export const fadeClass = "animate-[print-in_0.5s_ease-out_both] motion-reduce:animate-none"

export function fadeIn(index: number): React.CSSProperties {
  return { animationDelay: `${index * 0.05}s` }
}
