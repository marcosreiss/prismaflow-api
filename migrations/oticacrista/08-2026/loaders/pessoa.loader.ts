import fs from "fs";
import path from "path";
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

export function loadPessoa(): PessoaCsv[] {
    const filePath = path.resolve(
        __dirname,
        "../input/pessoa.csv",
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
    }) as PessoaCsv[];
}