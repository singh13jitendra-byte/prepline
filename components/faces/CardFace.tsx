"use client";

/**
 * The `card` face: the Role scored, with its working (storyboard 2.4, beat 5),
 * drawn by the product's own `RoleDetail variant="compact"` (components/product):
 * title and meta, the 0 to 10 rule with its numeral, reason rows with points and
 * a source each, the gap row, the privacy line. Natural size 520 × 320.
 *
 * Night skin is the product's pine card; day skin is paper. Same layout, so the
 * daybreak split meets at the Line with no offset. The engine paints the box.
 *
 * The `reason` performance fills `cardShow`; every mounted copy reads it each
 * frame and writes the rule, the numeral and which reason rows are resolved,
 * straight to the DOM (no React render per frame). Server and reduced-motion
 * markup show the end state. Flying copies are decorative; the dock copy is the
 * real article.
 *
 * The dock copy's rule fill is the `card-meter` anchor: the Line docks on it and
 * follows its width, so the Line itself is the score filling up.
 * Leaving for the board, the title block slides toward the tile's title
 * (titleHandOver), so the swap reads as one title travelling.
 */

import { useEffect, useRef } from "react";
import "@/components/acts/read/faces.css";
import { cardShow, titleHandOver } from "@/components/acts/read/runtime";
import { registerFace, type FaceProps } from "@/components/story/faces";
import { RoleDetail, Showcase } from "@/components/product";
import { registerAnchor } from "@/lib/anchors";
import { story } from "@/lib/story";

export const CARD_SIZE = { w: 520, h: 320 } as const;

export function CardFace({ skin, host }: FaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (host !== "dock") return;
    const fill = rootRef.current?.querySelector<HTMLElement>(".pp-role-rule .pp-rule-fill");
    return fill ? registerAnchor("card-meter", fill) : undefined;
  }, [host]);

  useEffect(() => {
    if (story.reduced()) return;
    const root = rootRef.current;
    if (!root) return;
    const rule = root.querySelector<HTMLElement>(".pp-role-rule");
    const num = root.querySelector<HTMLElement>(".pp-role-rule .pp-rule-n");
    const id = root.querySelector<HTMLElement>(".pp-role-id");
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".pp-reason"));
    const last = { meter: -1, score: -1, rows: -1, focus: "", id: "" };
    const write = () => {
      if (host === "actor" && id) {
        const tf = titleHandOver(story.get(), "card");
        if (tf !== last.id) id.style.transform = last.id = tf;
      }
      if (cardShow.meter !== last.meter) {
        last.meter = cardShow.meter;
        rule?.style.setProperty("--pp-score-p", cardShow.meter.toFixed(4));
      }
      const n = Math.round(cardShow.score);
      if (n !== last.score) {
        last.score = n;
        const t = num?.firstChild;
        if (t && t.nodeType === 3) t.nodeValue = String(n);
      }
      const shown = Math.floor(cardShow.rows);
      if (shown !== last.rows) {
        last.rows = shown;
        rows.forEach((r, i) => r.toggleAttribute("data-pending", i >= shown));
      }
      // Breath: each reason row is read in turn once the card has landed.
      const f = cardShow.focus < 0 ? "-1" : String(Math.min(rows.length - 1, Math.floor(cardShow.focus)));
      if (f !== last.focus) {
        last.focus = f;
        rows.forEach((r, i) => r.toggleAttribute("data-reading", String(i) === f));
      }
    };
    write();
    return story.frame("actor", write);
  }, [host]);

  return (
    <div ref={rootRef} className="pl-card-face">
      <Showcase size={CARD_SIZE} scale={1} decorative={host === "actor"}>
        <RoleDetail variant="compact" skin={skin} bare illustrative={false} />
      </Showcase>
    </div>
  );
}

registerFace("card", CardFace);
