// migrations/oticacrista/08-2026/converters/client.converter.ts

import type { Gender } from "@prisma/client";
import type {
    ClientSource,
} from "../loaders/pesCliente.loader";

export interface ClientConverted {
    name: string;
    nickname: string | null;
    cpf: string | null;
    rg: string | null;
    bornDate: Date | null;
    gender: Gender | null;
    fatherName: string | null;
    motherName: string | null;
    spouse: string | null;
    email: string | null;
    company: string | null;
    occupation: string | null;
    street: string | null;
    number: string | null;
    neighborhood: string | null;
    city: string | null;
    uf: string | null;
    cep: string | null;
    complement: string | null;
    isBlacklisted: boolean;
    obs: string | null;
    phone01: string | null;
    phone02: string | null;
    phone03: string | null;
    reference01: string | null;
    reference02: string | null;
    reference03: string | null;
}

function clean(
    value: string | null | undefined,
): string | null {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const result = value.trim();

    return result === ""
        ? null
        : result;
}

export function normalizeCpf(
    value: string | null | undefined,
): string | null {
    const cleaned = clean(value);

    if (!cleaned) {
        return null;
    }

    const digits =
        cleaned.replace(/\D/g, "");

    return digits || null;
}

export function normalizePhone(
    value: string | null | undefined,
): string | null {
    const cleaned = clean(value);

    if (!cleaned) {
        return null;
    }

    return (
        cleaned.replace(/\D/g, "") ||
        null
    );
}

export function normalizeName(
    value: string | null | undefined,
): string | null {
    const cleaned = clean(value);

    if (!cleaned) {
        return null;
    }

    return cleaned
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .replace(/\s+/g, " ")
        .toUpperCase();
}

export function normalizeRg(
    value: string | null | undefined,
): string | null {
    const cleaned = clean(value);

    if (!cleaned) {
        return null;
    }

    return cleaned
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .replace(/\s+/g, "")
        .toUpperCase();
}

function parseDate(
    value: string | null | undefined,
): Date | null {
    const cleaned = clean(value);

    if (!cleaned) {
        return null;
    }

    const match =
        cleaned.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/,
        );

    if (!match) {
        return null;
    }

    const month =
        Number(match[1]);

    const day =
        Number(match[2]);

    let year =
        Number(match[3]);

    if (year < 100) {
        /*
         * 00–25 → 2000–2025
         * 26–99 → 1926–1999
         */
        year =
            year <= 25
                ? 2000 + year
                : 1900 + year;
    }

    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day,
            ),
        );

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !==
        month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
}

function convertGender(
    value: string | null | undefined,
): Gender | null {
    const normalized =
        normalizeName(value);

    if (!normalized) {
        return null;
    }

    if (
        normalized === "MASCULINO"
    ) {
        return "MALE";
    }

    if (
        normalized === "FEMININO"
    ) {
        return "FEMALE";
    }

    return "OTHER";
}

function convertSpc(
    value: string | null | undefined,
): boolean {
    const normalized =
        normalizeName(value);

    return normalized === "SIM";
}

function buildReference(
    name: string | null | undefined,
    contact: string | null | undefined,
): string | null {
    const referenceName =
        clean(name);

    const referenceContact =
        clean(contact);

    if (
        !referenceName &&
        !referenceContact
    ) {
        return null;
    }

    if (
        referenceName &&
        referenceContact
    ) {
        return `${referenceName} - ${referenceContact}`;
    }

    return (
        referenceName ??
        referenceContact
    );
}

function buildObs(
    pessoa: ClientSource["pessoa"],
    cliente: ClientSource["cliente"],
): string | null {
    const observations: string[] = [];

    const contato =
        clean(pessoa.pesContato);

    if (contato) {
        observations.push(
            `pesContato: ${contato}`,
        );
    }

    const site =
        clean(pessoa.pesSite);

    if (site) {
        observations.push(
            `pesSite: ${site}`,
        );
    }

    const atendimentos =
        clean(
            cliente.cliAtendimentos,
        );

    if (atendimentos) {
        observations.push(
            `cliAtendimentos: ${atendimentos}`,
        );
    }

    return observations.length > 0
        ? observations.join("\n")
        : null;
}

export function convertClient(
    source: ClientSource,
): ClientConverted {
    const {
        pessoa,
        cliente,
    } = source;

    return {
        name:
            clean(pessoa.pesNome) ??
            "SEM NOME",

        nickname: null,

        cpf:
            normalizeCpf(
                pessoa.pesDoc,
            ),

        rg:
            clean(cliente.cliRg),

        bornDate:
            parseDate(
                pessoa.pesDataNasc,
            ),

        gender:
            convertGender(
                pessoa.pesSexo,
            ),

        /*
         * A filiação completa é preservada
         * no campo motherName.
         *
         * Não tentamos separar mãe e pai.
         */
        motherName:
            clean(
                cliente.cliFiliacao,
            ),

        fatherName: null,

        spouse:
            clean(
                cliente.cliConjuge,
            ),

        email:
            clean(pessoa.pesEmail),

        company:
            clean(cliente.cliEmpresa),

        occupation:
            clean(
                cliente.cliProfissao,
            ),

        street:
            clean(pessoa.pesRua),

        /*
         * Não existe separação confiável
         * do número em pesRua.
         */
        number: null,

        neighborhood:
            clean(pessoa.pesBairro),

        city:
            clean(pessoa.pesCidade),

        uf:
            clean(pessoa.pesUf),

        cep:
            clean(pessoa.pesCep),

        complement:
            clean(pessoa.pesComp),

        isBlacklisted:
            convertSpc(
                cliente.cliSpc,
            ),

        obs:
            buildObs(
                pessoa,
                cliente,
            ),

        phone01:
            clean(pessoa.pesCel),

        phone02:
            clean(pessoa.pesTel),

        phone03: null,

        reference01:
            buildReference(
                cliente.cliRefNome1,
                cliente.cliRefContato1,
            ),

        reference02:
            buildReference(
                cliente.cliRefNome2,
                cliente.cliRefContato2,
            ),

        reference03:
            buildReference(
                cliente.cliRefNome3,
                cliente.cliRefContato3,
            ),
    };
}