// migrations/oticacrista/08-2026/loaders/pesCliente.loader.ts

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export interface PessoaCsv {
    pesId: string;
    pesNome: string;
    pesCel: string;
    pesTel: string;
    pesRua: string;
    pesBairro: string;
    pesCidade: string;
    pesUf: string;
    pesCep: string;
    pesComp: string;
    pesEmail: string;
    pesTipo: string;
    pesDoc: string;
    pesDataNasc: string;
    pesSexo: string;
    pesContato: string;
    pesSite: string;
}

export interface PesClienteCsv {
    cliPessoa: string;
    cliConjuge: string;
    cliFiliacao: string;
    cliRefNome1: string;
    cliRefContato1: string;
    cliRefNome2: string;
    cliRefContato2: string;
    cliRefNome3: string;
    cliRefContato3: string;
    cliSpc: string;
    cliRg: string;
    cliProfissao: string;
    cliEmpresa: string;
    cliAtendimentos: string;
}

export interface ClientSource {
    pessoa: PessoaCsv;
    cliente: PesClienteCsv;
}

export interface OrphanClient {
    cliente: PesClienteCsv;
    reason: string;
}

export interface ClientSources {
    sources: ClientSource[];
    orphanClients: OrphanClient[];
}

function loadCsv<T>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Arquivo não encontrado: ${filePath}`,
        );
    }

    const content = fs.readFileSync(
        filePath,
        "utf-8",
    );

    return parse(content, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
        trim: true,
    }) as T[];
}

export function loadClientSources(): ClientSources {
    const pessoaPath = path.resolve(
        __dirname,
        "../input/pessoa.csv",
    );

    const pesClientePath = path.resolve(
        __dirname,
        "../input/pesCliente.csv",
    );

    const pessoas =
        loadCsv<PessoaCsv>(pessoaPath);

    const clientes =
        loadCsv<PesClienteCsv>(pesClientePath);

    const pessoaMap =
        new Map<string, PessoaCsv>();

    for (const pessoa of pessoas) {
        pessoaMap.set(
            pessoa.pesId,
            pessoa,
        );
    }

    const sources: ClientSource[] = [];
    const orphanClients: OrphanClient[] = [];

    for (const cliente of clientes) {
        const pessoa =
            pessoaMap.get(
                cliente.cliPessoa,
            );

        if (!pessoa) {
            orphanClients.push({
                cliente,
                reason:
                    "cliPessoa não possui correspondente em pessoa.csv.",
            });

            continue;
        }

        sources.push({
            pessoa,
            cliente,
        });
    }

    return {
        sources,
        orphanClients,
    };
}