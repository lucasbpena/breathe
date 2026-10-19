import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getInboxMediaUrl } from "../inbox.api";
import {
  formatInboxReceiptLines,
  getInboxReceiptWarnings,
  summarizeInboxReceipt,
} from "../inbox.presentation";

type InboxReceipt = NonNullable<InboxItemSummaryOutput["receipt"]>;

/** Compact view of a WhatsApp capture inside the inbox card. */
export function InboxReceiptSummary({
  item,
  receipt,
  onOpenDetails,
}: {
  item: InboxItemSummaryOutput;
  receipt: InboxReceipt;
  onOpenDetails: () => void;
}) {
  // The card title already names the store, so only the neighborhood is added here.
  const neighborhood = receipt.storeNeighborhood;
  const summary = summarizeInboxReceipt(receipt);
  const warnings = getInboxReceiptWarnings(receipt, item.parsedAmount);

  return (
    <div className="mt-2 flex min-w-0 items-start gap-3">
      {receipt.hasMedia ? (
        <button
          aria-label="Ver foto da nota"
          className="shrink-0 overflow-hidden rounded-md border"
          onClick={onOpenDetails}
          type="button"
        >
          <img
            alt=""
            className="size-14 object-cover"
            height={56}
            loading="lazy"
            src={getInboxMediaUrl(item.id)}
            width={56}
          />
        </button>
      ) : null}
      <div className="grid min-w-0 gap-1.5">
        {neighborhood ? <p className="truncate text-sm">{neighborhood}</p> : null}
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <Badge variant="outline">{formatInboxReceiptLines(receipt)}</Badge>
          {summary.newStore ? <Badge variant="outline">Loja não cadastrada</Badge> : null}
          {warnings.length ? (
            <Badge className="gap-1" title={warnings.join("\n")} variant="outline">
              <TriangleAlert aria-hidden="true" className="size-3" />
              {warnings.length === 1 ? "1 aviso" : `${warnings.length} avisos`}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
