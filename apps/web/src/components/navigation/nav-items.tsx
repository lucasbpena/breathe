import {
  ArrowLeftRight,
  ClipboardList,
  CreditCard,
  FileChartColumn,
  Goal,
  HandCoins,
  Inbox,
  Landmark,
  NotebookText,
  Package,
  Paperclip,
  PersonStanding,
  Repeat2,
  Salad,
  Store,
  Tags,
  Target,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

export type NavLinkItem = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  isShortcut?: boolean;
  preservePeriod?: boolean;
  search?: Record<string, string>;
};

export type NavItem = NavLinkItem;

export function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: "Lançamentos",
    items: [
      {
        href: "/transactions",
        label: "Lançamentos",
        description: "Registre e gerencie suas transações",
        icon: <ArrowLeftRight className="size-4" aria-hidden="true" />,
        preservePeriod: true,
      },
      {
        href: "/inbox",
        label: "Caixa de entrada",
        description: "Revise as capturas do Companion e do WhatsApp",
        icon: <Inbox className="size-4" aria-hidden="true" />,
      },
      {
        href: "/people/admin",
        label: "Lançamentos compartilhados",
        description: "Envie e importe lançamentos entre pessoas",
        icon: <HandCoins className="size-4" aria-hidden="true" />,
        isShortcut: true,
        preservePeriod: true,
        search: { view: "external" },
      },
    ],
  },
  {
    label: "Finanças",
    items: [
      {
        href: "/cards",
        label: "Cartões",
        description: "Faturas, limites e compras no crédito",
        icon: <CreditCard className="size-4" aria-hidden="true" />,
      },
      {
        href: "/accounts",
        label: "Contas",
        description: "Saldos, extratos e contas financeiras",
        icon: <Landmark className="size-4" aria-hidden="true" />,
      },
      {
        href: "/budgets",
        label: "Orçamentos",
        description: "Limites mensais por categoria",
        icon: <Target className="size-4" aria-hidden="true" />,
        preservePeriod: true,
      },
      {
        href: "/goals",
        label: "Metas",
        description: "Objetivos de economia e progresso",
        icon: <Goal className="size-4" aria-hidden="true" />,
      },
    ],
  },
  {
    label: "Consumo",
    items: [
      {
        href: "/products",
        label: "Produtos",
        description: "Produtos comprados e histórico de preços",
        icon: <Package className="size-4" aria-hidden="true" />,
      },
      {
        href: "/stores",
        label: "Lojas",
        description: "Unidades onde você compra",
        icon: <Store className="size-4" aria-hidden="true" />,
      },
    ],
  },
  {
    label: "Físico",
    items: [
      {
        href: "/body-measurements",
        label: "Corpo",
        description: "Peso e medidas por parte do corpo",
        icon: <PersonStanding className="size-4" aria-hidden="true" />,
      },
      {
        href: "/nutrition-intake",
        label: "Nutrição",
        description: "Calorias e macros dos itens comprados",
        icon: <Salad className="size-4" aria-hidden="true" />,
      },
    ],
  },
  {
    label: "Organização",
    items: [
      {
        href: "/people",
        label: "Pessoas",
        description: "Quem participa dos lançamentos",
        icon: <Users className="size-4" aria-hidden="true" />,
      },
      {
        href: "/categories",
        label: "Categorias",
        description: "Classificação de receitas e despesas",
        icon: <Tags className="size-4" aria-hidden="true" />,
      },
      {
        href: "/notes",
        label: "Anotações",
        description: "Notas de texto e listas de tarefas",
        icon: <NotebookText className="size-4" aria-hidden="true" />,
      },
      {
        href: "/attachments",
        label: "Anexos",
        description: "Comprovantes e documentos",
        icon: <Paperclip className="size-4" aria-hidden="true" />,
        preservePeriod: true,
      },
    ],
  },
  {
    label: "Relatórios",
    items: [
      {
        href: "/reports/category-trends",
        label: "Evolução por categoria",
        description: "Evolução de categorias por período",
        icon: <FileChartColumn className="size-4" aria-hidden="true" />,
        preservePeriod: true,
      },
      {
        href: "/reports/installments",
        label: "Despesas parceladas",
        description: "Acompanhe compras parceladas",
        icon: <ClipboardList className="size-4" aria-hidden="true" />,
        preservePeriod: true,
      },
      {
        href: "/reports/recurring-expenses",
        label: "Despesas recorrentes",
        description: "Acompanhe compromissos recorrentes",
        icon: <Repeat2 className="size-4" aria-hidden="true" />,
        preservePeriod: true,
      },
    ],
  },
];

export const dashboardNavItem = {
  href: "/dashboard",
  label: "Visão geral",
};
