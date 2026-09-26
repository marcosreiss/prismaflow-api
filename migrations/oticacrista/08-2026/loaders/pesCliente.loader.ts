// migrations/oticacrista/08-2026/loaders/pesCliente.loader.ts

/**
 * Ler e estruturar os dados antigos.
 * responsável por carregar os dados de pesCliente.csv e pessoa.csv
 */

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

export interface OrphanPessoa {
    pessoa: PessoaCsv;
    reason: string;
}

export interface ClientSources {
    sources: ClientSource[];
    orphanClients: OrphanClient[];
    orphanPessoas: OrphanPessoa[];
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

    const clientePessoaIds =
        new Set<string>();

    const sources: ClientSource[] = [];
    const orphanClients: OrphanClient[] = [];
    const orphanPessoas: OrphanPessoa[] = [];

    /**
     * Consolida pesCliente + pessoa quando ambos existem.
     *
     * Quando o pesCliente existe, mas sua pessoa correspondente
     * não existe, o registro é preservado como órfão para que
     * a migration possa criar um Client parcial e gerar o mapping.
     */
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

        clientePessoaIds.add(
            cliente.cliPessoa,
        );

        sources.push({
            pessoa,
            cliente,
        });
    }

    /**
     * Identifica pessoas que existem em pessoa.csv,
     * mas não possuem registro correspondente em pesCliente.csv.
     *
     * Essas pessoas também devem ser preservadas para que
     * a migration possa criar um Client utilizando somente
     * os dados disponíveis em pessoa.csv.
     */
    for (const pessoa of pessoas) {
        if (
            !clientePessoaIds.has(
                pessoa.pesId,
            )
        ) {
            orphanPessoas.push({
                pessoa,
                reason:
                    "pessoa não possui correspondente em pesCliente.csv.",
            });
        }
    }

    return {
        sources,
        orphanClients,
        orphanPessoas,
    };
}

