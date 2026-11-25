"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/gl";
import { gsap, SplitText } from "@/lib/gsap";

/**
 * Section heading whose words brighten one by one as it scrolls through view
 * (GSAP SplitText + ScrollTrigger scrub). Screen readers get the plain text.
 */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      SplitText.create(el, {
        type: "words",
        autoSplit: true,
        onSplit: (self) =>
          gsap.fromTo(
            self.words,
            { opacity: 0.14, y: 8 },
            {
              opacity: 1,
              y: 0,
              stagger: 0.08,
              ease: "power1.out",
              scrollTrigger: { trigger: el, start: "top 88%", end: "top 48%", scrub: 0.6 },
            },
          ),
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <h2 ref={ref} className={className}>
      {text}
    </h2>
  );
}
