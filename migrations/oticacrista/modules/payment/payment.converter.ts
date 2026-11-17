import type { MappingRow } from "@migrations/oticacrista/shared/mapping";
import type { OldInstallment, OldPaymentSale } from "./payment.loader";

export type PaymentMethod = "MONEY" | "CREDIT" | "DEBIT" | "INSTALLMENT";
export type InstallmentState = "CONFIRMED" | "PENDING";

export interface ConvertedInstallment {
    sequence: number;
    amount: number;
    paidAmount: number;
    dueDate: Date;
    paidAt: Date | null;
    state: InstallmentState;
}

export interface ConvertedMethod {
    method: PaymentMethod;
    isEntry: boolean;
    amount: number;
    installments: number;
    firstDueDate: Date | null;
    isPaid: boolean;
    paidAt: Date | null;
    installmentItems: ConvertedInstallment[];
}

export interface ConvertedPayment {
    legacyId: number;
    saleId: number;
    subtotal: number;
    discount: 0;
    total: number;
    paidAmount: number;
    installmentsPaid: number;
    lastPaymentAt: Date | null;
    status: "CONFIRMED" | "PENDING";
    methods: ConvertedMethod[];
    roundingWarnings: string[];
}

export interface PaymentIssue {
    kind: string;
    legacyId: string;
    reasons: string[];
    sourceRecord?: unknown;
}

export const EXCLUDED_LEGACY_SALE_IDS = new Set(["10023", "10188"]);
export const MYSQL_INT_MAX = 2_147_483_647;
const SAFE_CENTS_MAX = BigInt(Number.MAX_SAFE_INTEGER);

export function parseCents(value: string): bigint | null {
    let text = value.trim().replace(/R\$|BRL/gi, "").replace(/\s/g, "");
    if (!text) return null;
    if (!/^-?[\d.,]+$/.test(text)) return null;

    const negative = text.startsWith("-");
    if (text.slice(1).includes("-")) return null;
    text = text.replace(/^-/, "");
    if (text.includes(",") && text.includes(".")) {
        text = text.lastIndexOf(",") > text.lastIndexOf(".")
            ? text.replace(/\./g, "").replace(",", ".")
            : text.replace(/,/g, "");
    } else if (text.includes(",")) {
        text = text.replace(",", ".");
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;

    const [whole = "", fraction = ""] = text.split(".");
    const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    return negative ? -amount : amount;
}

export function parseLegacyId(value: string): number | null {
    if (!/^\d+$/.test(value.trim())) return null;
    const id = Number(value.trim());
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function normalizeSourceText(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export function parseLegacyDate(value: string): Date | null {
    const text = value.trim();
    if (!text) return null;
    const legacy = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(text);
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    let day: number;
    let month: number;
    let year: number;
    if (legacy) {
        day = Number(legacy[1]);
        month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(legacy[2]!.toLowerCase()) + 1;
        year = Number(legacy[3]);
        if (year < 100) year += year < 70 ? 2000 : 1900;
    } else if (iso) {
        year = Number(iso[1]);
        month = Number(iso[2]);
        day = Number(iso[3]);
    } else return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    return month >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? date
        : null;
}

function centsToNumber(value: bigint): number | null {
    if (value < 0n || value > SAFE_CENTS_MAX) return null;
    return Number(value) / 100;
}

function methodFromSource(value: string): PaymentMethod | null {
    switch (normalizeSourceText(value)) {
        case "CARNE": return "INSTALLMENT";
        case "CREDITO": return "CREDIT";
        case "DINHEIRO": return "MONEY";
        case "DEBITO": return "DEBIT";
        default: return null;
    }
}

function confirmedInstallment(status: string): boolean | null {
    switch (normalizeSourceText(status)) {
        case "CARNE CONCLUIDO":
        case "PAGO COM SUCESSO":
        case "PAGO COM SUCESSO NO CARTAO":
        case "PAGO COM ATRASO": return true;
        case "CARNE ABERTO":
        case "VENCIDA":
        case "ABERTA": return false;
        default: return null;
    }
}

function parseCreditInstallments(value: string): number | null {
    const matches = [...value.matchAll(/(\d+)\s*parcelas?/gi)];
    if (matches.length !== 1) return null;
    const count = Number(matches[0]![1]);
    return Number.isSafeInteger(count) && count > 0 && count <= MYSQL_INT_MAX ? count : null;
}

function actualSaleCents(value: number): bigint | null {
    if (!Number.isFinite(value) || value < 0) return null;
    const cents = Math.round(value * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.0001) return null;
    return BigInt(cents);
}

export interface PersistedSaleSnapshot {
    id: number;
    total: number | null;
    branchId: string;
    hasPayment: boolean;
}

export interface PaymentConversionResult {
    plans: ConvertedPayment[];
    issues: PaymentIssue[];
    excluded: number;
    entriesIdentified: number;
    installmentsAnalyzed: number;
    installmentsConfirmed: number;
    installmentsPending: number;
    roundingWarnings: PaymentIssue[];
}

export function convertPayments(args: {
    sales: OldPaymentSale[];
    installments: OldInstallment[];
    saleMapping: Map<number, MappingRow>;
    persistedSales: Map<number, PersistedSaleSnapshot>;
    branchId: string;
}): PaymentConversionResult {
    const { sales, installments, saleMapping, persistedSales, branchId } = args;
    const issues: PaymentIssue[] = [];
    const roundingWarnings: PaymentIssue[] = [];
    const salesById = new Map<number, OldPaymentSale[]>();
    const installmentsBySale = new Map<number, OldInstallment[]>();
    const carIds = new Set<string>();
    let excluded = 0;
    let entriesIdentified = 0;
    let installmentsAnalyzed = 0;
    let installmentsConfirmed = 0;
    let installmentsPending = 0;

    for (const source of sales) {
        if (EXCLUDED_LEGACY_SALE_IDS.has(source.ateId.trim())) {
            excluded++;
            continue;
        }
        const entryValue = source.ateEntrada.trim() ? parseCents(source.ateEntrada) : 0n;
        if (entryValue !== null && entryValue > 0n) entriesIdentified++;
        const id = parseLegacyId(source.ateId);
        if (id === null) {
            issues.push({ kind: "INVALID_SALE_ID", legacyId: source.ateId, reasons: [`ID de atendimento inválido: ${source.ateId}`], sourceRecord: source });
            continue;
        }
        const group = salesById.get(id) ?? [];
        group.push(source);
        salesById.set(id, group);
    }

    for (const source of installments) {
        if (EXCLUDED_LEGACY_SALE_IDS.has(source.carAtendimento.trim())) continue;
        const saleId = parseLegacyId(source.carAtendimento);
        if (saleId === null || !salesById.has(saleId)) {
            issues.push({
                kind: "ORPHAN_INSTALLMENT",
                legacyId: source.carAtendimento,
                reasons: [`Parcela ${source.carId} não corresponde a atendimento incluído em atendimento.csv.`],
                sourceRecord: source,
            });
            continue;
        }
        if (source.carId.trim()) {
            if (carIds.has(source.carId.trim())) {
                issues.push({ kind: "DUPLICATE_INSTALLMENT_ID", legacyId: source.carAtendimento, reasons: [`carId duplicado: ${source.carId}`], sourceRecord: source });
            }
            carIds.add(source.carId.trim());
        }
        const group = installmentsBySale.get(saleId) ?? [];
        group.push(source);
        installmentsBySale.set(saleId, group);
    }

    const duplicateIds = new Set([...salesById].filter(([, rows]) => rows.length > 1).map(([id]) => id));
    for (const id of duplicateIds) {
        issues.push({ kind: "DUPLICATE_SALE_ID", legacyId: String(id), reasons: [`ateId duplicado: ${id}`], sourceRecord: salesById.get(id) });
    }
    const mappedTargets = new Map<number, number[]>();
    for (const legacyId of salesById.keys()) {
        const targetId = saleMapping.get(legacyId)?.newId;
        if (targetId === undefined) continue;
        const mappedLegacyIds = mappedTargets.get(targetId) ?? [];
        mappedLegacyIds.push(legacyId);
        mappedTargets.set(targetId, mappedLegacyIds);
    }
    const duplicateTargetIds = new Set<number>();
    for (const [targetId, legacyIds] of mappedTargets) {
        if (legacyIds.length < 2) continue;
        duplicateTargetIds.add(targetId);
        issues.push({ kind: "DUPLICATE_SALE_MAPPING", legacyId: legacyIds.join(","), reasons: [`Mais de um atendimento aponta para Sale ${targetId}: ${legacyIds.join(", ")}.`] });
    }

    const plans: ConvertedPayment[] = [];
    for (const [legacyId, rows] of salesById) {
        if (duplicateIds.has(legacyId)) continue;
        const source = rows[0]!;
        const reasons: string[] = [];
        const mapping = saleMapping.get(legacyId);
        const sale = mapping ? persistedSales.get(mapping.newId) : undefined;
        const sourceTotal = parseCents(source.ateTotal);
        const entryCents = source.ateEntrada.trim() ? parseCents(source.ateEntrada) : 0n;
        const mainMethod = methodFromSource(source.ateFormaPagamento);
        const related = installmentsBySale.get(legacyId) ?? [];

        if (mainMethod !== "INSTALLMENT" && related.length > 0) {
            reasons.push(`Atendimento ${legacyId} não é CARNÊ, mas possui ${related.length} parcelas em carne.csv.`);
        }
        if (!mapping) reasons.push(`Atendimento ${legacyId} não possui mapping de Sale.`);
        else if (duplicateTargetIds.has(mapping.newId)) reasons.push(`Sale ${mapping.newId} está mapeada por múltiplos atendimentos.`);
        else if (!sale) reasons.push(`Sale ${mapping.newId} do atendimento ${legacyId} não existe no tenant configurado.`);
        else {
            if (sale.branchId !== branchId) reasons.push(`Sale ${sale.id} pertence a branch ${sale.branchId}, esperada ${branchId}.`);
            if (sale.hasPayment) reasons.push(`Sale ${sale.id} já possui Payment; duplicidade bloqueada.`);
            if (sale.total === null) reasons.push(`Sale ${sale.id} não possui total no banco.`);
        }
        if (sourceTotal === null) reasons.push(`ateTotal inválido: ${source.ateTotal}`);
        if (entryCents === null) reasons.push(`ateEntrada inválida: ${source.ateEntrada}`);
        if (entryCents !== null && entryCents < 0n) reasons.push(`ateEntrada não pode ser negativa: ${source.ateEntrada}`);
        if (sourceTotal !== null && entryCents !== null && entryCents > sourceTotal) reasons.push(`ateEntrada supera o total da venda (${source.ateEntrada} > ${source.ateTotal}).`);
        if (!mainMethod && sourceTotal !== null && entryCents !== null && sourceTotal !== entryCents) {
            reasons.push(`ateFormaPagamento desconhecida ou vazia: "${source.ateFormaPagamento}".`);
        }
        if (sourceTotal !== null && sale?.total !== null && sale?.total !== undefined) {
            const storedTotal = actualSaleCents(sale.total);
            if (storedTotal === null) reasons.push(`Sale ${sale.id} contém total não financeiro: ${sale.total}.`);
            else if (storedTotal !== sourceTotal) reasons.push(`Total de Sale diverge de ateTotal (${sale.total} x ${source.ateTotal}).`);
        }

        const total = sourceTotal === null ? null : centsToNumber(sourceTotal);
        const entry = entryCents === null ? null : centsToNumber(entryCents);
        if (sourceTotal !== null && total === null) reasons.push("ateTotal excede a precisão numérica segura do schema.");
        if (entryCents !== null && entry === null) reasons.push("ateEntrada excede a precisão numérica segura do schema.");

        const purchaseDate = parseLegacyDate(source.ateDataCompra);
        if (!purchaseDate) reasons.push(`ateDataCompra inválida ou ausente: ${source.ateDataCompra}`);

        const methods: ConvertedMethod[] = [];
        let paidCents = 0n;
        let paidInstallmentCount = 0;
        const paymentDates: Date[] = [];
        const warnings: string[] = [];
        if (entryCents !== null && entryCents > 0n && entry !== null) {
            if (!purchaseDate) reasons.push("Não é possível definir paidAt da entrada sem ateDataCompra válida.");
            methods.push({ method: "MONEY", isEntry: true, amount: entry, installments: 1, firstDueDate: null, isPaid: true, paidAt: purchaseDate, installmentItems: [] });
            paidCents += entryCents;
            if (purchaseDate) paymentDates.push(purchaseDate);
        }

        const principalCents = sourceTotal !== null && entryCents !== null ? sourceTotal - entryCents : null;
        if (principalCents !== null && principalCents > 0n && mainMethod && total !== null) {
            const principal = centsToNumber(principalCents);
            if (principal === null) reasons.push("Valor do método principal excede a precisão numérica segura do schema.");
            else if (mainMethod === "INSTALLMENT") {
                if (related.length === 0) reasons.push("Atendimento CARNÊ com saldo principal não possui parcelas em carne.csv.");
                const declaredCounts = new Set<number>();
                const sequences = new Set<number>();
                const converted: ConvertedInstallment[] = [];
                let installmentTotal = 0n;
                let confirmedTotal = 0n;
                for (const raw of related) {
                    const declared = parseLegacyId(raw.carParcelas);
                    const sequence = parseLegacyId(raw.carNumeroParcela);
                    const amountCents = parseCents(raw.carValorParcela);
                    const dueDate = parseLegacyDate(raw.carVencimento);
                    const state = confirmedInstallment(raw.carParcelaStatus);
                    const paidDateSource = raw.carDataPagamento.trim();
                    const paidDate = paidDateSource ? parseLegacyDate(raw.carDataPagamento) : null;
                    if (declared === null || declared > MYSQL_INT_MAX) reasons.push(`carParcelas inválido na parcela ${raw.carId}: ${raw.carParcelas}`);
                    else declaredCounts.add(declared);
                    if (sequence === null || sequence > MYSQL_INT_MAX) reasons.push(`carNumeroParcela inválido na parcela ${raw.carId}: ${raw.carNumeroParcela}`);
                    else if (sequences.has(sequence)) reasons.push(`Sequência de parcela duplicada no atendimento ${legacyId}: ${sequence}.`);
                    else sequences.add(sequence);
                    if (amountCents === null || amountCents < 0n) reasons.push(`carValorParcela inválido na parcela ${raw.carId}: ${raw.carValorParcela}`);
                    if (!dueDate) reasons.push(`carVencimento inválido ou ausente na parcela ${raw.carId}: ${raw.carVencimento}`);
                    if (state === null) reasons.push(`Status de parcela desconhecido na parcela ${raw.carId}: ${raw.carParcelaStatus}`);
                    if (paidDateSource && !paidDate) reasons.push(`carDataPagamento inválida na parcela ${raw.carId}: ${raw.carDataPagamento}`);
                    if (state === true && !paidDate) reasons.push(`Parcela confirmada ${raw.carId} sem carDataPagamento válido.`);
                    if (state === false && paidDateSource) reasons.push(`Parcela pendente ${raw.carId} possui carDataPagamento preenchido.`);

                    if (amountCents === null || amountCents < 0n || dueDate === null || sequence === null || state === null) continue;
                    const amount = centsToNumber(amountCents);
                    if (amount === null) {
                        reasons.push(`Valor da parcela ${raw.carId} excede a precisão numérica segura do schema.`);
                        continue;
                    }
                    installmentTotal += amountCents;
                    const paidAmount = state ? amount : 0;
                    if (state) {
                        confirmedTotal += amountCents;
                        paidInstallmentCount++;
                        if (paidDate) paymentDates.push(paidDate);
                    }
                    converted.push({ sequence, amount, paidAmount, dueDate, paidAt: state ? paidDate : null, state: state ? "CONFIRMED" : "PENDING" });
                }
                installmentsAnalyzed += related.length;
                installmentsConfirmed += converted.filter((item) => item.state === "CONFIRMED").length;
                installmentsPending += converted.filter((item) => item.state === "PENDING").length;
                if (declaredCounts.size > 1) reasons.push(`carParcelas diverge entre registros do atendimento ${legacyId}.`);
                const declared = declaredCounts.values().next().value as number | undefined;
                if (declared !== undefined && declared !== related.length) reasons.push(`Atendimento ${legacyId} declara ${declared} parcelas, mas possui ${related.length} linhas.`);
                if (sequences.size === related.length && (sequences.size === 0 || Math.min(...sequences) !== 1 || Math.max(...sequences) !== related.length)) {
                    reasons.push(`Sequências de parcelas do atendimento ${legacyId} devem cobrir 1..${related.length}.`);
                }
                const difference = installmentTotal - principalCents;
                if (difference !== 0n) {
                    // A one-cent discrepancy is accepted only as a disclosed rounding case; source amounts stay unchanged.
                    const sameRoundedAmount = converted.length > 1 && new Set(converted.map((item) => item.amount)).size === 1;
                    if ((difference === 1n || difference === -1n) && sameRoundedAmount) {
                        const warning = `Diferença de arredondamento de ${difference > 0n ? "+" : "-"}R$ 0,01 entre saldo do carnê e soma das parcelas; valores de origem preservados.`;
                        warnings.push(warning);
                        roundingWarnings.push({ kind: "INSTALLMENT_ROUNDING", legacyId: String(legacyId), reasons: [warning], sourceRecord: related });
                    } else {
                        reasons.push(`Soma das parcelas (${centsToNumber(installmentTotal)}) diverge do saldo destinado ao carnê (${principal}).`);
                    }
                }
                const confirmedPaid = centsToNumber(confirmedTotal);
                if (confirmedPaid === null) reasons.push(`Soma paga do carnê excede a precisão segura no atendimento ${legacyId}.`);
                else paidCents += confirmedTotal;
                const isPaid = converted.length > 0 && converted.length === related.length && converted.every((item) => item.state === "CONFIRMED");
                const latestInstallmentPayment = converted
                    .filter((item) => item.state === "CONFIRMED" && item.paidAt)
                    .map((item) => item.paidAt!)
                    .sort((a, b) => a.getTime() - b.getTime());
                methods.push({
                    method: "INSTALLMENT",
                    isEntry: false,
                    amount: principal,
                    installments: declared ?? related.length,
                    firstDueDate: converted.find((item) => item.sequence === 1)?.dueDate ?? null,
                    isPaid,
                    paidAt: isPaid && latestInstallmentPayment.length > 0 ? latestInstallmentPayment[latestInstallmentPayment.length - 1]! : null,
                    installmentItems: converted.sort((a, b) => a.sequence - b.sequence),
                });
            } else if (mainMethod === "CREDIT") {
                const count = parseCreditInstallments(source.atePago);
                if (count === null) reasons.push(`Não foi possível extrair quantidade de parcelas de crédito de atePago: ${source.atePago}`);
                if (!purchaseDate) reasons.push("Não é possível definir paidAt do crédito sem ateDataCompra válida.");
                if (count !== null) methods.push({ method: "CREDIT", isEntry: false, amount: principal, installments: count, firstDueDate: null, isPaid: true, paidAt: purchaseDate, installmentItems: [] });
                paidCents += principalCents;
                if (purchaseDate) paymentDates.push(purchaseDate);
            } else {
                if (!purchaseDate) reasons.push(`Não é possível definir paidAt de ${mainMethod} sem ateDataCompra válida.`);
                methods.push({ method: mainMethod, isEntry: false, amount: principal, installments: 1, firstDueDate: null, isPaid: true, paidAt: purchaseDate, installmentItems: [] });
                paidCents += principalCents;
                if (purchaseDate) paymentDates.push(purchaseDate);
            }
        } else if (principalCents !== null && principalCents < 0n) {
            reasons.push("Valor do método principal não pode ser negativo.");
        }

        if (mainMethod === "INSTALLMENT" && principalCents === 0n && related.length > 0) {
            reasons.push("Há parcelas de carnê para atendimento sem saldo destinado ao carnê.");
        }
        if (sourceTotal === 0n && entryCents === 0n && !mainMethod) {
            // A zero-total sale needs no payment method, but no evidence in this source row explains the blank method.
            reasons.push("Venda sem método de pagamento identificável.");
        }

        const paidAmount = centsToNumber(paidCents);
        if (paidAmount === null) reasons.push("paidAmount excede a precisão numérica segura do schema.");
        if (sourceTotal !== null && paidCents > sourceTotal) reasons.push(`Valor pago acumulado (${paidCents}) supera o total (${sourceTotal}).`);
        if (reasons.length || !mapping || !sale || sourceTotal === null || total === null || paidAmount === null || principalCents === null) {
            issues.push({ kind: "INVALID_PAYMENT", legacyId: String(legacyId), reasons: [...new Set(reasons)], sourceRecord: source });
            continue;
        }
        const sortedPaymentDates = paymentDates.sort((a, b) => a.getTime() - b.getTime());
        const latestPayment = sortedPaymentDates[sortedPaymentDates.length - 1] ?? null;
        plans.push({
            legacyId,
            saleId: mapping.newId,
            subtotal: total,
            discount: 0,
            total,
            paidAmount,
            installmentsPaid: paidInstallmentCount,
            lastPaymentAt: latestPayment,
            status: paidCents >= sourceTotal ? "CONFIRMED" : "PENDING",
            methods,
            roundingWarnings: warnings,
        });
    }

    return { plans, issues, excluded, entriesIdentified, installmentsAnalyzed, installmentsConfirmed, installmentsPending, roundingWarnings };
}
