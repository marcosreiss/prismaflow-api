// migrations/oticacrista/08-2026/03-client.ts

import fs from "node:fs";
import path from "node:path";
import {
    Client,
    PrismaClient,
} from "@prisma/client";

import {
    loadClientSources,
    type ClientSource,
} from "./loaders/pesCliente.loader";

import {
    convertClient,
    normalizeCpf,
    normalizeName,
    normalizePhone,
    normalizeRg,
} from "./converters/client.converter";

import {
    createTemporaryMappingFile,
    appendTemporaryMapping,
    finalizeClientMapping,
    discardTemporaryMapping,
    loadClientMapping,
} from "./mapping/client.mapping";

/* =========================================================
 * CONFIGURAÇÃO
 * ========================================================= */

const prisma =
    new PrismaClient();

const TENANT_ID =
    "cmibvcyed00007m0118rkgft8";

const BRANCH_ID =
    "cmibvcyed00017m014r66e39w";

const DRY_RUN = false;

const REPORTS_PATH = path.resolve(
    __dirname,
    "reports",
);

const ERRORS_PATH = path.join(
    REPORTS_PATH,
    "errors",
);

const EXECUTIONS_PATH = path.join(
    REPORTS_PATH,
    "executions",
);

/* =========================================================
 * TIPOS
 * ========================================================= */

interface ClientMatchResult {
    client: Client | null;
    matchedBy:
    | "CPF"
    | "RG"
    | "BIRTH_DATE"
    | "PHONE"
    | "PENDING";
}

interface ClientIndexes {
    cpfIndex: Map<string, Client[]>;
    rgIndex: Map<string, Client[]>;
    birthDateIndex: Map<string, Client[]>;
    phoneIndex: Map<string, Client[]>;
}

/* =========================================================
 * RELATÓRIOS
 * ========================================================= */

function createTimestamp(): string {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

function saveJson(
    directory: string,
    filename: string,
    data: unknown,
): void {
    fs.mkdirSync(
        directory,
        { recursive: true },
    );

    fs.writeFileSync(
        path.join(
            directory,
            filename,
        ),
        JSON.stringify(
            data,
            null,
            2,
        ),
        "utf-8",
    );
}

/* =========================================================
 * INDEXAÇÃO
 * ========================================================= */

function buildKey(
    name: string,
    value: string,
): string {
    return `${normalizeName(name)}|${value}`;
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
        index.set(
            key,
            [client],
        );
    }
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

function buildClientIndexes(
    clients: Client[],
): ClientIndexes {
    const cpfIndex =
        new Map<string, Client[]>();

    const rgIndex =
        new Map<string, Client[]>();

    const birthDateIndex =
        new Map<string, Client[]>();

    const phoneIndex =
        new Map<string, Client[]>();

    for (const client of clients) {
        if (client.cpf) {
            const cpf =
                normalizeCpf(
                    client.cpf,
                );

            if (cpf) {
                addToIndex(
                    cpfIndex,
                    buildKey(
                        client.name,
                        cpf,
                    ),
                    client,
                );
            }
        }

        if (client.rg) {
            const rg =
                normalizeRg(
                    client.rg,
                );

            if (rg) {
                addToIndex(
                    rgIndex,
                    buildKey(
                        client.name,
                        rg,
                    ),
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
                addToIndex(
                    birthDateIndex,
                    buildKey(
                        client.name,
                        date,
                    ),
                    client,
                );
            }
        }

        for (const phone of [
            client.phone01,
            client.phone02,
            client.phone03,
        ]) {
            const normalized =
                normalizePhone(
                    phone,
                );

            if (!normalized) {
                continue;
            }

            addToIndex(
                phoneIndex,
                buildKey(
                    client.name,
                    normalized,
                ),
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

/* =========================================================
 * MATCHING
 * ========================================================= */

function findUnique(
    candidates:
        | Client[]
        | undefined,
): Client | null {
    if (
        !candidates ||
        candidates.length !== 1
    ) {
        return null;
    }

    return candidates[0];
}

function findMatch(
    source: ClientSource,
    indexes: ClientIndexes,
): ClientMatchResult {
    const {
        pessoa,
        cliente,
    } = source;

    const name =
        normalizeName(
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
        normalizeCpf(
            pessoa.pesDoc,
        );

    if (cpf) {
        const candidates =
            indexes.cpfIndex.get(
                buildKey(
                    pessoa.pesNome,
                    cpf,
                ),
            );

        const client =
            findUnique(
                candidates,
            );

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
        normalizeRg(
            cliente.cliRg,
        );

    if (rg) {
        const candidates =
            indexes.rgIndex.get(
                buildKey(
                    pessoa.pesNome,
                    rg,
                ),
            );

        const client =
            findUnique(
                candidates,
            );

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
    const converted =
        convertClient(source);

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
            findUnique(
                candidates,
            );

        if (client) {
            return {
                client,
                matchedBy:
                    "BIRTH_DATE",
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
            findUnique(
                candidates,
            );

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

    return {
        client: null,
        matchedBy: "PENDING",
    };
}

/* =========================================================
 * INDEXAÇÃO DINÂMICA
 * ========================================================= */

function addClientToIndexes(
    client: Client,
    indexes: ClientIndexes,
): void {
    if (client.cpf) {
        const cpf =
            normalizeCpf(
                client.cpf,
            );

        if (cpf) {
            addToIndex(
                indexes.cpfIndex,
                buildKey(
                    client.name,
                    cpf,
                ),
                client,
            );
        }
    }

    if (client.rg) {
        const rg =
            normalizeRg(
                client.rg,
            );

        if (rg) {
            addToIndex(
                indexes.rgIndex,
                buildKey(
                    client.name,
                    rg,
                ),
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
            addToIndex(
                indexes.birthDateIndex,
                buildKey(
                    client.name,
                    date,
                ),
                client,
            );
        }
    }

    for (const phone of [
        client.phone01,
        client.phone02,
        client.phone03,
    ]) {
        const normalized =
            normalizePhone(
                phone,
            );

        if (!normalized) {
            continue;
        }

        addToIndex(
            indexes.phoneIndex,
            buildKey(
                client.name,
                normalized,
            ),
            client,
        );
    }
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main(): Promise<void> {
    const startedAt =
        new Date();

    console.log(
        "\n========================================",
    );
    console.log(
        "MIGRAÇÃO DE CLIENTES",
    );
    console.log(
        "========================================",
    );
    console.log(
        `DRY_RUN: ${DRY_RUN}`,
    );
    console.log(
        `Tenant: ${TENANT_ID}`,
    );
    console.log(
        `Branch: ${BRANCH_ID}`,
    );
    console.log(
        "========================================\n",
    );

    const {
        sources,
        orphanClients,
    } =
        loadClientSources();

    console.log(
        `Registros relacionados: ${sources.length}`,
    );

    console.log(
        `Clientes sem pessoa: ${orphanClients.length}`,
    );

    const existingClients =
        await prisma.client.findMany({
            where: {
                tenantId: TENANT_ID,
            },
        });

    console.log(
        `Clientes existentes: ${existingClients.length}`,
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

    const pendingRecords:
        unknown[] = [];

    const errors:
        unknown[] = [];

    let created = 0;
    let existing = 0;
    let pending =
        orphanClients.length;
    let errorCount = 0;

    /*
     * Registra clientes sem pessoa
     * como PENDING.
     */
    for (const orphan of orphanClients) {
        pendingRecords.push({
            oldId:
                orphan.cliente.cliPessoa,
            name: null,
            status: "PENDING",
            reason: orphan.reason,
        });
    }

    /*
     * Processamento dos clientes
     */
    for (
        let i = 0;
        i < sources.length;
        i++
    ) {
        const source =
            sources[i];

        const oldId =
            source.cliente.cliPessoa;

        console.log(
            `\n[${i + 1}/${sources.length}] ${source.pessoa.pesNome}`,
        );

        if (mapping.has(oldId)) {
            console.log(
                `→ EXISTING MAPPING | oldId=${oldId} | newId=${mapping.get(oldId)}`,
            );

            existing++;
            continue;
        }

        try {
            const converted =
                convertClient(
                    source,
                );

            const match =
                findMatch(
                    source,
                    indexes,
                );

            if (match.client) {
                console.log(
                    `✓ EXISTING | ${converted.name} | matchedBy=${match.matchedBy} | new_id=${match.client.id}`,
                );

                if (!DRY_RUN) {
                    appendTemporaryMapping({
                        oldId,
                        newId:
                            match.client.id,
                        status:
                            "EXISTING",
                        oldName:
                            source.pessoa
                                .pesNome,
                        newName:
                            match.client
                                .name,
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
             * CPF duplicado no banco:
             * não criamos automaticamente.
             */
            if (converted.cpf) {
                const cpf =
                    normalizeCpf(
                        converted.cpf,
                    );

                const cpfClients =
                    existingClients.filter(
                        (client) =>
                            normalizeCpf(
                                client.cpf,
                            ) === cpf,
                    );

                if (
                    cpfClients.length > 0
                ) {
                    pendingRecords.push({
                        oldId,
                        name:
                            converted.name,
                        status:
                            "PENDING",
                        reason:
                            "CPF já pertence a outro cliente e não houve correspondência segura por nome + CPF.",
                        cpf:
                            converted.cpf,
                    });

                    console.log(
                        `→ PENDING | CPF em conflito | ${converted.name}`,
                    );

                    pending++;
                    continue;
                }
            }

            /*
             * CREATE
             */
            if (!DRY_RUN) {
                const createdClient =
                    await prisma.client.create({
                        data: {
                            name:
                                converted.name,
                            nickname:
                                converted.nickname,
                            cpf:
                                converted.cpf,
                            rg:
                                converted.rg,
                            bornDate:
                                converted.bornDate,
                            gender:
                                converted.gender,
                            fatherName:
                                converted.fatherName,
                            motherName:
                                converted.motherName,
                            spouse:
                                converted.spouse,
                            email:
                                converted.email,
                            company:
                                converted.company,
                            occupation:
                                converted.occupation,
                            street:
                                converted.street,
                            number:
                                converted.number,
                            neighborhood:
                                converted.neighborhood,
                            city:
                                converted.city,
                            uf:
                                converted.uf,
                            cep:
                                converted.cep,
                            complement:
                                converted.complement,
                            isBlacklisted:
                                converted.isBlacklisted,
                            obs:
                                converted.obs,
                            phone01:
                                converted.phone01,
                            phone02:
                                converted.phone02,
                            phone03:
                                converted.phone03,
                            reference01:
                                converted.reference01,
                            reference02:
                                converted.reference02,
                            reference03:
                                converted.reference03,
                            isActive:
                                true,
                            tenantId:
                                TENANT_ID,
                            branchId:
                                BRANCH_ID,
                        },
                    });

                addClientToIndexes(
                    createdClient,
                    indexes,
                );

                appendTemporaryMapping({
                    oldId,
                    newId:
                        createdClient.id,
                    status: "CREATED",
                    oldName:
                        source.pessoa
                            .pesNome,
                    newName:
                        createdClient.name,
                    matchedBy:
                        "CREATE",
                });

                mapping.set(
                    oldId,
                    createdClient.id,
                );

                created++;

                console.log(
                    `✓ CREATED | ${converted.name} | new_id=${createdClient.id}`,
                );

                continue;
            }

            /*
             * DRY_RUN:
             * apenas identifica o CREATE.
             */
            console.log(
                `→ CREATE [DRY_RUN] | ${converted.name}`,
            );

            created++;
        } catch (error) {
            errorCount++;

            const record = {
                oldId,
                name:
                    source.pessoa
                        .pesNome,
                status: "ERROR",
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            };

            errors.push(record);

            console.error(
                `✗ ERROR | ${source.pessoa.pesNome}`,
            );

            console.error(error);
        }
    }

    const finishedAt =
        new Date();

    /*
     * Mapping definitivo somente
     * quando não existem erros.
     */
    if (!DRY_RUN) {
        if (errorCount === 0) {
            finalizeClientMapping();
        } else {
            discardTemporaryMapping();

            console.log(
                "\n⚠️ Existem erros. Mapping não foi substituído.",
            );
        }
    }

    /*
     * Relatório de PENDING / ERROR
     */
    if (
        pendingRecords.length > 0 ||
        errors.length > 0
    ) {
        saveJson(
            ERRORS_PATH,
            `03-client-errors-${createTimestamp()}.json`,
            {
                pending:
                    pendingRecords,
                errors,
            },
        );
    }

    /*
     * Relatório da execução.
     */
    saveJson(
        EXECUTIONS_PATH,
        `03-client-${createTimestamp()}.json`,
        {
            migration:
                "03-client",
            tenantId:
                TENANT_ID,
            branchId:
                BRANCH_ID,
            dryRun:
                DRY_RUN,
            startedAt,
            finishedAt,
            durationMs:
                finishedAt.getTime() -
                startedAt.getTime(),
            total:
                sources.length +
                orphanClients.length,
            created,
            existing,
            pending,
            errors:
                errorCount,
            mappingSaved:
                errorCount === 0 &&
                !DRY_RUN,
        },
    );

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
        `Total:     ${sources.length + orphanClients.length}`,
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
        `Errors:    ${errorCount}`,
    );
    console.log(
        "========================================\n",
    );
}

main()
    .catch((error) => {
        console.error(
            "\nERRO FATAL:",
        );
        console.error(error);
        process.exitCode = 1;
    })
    .finally(
        async () => {
            await prisma.$disconnect();
        },
    );