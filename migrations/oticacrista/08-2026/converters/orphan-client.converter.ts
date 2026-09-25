import type {
    ClientConverted,
} from "./client.converter";

import type {
    OrphanClient,
    OrphanPessoa,
} from "../loaders/pesCliente.loader";

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

function normalizeCpf(
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

function normalizePhone(
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

function normalizeName(
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

function parseDate(
    value: string | null | undefined,
): Date | null {
    const cleaned = clean(value);

    if (!cleaned) {
        return null;
    }

    const match = cleaned.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/,
    );

    if (!match) {
        return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);

    if (year < 100) {
        year =
            year <= 25
                ? 2000 + year
                : 1900 + year;
    }

    const date = new Date(
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
): ClientConverted["gender"] {
    const normalized =
        normalizeName(value);

    if (normalized === "MASCULINO") {
        return "MALE";
    }

    if (normalized === "FEMININO") {
        return "FEMALE";
    }

    if (!normalized) {
        return null;
    }

    return "OTHER";
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

function buildOrphanName(
    oldId: string,
    name?: string | null,
): string {
    const cleaned = clean(name);

    if (cleaned) {
        return cleaned;
    }

    return `CLIENTE LEGADO ${oldId}`;
}

export function convertOrphanClient(
    orphan: OrphanClient,
): ClientConverted {
    const {
        cliente,
    } = orphan;

    return {
        name: buildOrphanName(
            cliente.cliPessoa,
        ),
        nickname: null,
        cpf: null,
        rg: clean(cliente.cliRg),
        bornDate: null,
        gender: null,
        fatherName: null,
        motherName: clean(
            cliente.cliFiliacao,
        ),
        spouse: clean(
            cliente.cliConjuge,
        ),
        email: null,
        company: clean(
            cliente.cliEmpresa,
        ),
        occupation: clean(
            cliente.cliProfissao,
        ),
        street: null,
        number: null,
        neighborhood: null,
        city: null,
        uf: null,
        cep: null,
        complement: null,
        isBlacklisted:
            normalizeName(
                cliente.cliSpc,
            ) === "SIM",
        obs: clean(
            cliente.cliAtendimentos,
        ),
        phone01: null,
        phone02: null,
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

export function convertOrphanPessoa(
    orphan: OrphanPessoa,
): ClientConverted {
    const {
        pessoa,
    } = orphan;

    return {
        name: buildOrphanName(
            pessoa.pesId,
            pessoa.pesNome,
        ),
        nickname: null,
        cpf: normalizeCpf(
            pessoa.pesDoc,
        ),
        rg: null,
        bornDate: parseDate(
            pessoa.pesDataNasc,
        ),
        gender: convertGender(
            pessoa.pesSexo,
        ),
        fatherName: null,
        motherName: null,
        spouse: null,
        email: clean(
            pessoa.pesEmail,
        ),
        company: null,
        occupation: null,
        street: clean(
            pessoa.pesRua,
        ),
        number: null,
        neighborhood: clean(
            pessoa.pesBairro,
        ),
        city: clean(
            pessoa.pesCidade,
        ),
        uf: clean(
            pessoa.pesUf,
        ),
        cep: clean(
            pessoa.pesCep,
        ),
        complement: clean(
            pessoa.pesComp,
        ),
        isBlacklisted: false,
        obs: buildPessoaObs(
            pessoa.pesContato,
            pessoa.pesSite,
        ),
        phone01: clean(
            pessoa.pesCel,
        ),
        phone02: clean(
            pessoa.pesTel,
        ),
        phone03: null,
        reference01: null,
        reference02: null,
        reference03: null,
    };
}

function buildPessoaObs(
    contato: string | null | undefined,
    site: string | null | undefined,
): string | null {
    const observations: string[] = [];

    const normalizedContato =
        clean(contato);

    if (normalizedContato) {
        observations.push(
            `pesContato: ${normalizedContato}`,
        );
    }

    const normalizedSite =
        clean(site);

    if (normalizedSite) {
        observations.push(
            `pesSite: ${normalizedSite}`,
        );
    }

    return observations.length
        ? observations.join("\n")
        : null;
}