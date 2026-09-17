import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

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

export function loadPesCliente(): PesClienteCsv[] {
    const filePath = path.resolve(
        __dirname,
        "../input/pesCliente.csv",
    );

    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");

    return parse(content, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
        trim: true,
    }) as PesClienteCsv[];
}