// migrations/oticacrista/08-2026/03-client.ts

import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { PrismaClient, Client } from "@prisma/client";

import {
    loadPessoa,
    PessoaCsv,
} from "./loaders/pessoa.loader";

import {
    loadPesCliente,
    PesClienteCsv,
} from "./loaders/pesCliente.loader";

import {
    convertClient,
    normalizeCpf,
    normalizeName,
    normalizePhone,
} from "./converters/client.converter";

import {
    createTemporaryMappingFile,
    appendTemporaryMapping,
    finalizeClientMapping,
    discardTemporaryMapping,
    loadClientMapping,
} from "./mapping/client.mapping";

const prisma = new PrismaClient();

const TENANT_ID =
    "cmibvcyed00007m0118rkgft8";

const BRANCH_ID =
    "cmibvcyed00017m014r66e39w";

const DRY_RUN = true;

interface SourceRecord {
    pessoa: PessoaCsv;
    cliente: PesClienteCsv;
}

interface MatchResult {
    client: Client | null;
    matchedBy:
    | "CPF"
    | "RG"
    | "BIRTH_DATE"
    | "PHONE"
    | "PENDING";
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

    return result || null;
}

function normalizeRg(
    value: string | null | undefined,
): string | null {
    const normalized = clean(value);

    if (!normalized) {
        return null;
    }

    return normalized
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .toUpperCase();
}

function normalizeDate(
    value: Date | null,
): string | null {
    if (!value) {
        return null;
    }

    return value
        .toISOString()
        .slice(0, 10);
}

function normalizeGenderName(
    value: string | null | undefined,
): string | null {
    const normalized = normalizeName(value);

    if (!normalized) {
        return null;
    }

    return normalized;
}

function buildKey(
    name: string,
    value: string,
): string {
    return `${normalizeName(name)}|${value}`;
}

function buildClientIndexes(
    clients: Client[],
) {
    const cpfIndex = new Map<string, Client[]>();
    const rgIndex = new Map<string, Client[]>();
    const birthDateIndex = new Map<string, Client[]>();
    const phoneIndex = new Map<string, Client[]>();

    for (const client of clients) {
        const normalizedName =
            normalizeName(client.name);

        if (!normalizedName) {
            continue;
        }

        if (client.cpf) {
            const cpf =
                normalizeCpf(client.cpf);

            if (cpf) {
                const key =
                    buildKey(
                        client.name,
                        cpf,
                    );

                addToIndex(
                    cpfIndex,
                    key,
                    client,
                );
            }
        }

        if (client.rg) {
            const rg =
                normalizeRg(client.rg);

            if (rg) {
                const key =
                    buildKey(
                        client.name,
                        rg,
                    );

                addToIndex(
                    rgIndex,
                    key,
                    client,
                );
            }
        }

        if (client.bornDate) {
            const date =
                normalizeDate(
                    client.bornDate,
                );

            if (date) {
                const key =
                    buildKey(
                        client.name,
                        date,
                    );

                addToIndex(
                    birthDateIndex,
                    key,
                    client,
                );
            }
        }

        for (const phone of [
            client.phone01,
            client.phone02,
            client.phone03,
        ]) {
            const normalizedPhone =
                normalizePhone(phone);

            if (!normalizedPhone) {
                continue;
            }

            const key =
                buildKey(
                    client.name,
                    normalizedPhone,
                );

            addToIndex(
                phoneIndex,
                key,
                client,
            );
        }
    }

    return {
        cpfIndex,
        rgIndex,
        birthDateIndex,
        phoneIndex,
    };
}

function addToIndex(
    index: Map<string, Client[]>,
    key: string,
    client: Client,
): void {
    const current =
        index.get(key);

    if (current) {
        current.push(client);
    } else {
        index.set(key, [client]);
    }
}

function findUnique(
    candidates: Client[] | undefined,
): Client | null {
    if (!candidates) {
        return null;
    }

    if (candidates.length !== 1) {
        return null;
    }

    return candidates[0];
}

function findMatch(
    pessoa: PessoaCsv,
    converted: ReturnType<typeof convertClient>,
    indexes: ReturnType<typeof buildClientIndexes>,
): MatchResult {
    const name = normalizeName(
        pessoa.pesNome,
    );

    if (!name) {
        return {
            client: null,
            matchedBy: "PENDING",
        };
    }

    /*
     * 1. NOME + CPF
     */
    const cpf =
        normalizeCpf(pessoa.pesDoc);

    if (cpf) {
        const candidates =
            indexes.cpfIndex.get(
                buildKey(
                    pessoa.pesNome,
                    cpf,
                ),
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "CPF",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    /*
     * 2. NOME + RG
     */
    const rg =
        normalizeRg(converted.rg);

    if (rg) {
        const candidates =
            indexes.rgIndex.get(
                buildKey(
                    pessoa.pesNome,
                    rg,
                ),
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "RG",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    /*
     * 3. NOME + DATA DE NASCIMENTO
     */
    const birthDate =
        normalizeDate(
            converted.bornDate,
        );

    if (birthDate) {
        const candidates =
            indexes.birthDateIndex.get(
                buildKey(
                    pessoa.pesNome,
                    birthDate,
                ),
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "BIRTH_DATE",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    /*
     * 4. NOME + CELULAR
     */
    const phone =
        normalizePhone(
            pessoa.pesCel,
        );

    if (phone) {
        const candidates =
            indexes.phoneIndex.get(
                buildKey(
                    pessoa.pesNome,
                    phone,
                ),
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "PHONE",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    /*
     * Nenhuma combinação encontrou
     * uma correspondência segura.
     */
    return {
        client: null,
        matchedBy: "PENDING",
    };
}

async function askFiliation(
    pessoa: PessoaCsv,
    cliente: PesClienteCsv,
): Promise<{
    motherName: string | null;
    fatherName: string | null;
}> {
    const filiation =
        clean(cliente.cliFiliacao);

    if (!filiation) {
        return {
            motherName: null,
            fatherName: null,
        };
    }

    const matches =
        filiation.match(/\bE\b/gi);

    const occurrences =
        matches?.length ?? 0;

    /*
     * Nenhum E:
     * somente mãe.
     */
    if (occurrences === 0) {
        return {
            motherName: filiation,
            fatherName: null,
        };
    }

    /*
     * Um E:
     * mãe + pai.
     */
    if (occurrences === 1) {
        const parts =
            filiation.split(
                /\s+\bE\b\s+/i,
            );

        return {
            motherName:
                clean(parts[0]),
            fatherName:
                clean(parts[1]),
        };
    }

    /*
     * Mais de um E:
     * pedir manualmente.
     */
    console.log("\n");
    console.log(
        "========================================",
    );
    console.log(
        "⚠ FILIAÇÃO COM MAIS DE UM 'E'",
    );
    console.log(
        "========================================",
    );
    console.log(
        `cliPessoa: ${cliente.cliPessoa}`,
    );
    console.log(
        `Nome: ${pessoa.pesNome}`,
    );
    console.log(
        `Filiação: ${filiation}`,
    );
    console.log(
        `Quantidade de E: ${occurrences}`,
    );
    console.log(
        "Informe manualmente a separação.",
    );

    const rl = readline.createInterface({
        input,
        output,
    });

    const mother =
        await rl.question(
            "Nome da MÃE: ",
        );

    const father =
        await rl.question(
            "Nome do PAI: ",
        );

    rl.close();

    return {
        motherName: clean(mother),
        fatherName: clean(father),
    };
}

async function main() {
    console.log(
        "========================================",
    );
    console.log(
        "MIGRAÇÃO DE CLIENTES",
    );
    console.log(
        "========================================",
    );

    console.log(
        `TENANT: ${TENANT_ID}`,
    );

    console.log(
        `BRANCH: ${BRANCH_ID}`,
    );

    console.log(
        `DRY_RUN: ${DRY_RUN}`,
    );

    console.log(
        "========================================\n",
    );

    const pessoas =
        loadPessoa();

    const clientes =
        loadPesCliente();

    console.log(
        `Pessoas carregadas: ${pessoas.length}`,
    );

    console.log(
        `Clientes carregados: ${clientes.length}`,
    );

    /*
     * Relaciona pesCliente.cliPessoa
     * com pessoa.pesId.
     */
    const pessoaMap =
        new Map<string, PessoaCsv>();

    for (const pessoa of pessoas) {
        pessoaMap.set(
            pessoa.pesId,
            pessoa,
        );
    }

    const sources: SourceRecord[] = [];

    for (const cliente of clientes) {
        const pessoa =
            pessoaMap.get(
                cliente.cliPessoa,
            );

        if (!pessoa) {
            console.log(
                `⚠ PENDING | cliPessoa=${cliente.cliPessoa} | pessoa não encontrada`,
            );

            continue;
        }

        sources.push({
            pessoa,
            cliente,
        });
    }

    console.log(
        `Registros relacionados: ${sources.length}`,
    );

    /*
     * Carrega os clientes já existentes
     * no tenant.
     */
    const existingClients =
        await prisma.client.findMany({
            where: {
                tenantId: TENANT_ID,
            },
        });

    console.log(
        `Clientes existentes no tenant: ${existingClients.length}`,
    );

    const indexes =
        buildClientIndexes(
            existingClients,
        );

    const mapping =
        loadClientMapping();

    if (!DRY_RUN) {
        createTemporaryMappingFile();
    }

    let created = 0;
    let existing = 0;
    let pending = 0;
    let errors = 0;

    for (let i = 0; i < sources.length; i++) {
        const {
            pessoa,
            cliente,
        } = sources[i];

        const oldId =
            cliente.cliPessoa;

        console.log(
            `\n[${i + 1}/${sources.length}] ${pessoa.pesNome}`,
        );

        /*
         * Se já existe mapping, não processa
         * novamente.
         */
        if (mapping.has(oldId)) {
            console.log(
                `→ EXISTING MAPPING | oldId=${oldId} | newId=${mapping.get(oldId)}`,
            );

            existing++;
            continue;
        }

        try {
            /*
             * Primeiro convertemos sem filiação.
             * A filiação manual só será solicitada
             * quando realmente precisarmos criar
             * o registro.
             */
            const preliminary =
                convertClient(
                    pessoa,
                    cliente,
                );

            const match =
                findMatch(
                    pessoa,
                    preliminary,
                    indexes,
                );

            if (match.client) {
                console.log(
                    `→ EXISTING | ${pessoa.pesNome} | matchedBy=${match.matchedBy} | id=${match.client.id}`,
                );

                if (!DRY_RUN) {
                    appendTemporaryMapping({
                        oldId,
                        newId: match.client.id,
                        name: pessoa.pesNome,
                        matchedBy:
                            match.matchedBy,
                    });
                }

                mapping.set(
                    oldId,
                    match.client.id,
                );

                existing++;
                continue;
            }

            /*
             * Sem correspondência segura.
             *
             * Aqui NÃO criamos automaticamente.
             */
            console.log(
                `→ PENDING | ${pessoa.pesNome}`,
            );

            console.log(
                `   CPF: ${pessoa.pesDoc || "-"}`,
            );

            console.log(
                `   RG: ${cliente.cliRg || "-"}`,
            );

            console.log(
                `   Nascimento: ${pessoa.pesDataNasc || "-"}`,
            );

            console.log(
                `   Celular: ${pessoa.pesCel || "-"}`,
            );

            pending++;

        } catch (error) {
            errors++;

            console.error(
                `✗ ERROR | ${pessoa.pesNome}`,
            );

            console.error(error);
        }
    }

    /*
     * Neste primeiro passe estamos apenas
     * fazendo a análise/matching.
     *
     * A criação ficará liberada quando
     * DRY_RUN=false e o fluxo de pending
     * estiver definido.
     */
    if (!DRY_RUN && errors === 0) {
        finalizeClientMapping();
    } else if (!DRY_RUN) {
        discardTemporaryMapping();
    }

    console.log(
        "\n========================================",
    );
    console.log(
        "RESUMO",
    );
    console.log(
        "========================================",
    );
    console.log(
        `Total:     ${sources.length}`,
    );
    console.log(
        `Created:   ${created}`,
    );
    console.log(
        `Existing:  ${existing}`,
    );
    console.log(
        `Pending:   ${pending}`,
    );
    console.log(
        `Errors:    ${errors}`,
    );
    console.log(
        "========================================",
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });