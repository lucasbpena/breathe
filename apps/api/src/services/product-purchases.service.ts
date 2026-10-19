import {
  calculatePurchasePrices,
  resolvePurchaseQuantity,
  summarizeTransactionPurchases,
} from "@openmonetis/domain/product-purchases";
import { createProductNameKey, type ProductContentUnit } from "@openmonetis/domain/products";
import type {
  CreateProductPurchaseInput,
  CreateProductPurchasesInput,
  ProductPurchaseOutput,
  ReplaceProductPurchaseInput,
  TransactionProductPurchasesOutput,
} from "@openmonetis/validators/product-purchases";
import { badRequest, notFound } from "../utils/errors";

export type ProductPurchaseRecord = {
  id: string;
  transactionId: string;
  transactionName: string;
  transactionPeriod: string;
  purchaseDate: Date;
  productId: string;
  productName: string;
  contentUnit: ProductContentUnit;
  storeId: string;
  storeName: string;
  storeBranch: string | null;
  storeNeighborhood: string | null;
  extractedName: string | null;
  packageCount: string | null;
  totalContent: string;
  paidAmount: string;
  discountAmount: string;
  createdAt: Date;
  updatedAt: Date;
};

type PurchaseProduct = {
  id: string;
  nameKey: string;
  contentUnit: ProductContentUnit;
  packageContent: string | null;
};

type ProductPurchaseData = {
  productId: string;
  storeId: string;
  extractedName: string | null;
  packageCount: string | null;
  totalContent: string;
  paidAmount: string;
  discountAmount: string;
};

export type ProductPurchasesRepository = {
  findTransactionForUser(
    id: string,
    userId: string,
  ): Promise<{ id: string; type: "income" | "expense" | "transfer"; amount: string } | null>;
  findProductForUser(id: string, userId: string): Promise<PurchaseProduct | null>;
  storeExistsForUser(id: string, userId: string): Promise<boolean>;
  listByTransactionForUser(transactionId: string, userId: string): Promise<ProductPurchaseRecord[]>;
  listByProductForUser(productId: string, userId: string): Promise<ProductPurchaseRecord[]>;
  insert(
    data: ProductPurchaseData & { userId: string; transactionId: string },
  ): Promise<ProductPurchaseRecord>;
  /** Inserts every line in one statement, so a receipt is saved whole or not at all. */
  insertMany(
    rows: (ProductPurchaseData & { userId: string; transactionId: string })[],
  ): Promise<void>;
  replaceForUser(
    id: string,
    userId: string,
    data: ProductPurchaseData,
  ): Promise<ProductPurchaseRecord | null>;
  deleteForUser(id: string, userId: string): Promise<{ id: string } | null>;
  productNameKeyExistsForUser(nameKey: string, userId: string): Promise<boolean>;
  insertAliasIfAbsent(data: {
    userId: string;
    productId: string;
    name: string;
    nameKey: string;
  }): Promise<void>;
};

export function createProductPurchasesService(repository: ProductPurchasesRepository) {
  async function findExpense(transactionId: string, userId: string) {
    const transaction = await repository.findTransactionForUser(transactionId, userId);
    if (!transaction) throw notFound("Transaction not found", "transaction_not_found");
    if (transaction.type !== "expense") {
      throw badRequest("Only expenses can list products", "transaction_not_expense");
    }
    return transaction;
  }

  async function toPurchaseData(
    input: ReplaceProductPurchaseInput,
    userId: string,
  ): Promise<{ product: PurchaseProduct; data: ProductPurchaseData }> {
    const [product, storeExists] = await Promise.all([
      repository.findProductForUser(input.productId, userId),
      repository.storeExistsForUser(input.storeId, userId),
    ]);
    if (!product) throw notFound("Product not found", "product_not_found");
    if (!storeExists) throw notFound("Store not found", "store_not_found");

    const quantity = resolvePurchaseQuantity({
      contentUnit: product.contentUnit,
      packageContent: product.packageContent,
      packageCount: input.packageCount ?? null,
      totalContent: input.totalContent ?? null,
    });
    if (!quantity) {
      throw badRequest("Purchase quantity cannot be derived", "purchase_quantity_required");
    }

    return {
      product,
      data: {
        productId: product.id,
        storeId: input.storeId,
        extractedName: input.extractedName ?? null,
        packageCount: quantity.packageCount === null ? null : quantity.packageCount.toFixed(3),
        totalContent: quantity.totalContent.toFixed(3),
        paidAmount: input.paidAmount.toFixed(2),
        discountAmount: input.discountAmount.toFixed(2),
      },
    };
  }

  /** A receipt name becomes an alias only while no product or alias uses it yet. */
  async function learnAlias(
    product: PurchaseProduct,
    extractedName: string | null,
    userId: string,
  ) {
    if (!extractedName) return;
    const nameKey = createProductNameKey(extractedName);
    if (!nameKey || nameKey === product.nameKey) return;
    if (await repository.productNameKeyExistsForUser(nameKey, userId)) return;
    await repository.insertAliasIfAbsent({
      userId,
      productId: product.id,
      name: extractedName,
      nameKey,
    });
  }

  async function listForTransaction(
    transactionId: string,
    userId: string,
  ): Promise<TransactionProductPurchasesOutput> {
    const transaction = await findExpense(transactionId, userId);
    const items = (await repository.listByTransactionForUser(transactionId, userId)).map(toOutput);
    return { items, summary: summarizeTransactionPurchases(transaction.amount, items) };
  }

  return {
    listForTransaction,
    async listForProduct(productId: string, userId: string) {
      if (!(await repository.findProductForUser(productId, userId))) {
        throw notFound("Product not found", "product_not_found");
      }
      return (await repository.listByProductForUser(productId, userId)).map(toOutput);
    },
    async create(input: CreateProductPurchaseInput, userId: string) {
      await findExpense(input.transactionId, userId);
      const { product, data } = await toPurchaseData(input, userId);
      const purchase = await repository.insert({
        ...data,
        userId,
        transactionId: input.transactionId,
      });
      await learnAlias(product, data.extractedName, userId);
      return toOutput(purchase);
    },
    async createMany(input: CreateProductPurchasesInput, userId: string) {
      await findExpense(input.transactionId, userId);
      const lines = await Promise.all(input.items.map((item) => toPurchaseData(item, userId)));
      await repository.insertMany(
        lines.map(({ data }) => ({ ...data, userId, transactionId: input.transactionId })),
      );
      for (const { product, data } of lines) await learnAlias(product, data.extractedName, userId);
      return listForTransaction(input.transactionId, userId);
    },
    async replace(id: string, userId: string, input: ReplaceProductPurchaseInput) {
      const { product, data } = await toPurchaseData(input, userId);
      const purchase = await repository.replaceForUser(id, userId, data);
      if (!purchase) throw notFound("Purchase not found", "product_purchase_not_found");
      await learnAlias(product, data.extractedName, userId);
      return toOutput(purchase);
    },
    async remove(id: string, userId: string) {
      const purchase = await repository.deleteForUser(id, userId);
      if (!purchase) throw notFound("Purchase not found", "product_purchase_not_found");
      return purchase;
    },
  };
}

function toOutput(purchase: ProductPurchaseRecord): ProductPurchaseOutput {
  const prices = calculatePurchasePrices({
    contentUnit: purchase.contentUnit,
    paidAmount: purchase.paidAmount,
    discountAmount: purchase.discountAmount,
    packageCount: purchase.packageCount,
    totalContent: purchase.totalContent,
  });
  return {
    id: purchase.id,
    transactionId: purchase.transactionId,
    transactionName: purchase.transactionName,
    transactionPeriod: purchase.transactionPeriod,
    purchaseDate: purchase.purchaseDate.toISOString().slice(0, 10),
    productId: purchase.productId,
    productName: purchase.productName,
    contentUnit: purchase.contentUnit,
    storeId: purchase.storeId,
    storeName: purchase.storeName,
    storeBranch: purchase.storeBranch,
    storeNeighborhood: purchase.storeNeighborhood,
    extractedName: purchase.extractedName,
    packageCount: purchase.packageCount === null ? null : Number(purchase.packageCount),
    totalContent: Number(purchase.totalContent),
    discountAmount: Number(purchase.discountAmount),
    ...prices,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}

export type ProductPurchasesService = ReturnType<typeof createProductPurchasesService>;
