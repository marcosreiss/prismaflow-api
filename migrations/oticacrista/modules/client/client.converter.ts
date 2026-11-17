import type { Prisma } from "@prisma/client";
import type { ClientSource } from "./client.loader";

const ABSENT_MARKERS = new Set([
    "", "-", "--", "---", "----", "N/A", "NA", "NULL", "NULO",
    "NÃO INFORMADO", "NAO INFORMADO", "NÃO CONSTA", "NAO CONSTA",
    "IGNORADO", "INDEFINIDO", "0",
]);

function canonicalText(value: string | null | undefined): string {
    return (value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .toUpperCase();
}

export function cleanOptional(value: string | null | undefined): string | null {
    const text = value?.trim() ?? "";
    const normalized = canonicalText(text);
    if (ABSENT_MARKERS.has(normalized) || normalized.startsWith("SEM ")) return null;
    return text || null;
}

export function isComparable(value: string | null | undefined): boolean {
    return cleanOptional(value) !== null;
}

export function normalizeDigits(value: string | null | undefined): string | null {
    const cleaned = cleanOptional(value);
    if (!cleaned) return null;
    const digits = cleaned.replace(/\D/g, "");
    return digits && !/^0+$/.test(digits) ? digits : null;
}

export function normalizeRg(value: string | null | undefined): string | null {
    const cleaned = cleanOptional(value);
    if (!cleaned) return null;
    const normalized = canonicalText(cleaned).replace(/[^A-Z0-9]/g, "");
    return normalized || null;
}

export function normalizeName(value: string | null | undefined): string | null {
    const cleaned = cleanOptional(value);
    return cleaned ? canonicalText(cleaned) : null;
}

function parseDate(value: string | null | undefined): Date | null {
    const cleaned = cleanOptional(value);
    if (!cleaned) return null;

    const match = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
    if (!match) return null;

    // O arquivo legado usa mês/dia/ano (ex.: 1/24/58).
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year <= 25 ? 2000 : 1900;

    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? date
        : null;
}

function convertGender(value: string): "MALE" | "FEMALE" | "OTHER" | null {
    const gender = canonicalText(value);
    if (["M", "MASCULINO", "HOMEM"].includes(gender)) return "MALE";
    if (["F", "FEMININO", "MULHER"].includes(gender)) return "FEMALE";
    if (["OUTRO", "OUTRA", "OTHER"].includes(gender)) return "OTHER";
    return null;
}

function makeReference(name: string, phone: string): string | null {
    const referenceName = cleanOptional(name);
    const referencePhone = normalizeDigits(phone);
    if (referenceName && referencePhone) return `${referenceName} - ${referencePhone}`;
    return referenceName ?? referencePhone;
}

function splitParentage(value: string): { fatherName: string | null; motherName: string | null } {
    const affiliation = cleanOptional(value);
    if (!affiliation) return { fatherName: null, motherName: null };
    const parts = affiliation.split(/\s+E\s+/i).map(cleanOptional).filter((part): part is string => !!part);
    if (parts.length === 2) {
        return { fatherName: parts[0], motherName: parts[1] };
    }
    return { fatherName: null, motherName: affiliation };
}

export type ConvertedClient = Omit<Prisma.ClientUncheckedCreateInput, "tenantId" | "branchId">;

export function convertClient(source: ClientSource): ConvertedClient {
    const name = source.pesNome?.trim() || "SEM NOME";
    const parents = splitParentage(source.cliFiliacao);
    const uf = cleanOptional(source.pesUf);

    return {
        name,
        nickname: null,
        cpf: normalizeDigits(source.pesDoc),
        rg: normalizeRg(source.cliRg),
        bornDate: parseDate(source.pesDataNasc),
        gender: convertGender(source.pesSexo),
        ...parents,
        spouse: cleanOptional(source.cliConjuge),
        email: cleanOptional(source.pesEmail),
        company: cleanOptional(source.cliEmpresa),
        occupation: cleanOptional(source.cliProfissao),
        street: cleanOptional(source.pesRua),
        number: null,
        neighborhood: cleanOptional(source.pesBairro),
        city: cleanOptional(source.pesCidade),
        uf: uf?.toUpperCase() ?? null,
        cep: normalizeDigits(source.pesCep),
        complement: cleanOptional(source.pesComp),
        isBlacklisted: canonicalText(source.cliSpc) === "SIM",
        obs: [
            cleanOptional(source.pesContato) && `Contato: ${cleanOptional(source.pesContato)}`,
            cleanOptional(source.pesSite) && `Site: ${cleanOptional(source.pesSite)}`,
            cleanOptional(source.cliAtendimentos) && `Atendimentos: ${cleanOptional(source.cliAtendimentos)}`,
        ].filter(Boolean).join("\n") || null,
        phone01: normalizeDigits(source.pesCel),
        phone02: normalizeDigits(source.pesTel),
        phone03: null,
        reference01: makeReference(source.cliRefNome1, source.cliRefContato1),
        reference02: makeReference(source.cliRefNome2, source.cliRefContato2),
        reference03: makeReference(source.cliRefNome3, source.cliRefContato3),
        isActive: true,
    };
}
