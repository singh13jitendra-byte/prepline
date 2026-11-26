/**
 * Prepline product screens. Import the stylesheet once, then any screen. Every
 * colour, family, radius and shadow comes from app/theme.css:
 *
 *   import "@/components/product/product.css";   // done by this barrel
 *   import { MatchesList, Showcase } from "@/components/product";
 */
import "./product.css";

export { MatchesList, type MatchesListProps, type MatchFilters } from "./MatchesList";
export { MatchRow } from "./MatchRow";
export { RoleDetail, type RoleDetailProps } from "./RoleDetail";
export { Board, Tile, type BoardProps } from "./Board";
export { PrepSheet, type PrepSheetProps } from "./PrepSheet";
export { SeatTicket, type SeatTicketProps } from "./SeatTicket";
export { Showcase, SHOWCASE_SIZES, type ShowcaseSize } from "./Showcase";
export {
  Avatar,
  Button,
  Illustrative,
  Kbd,
  KeyValue,
  LinkButton,
  ScoreBadge,
  ScoreRing,
  ScoreRule,
  SourceChip,
  StatusPill,
  Toolbar,
  scoreTier,
  type SurfaceProps,
  type Tier,
} from "./primitives";
export { Icon, type IconName } from "./icons";
export * as productData from "./data";
