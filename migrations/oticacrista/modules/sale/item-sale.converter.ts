// migrations/oticacrista/08-2026/converters/item-sale.converter.ts

export interface ItemSaleConverted {
    oldSaleId: number;
    oldProductId: number;
    quantity: number;
    totalPartial: number;
    discount: number;
    totalGeneral: number;
    observation: string | null;
}

function clean(value: string | undefined | null): string {
    return (value ?? "").trim();
}

function parseMoney(
    value: string | undefined | null,
): number {
    const normalized = clean(value);

    if (!normalized) {
        return 0;
    }

    /*
     * O CSV pode apresentar valores nos dois formatos:
     *
     * 700.00
     * "40,00"
     *
     * Portanto, só tratamos a vírgula como separador decimal
     * quando ela estiver presente.
     */
    const parsed = normalized.includes(",")
        ? normalized
            .replace(/\./g, "")
            .replace(",", ".")
        : normalized;

    const number = Number(
        parsed.replace(/[^\d.-]/g, ""),
    );

    return Number.isFinite(number) ? number : 0;
}

function parseInteger(
    value: string | undefined | null,
): number {
    const number = Number.parseInt(
        clean(value),
        10,
    );

    return Number.isFinite(number) ? number : 0;
}

export function convertSaleItem(
    item: Record<string, string>,
): ItemSaleConverted {
    return {
        oldSaleId: parseInteger(
            item.itemAtendimento,
        ),

        oldProductId: parseInteger(
            item.itemProduto,
        ),

        quantity: parseInteger(
            item.itemQtd,
        ),

        totalPartial: parseMoney(
            item.itemTotalParcial,
        ),

        discount: parseMoney(
            item.itemDesc,
        ),

        totalGeneral: parseMoney(
            item.itemTotalGeral,
        ),

        observation:
            clean(item.itemObs) || null,
    };
}