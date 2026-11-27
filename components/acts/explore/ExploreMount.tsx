"use client";

/**
 * The explore stop's mount point (ReadPanel renders it between the figures and the ranked list).
 *
 * Without `?explore=1` it renders nothing, on the server and in the browser, and ExploreStage is
 * never fetched. With the flag (known after mount only: the server never sees it) it loads the
 * stage, which loads the scene, the card and the list in turn.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { EXPLORE } from "@/lib/story";

const ExploreStage = dynamic(() => import("./ExploreStage"), { ssr: false });

export function ExploreMount() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(EXPLORE), []);
  return on ? <ExploreStage /> : null;
}
