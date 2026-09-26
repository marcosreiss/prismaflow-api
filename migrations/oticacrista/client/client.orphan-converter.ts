// migrations/oticacrista/client/client.orphan-converter.ts

import type { ClientConverted } from "./client.converter";
import {
    clean,
    normalizeCpf,
    normalizeName,
    parseDate,
    convertGender,
    buildReference,
} from "./client.converter";
import type { OrphanClient, OrphanPessoa } from "./client.loader";

function buildOrphanName(oldId: string, name?: string | null): string {
    const cleaned = clean(name);

    return cleaned ?? `CLIENTE LEGADO ${oldId}`;
}

function buildPessoaObs(
    contato: string | null | undefined,
    site: string | null | undefined,
): string | null {
    const observations: string[] = [];

    const normalizedContato = clean(contato);

    if (normalizedContato) {
        observations.push(`pesContato: ${normalizedContato}`);
    }

    const normalizedSite = clean(site);

    if (normalizedSite) {
        observations.push(`pesSite: ${normalizedSite}`);
    }

    return observations.length ? observations.join("\n") : null;
}

/**
 * pesCliente sem pessoa correspondente: só temos os dados de pesCliente.csv.
 * O nome fica genérico ("CLIENTE LEGADO {id}") porque pessoa.csv, que
 * teria o nome real, não existe para esse registro.
 */
export function convertOrphanClient(orphan: OrphanClient): ClientConverted {
    const { cliente } = orphan;

    return {
        name: buildOrphanName(cliente.cliPessoa),
        nickname: null,
        cpf: null,
        rg: clean(cliente.cliRg),
        bornDate: null,
        gender: null,
        fatherName: null,
        motherName: clean(cliente.cliFiliacao),
        spouse: clean(cliente.cliConjuge),
        email: null,
        company: clean(cliente.cliEmpresa),
        occupation: clean(cliente.cliProfissao),
        street: null,
        number: null,
        neighborhood: null,
        city: null,
        uf: null,
        cep: null,
        complement: null,
        isBlacklisted: normalizeName(cliente.cliSpc) === "SIM",
        obs: clean(cliente.cliAtendimentos),
        phone01: null,
        phone02: null,
        phone03: null,
        reference01: buildReference(cliente.cliRefNome1, cliente.cliRefContato1),
        reference02: buildReference(cliente.cliRefNome2, cliente.cliRefContato2),
        reference03: buildReference(cliente.cliRefNome3, cliente.cliRefContato3),
    };
}

/**
 * pessoa sem pesCliente correspondente: só temos os dados de pessoa.csv.
 */
export function convertOrphanPessoa(orphan: OrphanPessoa): ClientConverted {
    const { pessoa } = orphan;

    return {
        name: buildOrphanName(pessoa.pesId, pessoa.pesNome),
        nickname: null,
        cpf: normalizeCpf(pessoa.pesDoc),
        rg: null,
        bornDate: parseDate(pessoa.pesDataNasc),
        gender: convertGender(pessoa.pesSexo),
        fatherName: null,
        motherName: null,
        spouse: null,
        email: clean(pessoa.pesEmail),
        company: null,
        occupation: null,
        street: clean(pessoa.pesRua),
        number: null,
        neighborhood: clean(pessoa.pesBairro),
        city: clean(pessoa.pesCidade),
        uf: clean(pessoa.pesUf),
        cep: clean(pessoa.pesCep),
        complement: clean(pessoa.pesComp),
        isBlacklisted: false,
        obs: buildPessoaObs(pessoa.pesContato, pessoa.pesSite),
        phone01: clean(pessoa.pesCel),
        phone02: clean(pessoa.pesTel),
        phone03: null,
        reference01: null,
        reference02: null,
        reference03: null,
    };
}