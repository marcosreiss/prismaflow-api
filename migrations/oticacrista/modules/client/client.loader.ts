import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export interface ClientSource {
    id: string;
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

export const CLIENT_CSV_PATH = path.resolve(
    process.cwd(),
    "migrations/oticacrista/modules/client/input/cliente.csv",
);

export function loadClients(): ClientSource[] {
    if (!fs.existsSync(CLIENT_CSV_PATH)) {
        throw new Error(`Arquivo de entrada não encontrado: ${CLIENT_CSV_PATH}`);
    }

    const records = parse(fs.readFileSync(CLIENT_CSV_PATH, "utf8"), {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: false,
        trim: true,
    }) as Record<string, string>[];

    return records.map((record, index) => {
        if (!record.id?.trim()) {
            throw new Error(`Registro ${index + 2} sem a coluna id obrigatória.`);
        }

        return Object.fromEntries(
            Object.entries(record).map(([key, value]) => [key, value ?? ""]),
        ) as unknown as ClientSource;
    });
}
