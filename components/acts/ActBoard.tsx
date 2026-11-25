"use client";

/**
 * ACT II — BOARD (day). Storyboard 2.5: beats `saved`, `applied`, `interview`,
 * `hinge`, the incoming half of `daybreak` and the outgoing half of `nightfall`.
 *
 * Exposes the anchors `tile-saved`, `tile-applied`, `tile-interview`,
 * `col-saved`, `col-applied`, `col-interview`, `hinge-float` and `hinge-text`,
 * and registers the `tile` face.
 */

import "@/components/faces/TileFace";
import { Stage } from "@/components/story/Stage";
import { DEV_BACKDROP, Illustrative } from "./ActRead";
import { BoardPanel } from "./board/BoardPanel";
import { HingePanel } from "./board/HingePanel";
import "./board/board.css";

export function ActBoard() {
  return (
    <Stage act="board" labelledBy="board-title" stageClassName={`${DEV_BACKDROP} bd-stage`}>
      <BoardPanel />
      <HingePanel />
      <Illustrative />
    </Stage>
  );
}
