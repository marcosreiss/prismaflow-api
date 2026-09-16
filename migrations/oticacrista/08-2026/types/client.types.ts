import { PessoaCsv } from "../loaders/pessoa.loader";
import { PesClienteCsv } from "../loaders/pesCliente.loader";
import { ClientConverted } from "../converters/client.converter";

export interface ClientSource {
    pessoa: PessoaCsv;
    cliente: PesClienteCsv;
}

export interface ClientMatchResult {
    source: ClientSource;
    converted: ClientConverted;
    matchedBy:
    | "CPF"
    | "RG"
    | "BIRTH_DATE"
    | "PHONE"
    | "NAME"
    | "PENDING";
}