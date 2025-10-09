/* scripts/import-clients.ts */
import { PrismaClient, Gender } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const prisma = new PrismaClient();

// ====== IDs fixos (do usuário) ======
const TENANT_ID = "cmgjqez320000rtn821sh7o45";
const BRANCH_CENTRO_ID = "cmgjqez350001rtn87jojm8g1";
const BRANCH_MAIOBAO_ID = "cmgjqlujb0004rtn845ak3dho";

// ====== Arquivo Excel ======
const EXCEL_PATH = process.env.CLIENTS_XLSX_PATH || "clientes-oticareis.xlsx";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "import-report";

// ====== Utilidades ======

// Excel serial date (dias desde 1899-12-30) → Date
function excelSerialToDate(v: any): Date | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    // zera horas p/ evitar TZ
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (typeof v === "string") {
    const parsed = new Date(v);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function onlyDigits(s?: string | number | null): string {
  if (s == null) return "";
  return String(s).replace(/\D+/g, "");
}

function cleanCpf(doc?: any): string | null {
  const digits = onlyDigits(doc);
  return digits ? digits.padStart(11, "0").slice(-11) : null; // mantém 11 dígitos se possível
}

function mapGender(g: any): Gender | null {
  if (!g) return null;
  const s = String(g).trim().toLowerCase();
  if (["f", "fem", "feminino"].includes(s)) return Gender.FEMALE;
  if (["m", "mas", "masculino"].includes(s)) return Gender.MALE;
  return Gender.OTHER;
}

function boolFromSimNao(v: any): boolean {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (["sim", "s", "yes", "true", "1"].includes(s)) return true;
  if (["não", "nao", "n", "no", "false", "0"].includes(s)) return false;
  // default true se vazio? vamos assumir true só quando vier “Sim”
  return false;
}

function normalizeEmail(e: any): string | null {
  const s = String(e || "").trim();
  return s ? s : null;
}

function pickPhones(row: Record<string, any>): {
  phone01?: string | null;
  phone02?: string | null;
  phone03?: string | null;
} {
  const candidates = [
    row["celular"],
    row["telefone"],
    row["celular1"],
    row["celular2"],
    row["telefone1"],
  ]
    .map(onlyDigits)
    .map((p) => (p && p.length >= 8 ? p : "")) // evita lixo
    .filter(Boolean);

  // remove duplicatas preservando ordem
  const uniq: string[] = [];
  for (const p of candidates) if (!uniq.includes(p)) uniq.push(p);

  return {
    phone01: uniq[0] || null,
    phone02: uniq[1] || null,
    phone03: uniq[2] || null,
  };
}

function pickBranchId(row: Record<string, any>): string {
  const lojaSrc = String(row["Cadastrado Em"] || "").toLowerCase();
  if (lojaSrc.includes("loja 2")) return BRANCH_MAIOBAO_ID;
  // default: Matriz Centro
  return BRANCH_CENTRO_ID;
}

// Campos do Excel que mapeamos diretamente:
const mappedExcelKeys = new Set([
  "Ativo",
  "Nome / Razão Social",
  "Apelido / Nome Fantasia",
  "Documento",
  "RG / IE",
  "Data de Nascimento",
  "Sexo",
  "Nome do Pai",
  "Nome da Mãe",
  "Profissão",
  "Endereço",
  "Número",
  "Bairro",
  "Cidade",
  "Estado",
  "CEP",
  "Complemento",
  "Observação",
  "email",
  "celular",
  "celular1",
  "celular2",
  "telefone",
  "telefone1",
  "Cadastrado Em",
]);

// Concatena campos "não mapeados" em obs: "Chave: valor; ..."
function buildExtrasObs(row: Record<string, any>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (mappedExcelKeys.has(key)) continue;
    if (value == null || value === "") continue;
    parts.push(`${key}: ${String(value).trim()};`);
  }
  return parts.join(" ");
}

// ====== Execução principal ======
async function main() {
  console.log("🟡 Iniciando importação de clientes...");
  console.log(`📄 Arquivo: ${path.resolve(EXCEL_PATH)}`);

  // prepara saída
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const importedCsv = path.join(OUTPUT_DIR, "imported.csv");
  const skippedCsv = path.join(OUTPUT_DIR, "skipped_duplicates.csv");
  const errorsCsv = path.join(OUTPUT_DIR, "errors.csv");
  fs.writeFileSync(importedCsv, "name,cpf,branchId,notes\n");
  fs.writeFileSync(skippedCsv, "name,cpf,reason\n");
  fs.writeFileSync(errorsCsv, "rowIndex,name,cpf,error\n");

  // lê excel
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    raw: true,
  });

  console.log(`📦 ${rows.length} linhas encontradas...`);

  const dataToInsert: any[] = [];
  const seenCpf = new Set<string>(); // dedup local por CPF
  let skipped = 0;
  let errors = 0;

  rows.forEach((row, idx) => {
    try {
      // Campos base
      let name = String(row["Nome / Razão Social"] || "").trim();
      const nickname =
        String(row["Apelido / Nome Fantasia"] || "").trim() || null;
      const cpf = cleanCpf(row["Documento"]); // pode ser null
      const rg = row["RG / IE"] ? String(row["RG / IE"]).trim() : null;
      const bornDate = excelSerialToDate(row["Data de Nascimento"]);
      const gender = mapGender(row["Sexo"]);
      const fatherName = row["Nome do Pai"]
        ? String(row["Nome do Pai"]).trim()
        : null;
      const motherName = row["Nome da Mãe"]
        ? String(row["Nome da Mãe"]).trim()
        : null;
      const occupation = row["Profissão"]
        ? String(row["Profissão"]).trim()
        : null;

      const street = row["Endereço"] ? String(row["Endereço"]).trim() : null;
      const number = row["Número"] ? String(row["Número"]).trim() : null;
      const neighborhood = row["Bairro"] ? String(row["Bairro"]).trim() : null;
      const city = row["Cidade"] ? String(row["Cidade"]).trim() : null;
      const uf = row["Estado"] ? String(row["Estado"]).trim() : null;
      const cep = row["CEP"] ? String(row["CEP"]).trim() : null;
      const complement = row["Complemento"]
        ? String(row["Complemento"]).trim()
        : null;

      const email = normalizeEmail(row["email"]);
      const isActive = boolFromSimNao(row["Ativo"]);
      const branchId = pickBranchId(row);
      const { phone01, phone02, phone03 } = pickPhones(row);

      // Observações
      const baseObs = row["Observação"] ? String(row["Observação"]).trim() : "";
      const extrasObs = buildExtrasObs(row);
      const extraFlags: string[] = [];
      if (!name) {
        name = "Cliente sem nome";
        extraFlags.push("Sem nome");
      }
      if (!cpf) extraFlags.push("Sem CPF");

      const obs =
        [baseObs, extrasObs, extraFlags.join("; ")]
          .filter(Boolean)
          .join(" | ")
          .trim() || null;

      // Dedup local por CPF (quando existe)
      if (cpf && seenCpf.has(cpf)) {
        skipped++;
        fs.appendFileSync(
          skippedCsv,
          `"${name}","${cpf}","duplicated in file"\n`
        );
        return;
      }
      if (cpf) seenCpf.add(cpf);

      const createData = {
        // Prisma Client fields
        name,
        nickname,
        cpf, // unique (pode ser null)
        rg,
        bornDate: bornDate || null,
        gender: gender || null,
        fatherName,
        motherName,
        spouse: null,
        email,
        company: null,
        occupation,
        street,
        number,
        neighborhood,
        city,
        uf,
        cep,
        complement,
        isBlacklisted: false,
        obs,
        phone01,
        phone02,
        phone03,
        reference01: null,
        reference02: null,
        reference03: null,
        isActive,
        tenantId: TENANT_ID,
        branchId,
        createdById: null,
        updatedById: null,
      };

      dataToInsert.push(createData);
    } catch (err: any) {
      errors++;
      const safeCpf = cleanCpf(rows[idx]?.["Documento"]);
      fs.appendFileSync(
        errorsCsv,
        `${idx + 2},"${rows[idx]?.["Nome / Razão Social"] || ""}","${
          safeCpf || ""
        }","${(err && err.message) || String(err)}"\n`
      );
    }
  });

  // Batching
  const BATCH = 500;
  let insertedTotal = 0;
  console.log(
    `🚚 Preparando para inserir ${dataToInsert.length} registros em lotes de ${BATCH}...`
  );

  for (let i = 0; i < dataToInsert.length; i += BATCH) {
    const batch = dataToInsert.slice(i, i + BATCH);
    try {
      const res = await prisma.client.createMany({
        data: batch,
        skipDuplicates: true, // ignora duplicados de CPF (unique) no banco
      });
      insertedTotal += res.count;

      // relatório “imported” (apenas um resumo útil)
      for (const r of batch) {
        const shortObs = (r.obs || "").replace(/\n/g, " ").slice(0, 200).trim();
        fs.appendFileSync(
          importedCsv,
          `"${r.name || ""}","${r.cpf || ""}","${r.branchId}","${
            shortObs || ""
          }"\n`
        );
      }

      console.log(`✅ Lote ${i / BATCH + 1}: ${res.count} inseridos`);
    } catch (err: any) {
      errors += batch.length;
      console.error(`❌ Erro no lote ${i / BATCH + 1}:`, err?.message || err);
      for (const r of batch) {
        fs.appendFileSync(
          errorsCsv,
          `"batch ${i / BATCH + 1}","${r.name || ""}","${
            r.cpf || ""
          }","createMany failed"\n`
        );
      }
    }
  }

  console.log("───────────── RESUMO ─────────────");
  console.log(`✅ Inseridos........: ${insertedTotal}`);
  console.log(
    `⏭️  Pulados (arquivo): ${skipped} (CPF duplicado no próprio XLSX)`
  );
  console.log(`⚠️  Erros............: ${errors}`);
  console.log(`🗂️  Relatórios em: ${path.resolve(OUTPUT_DIR)}`);
}

main()
  .catch((e) => {
    console.error("❌ Falha na importação:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
