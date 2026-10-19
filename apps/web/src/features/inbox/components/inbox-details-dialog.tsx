import type { InboxItemOutput } from "@openmonetis/validators/inbox";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";

import { getInboxMediaUrl } from "../inbox.api";
import {
  formatInboxAmount,
  formatInboxReceiptStore,
  formatInboxTimestamp,
  getInboxReceiptWarnings,
} from "../inbox.presentation";
import { inboxItemQueryOptions } from "../inbox.queries";

export function InboxDetailsDialog({
  itemId,
  onOpenChange,
}: {
  itemId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery(inboxItemQueryOptions(itemId ?? ""));
  const item = query.data;
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(itemId)}>
      <DialogContent data-mobile-details>
        <DialogHeader>
          <DialogTitle>Detalhes da captura</DialogTitle>
          <DialogDescription>
            {item?.receipt
              ? "Dados lidos da mensagem do WhatsApp. Confira com a foto antes de usar."
              : "Conteúdo original enviado pelo Companion. Confirme os dados antes de usar."}
          </DialogDescription>
        </DialogHeader>
        <div className="contents" data-mobile-detail-body>
          {query.isLoading ? <Skeleton className="h-40" /> : null}
          {query.isError ? (
            <p className="text-destructive text-sm">Não foi possível carregar os detalhes.</p>
          ) : null}
          {item?.receipt && !query.isError ? <ReceiptDetails item={item} /> : null}
          {item && !item.receipt && !query.isError ? (
            <dl className="grid gap-4">
              <div>
                <dt className="font-medium text-muted-foreground text-xs">Origem</dt>
                <dd className="mt-1 text-sm">{item.sourceAppName ?? item.sourceApp}</dd>
              </div>
              {item.originalTitle ? (
                <div>
                  <dt className="font-medium text-muted-foreground text-xs">Título</dt>
                  <dd className="mt-1 wrap-break-word text-sm">{item.originalTitle}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-medium text-muted-foreground text-xs">Texto da notificação</dt>
                <dd className="mt-1 rounded-lg border bg-muted/30 p-3 wrap-break-word text-sm leading-relaxed">
                  {item.originalText}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDetails({ item }: { item: InboxItemOutput }) {
  const receipt = item.receipt;
  if (!receipt) return null;
  const store = formatInboxReceiptStore(receipt);
  const warnings = getInboxReceiptWarnings(receipt, item.parsedAmount);

  return (
    <div className="grid gap-4">
      {receipt.hasMedia ? (
        <a
          className="block overflow-hidden rounded-lg border"
          href={getInboxMediaUrl(item.id)}
          rel="noreferrer"
          target="_blank"
        >
          <img
            alt="Foto enviada pelo WhatsApp"
            className="max-h-96 w-full bg-muted/30 object-contain"
            src={getInboxMediaUrl(item.id)}
          />
        </a>
      ) : null}
      <dl className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <dt className="font-medium text-muted-foreground text-xs">Loja</dt>
          <dd className="mt-1 text-sm">
            {store ?? "Não lida"}
            {receipt.storeId ? null : (
              <Badge className="ml-2" variant="outline">
                Não cadastrada
              </Badge>
            )}
          </dd>
          {receipt.storeAddress ? (
            <dd className="text-muted-foreground text-xs">{receipt.storeAddress}</dd>
          ) : null}
        </div>
        <div>
          <dt className="font-medium text-muted-foreground text-xs">Data</dt>
          <dd className="mt-1 text-sm">{formatInboxTimestamp(item.notificationTimestamp)}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground text-xs">Pagamento</dt>
          <dd className="mt-1 text-sm">
            {receipt.paymentMethod ? paymentMethodLabels[receipt.paymentMethod] : "Não lido"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground text-xs">Total da nota</dt>
          <dd className="mt-1 text-sm tabular-nums">
            {formatInboxAmount(item.parsedAmount) ?? "Não lido"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground text-xs">Soma dos itens</dt>
          <dd className="mt-1 text-sm tabular-nums">{formatInboxAmount(receipt.itemsAmount)}</dd>
        </div>
      </dl>
      {warnings.length ? (
        <ul className="grid gap-1.5 rounded-lg border p-3">
          {warnings.map((warning) => (
            <li className="flex gap-2 text-sm" key={warning}>
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <p className="font-medium text-muted-foreground text-xs">Itens lidos</p>
        <ul className="mt-1 divide-y rounded-lg border">
          {receipt.lines.map((line) => (
            <li className="flex items-center justify-between gap-3 px-3 py-2" key={line.id}>
              <div className="min-w-0">
                <p className="truncate text-sm">{line.extractedName}</p>
                <p className="text-muted-foreground text-xs">
                  {line.packageCount !== null
                    ? `${line.packageCount} un`
                    : `${line.totalContent ?? "?"} g/mL`}
                  {line.discountAmount > 0
                    ? ` · desconto ${formatInboxAmount(line.discountAmount)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{line.productId ? "Reconhecido" : "Produto novo"}</Badge>
                <span className="text-sm tabular-nums">{formatInboxAmount(line.paidAmount)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {item.originalText ? (
        <div>
          <p className="font-medium text-muted-foreground text-xs">Mensagem</p>
          <p className="mt-1 rounded-lg border bg-muted/30 p-3 wrap-break-word text-sm leading-relaxed">
            {item.originalText}
          </p>
        </div>
      ) : null}
    </div>
  );
}
