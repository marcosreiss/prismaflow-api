import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as xlsx from "xlsx";
import chalk from "chalk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ChangeRow = {
  tenantId: string;
  clientId: number;
  cpf: string;
  oldBornDate: string | null;
  newBornDate: string;
  source: string; // "pessoa.xlsx:pessoa"
};

type ErrorRow = {
  type:
    | "MISSING_TENANT"
    | "INVALID_CPF"
    | "MISSING_CPF"
    | "INVALID_BORNDATE"
    | "CLIENT_NOT_FOUND"
    | "MULTIPLE_CLIENTS_SAME_CPF"
    | "DB_ERROR"
    | "XLSX_ERROR";
  tenantId: string;
  cpf?: string;
  pesId?: string | number;
  pesNome?: string;
  pesDataNasc?: string;
  details?: string;
};

function nowFolderName(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours(),
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";

  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));

  const esc = (v: any): string => {
    if (v === null || v === undefined) return "";
    const str = String(v);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}

function normalizeCpf(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/\D/g, "");
  if (!s) return null;
  // aceita 11 dígitos (CPF). Se vier com menos/mais, marca como inválido.
  if (s.length !== 11) return "__INVALID__";
  return s;
}

function parseBornDate(raw: any): Date | null {
  if (raw === null || raw === undefined) return null;

  // xlsx retorna Date, número (serial date), ou string
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    // Excel date tem timezone bug; normaliza pra UTC
    const d = new Date(
      Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()),
    );
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof raw === "number") {
    // Excel serial date (1900-based)
    const utcDays = Math.floor(raw - 25569);
    const utcValue = utcDays * 86400;
    const d = new Date(utcValue * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(raw).trim();
  if (!s || s === "----") return null;

  // YYYY-MM-DD (formato do arquivo)
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m1) {
    const d = new Date(`${m1[1]}-${m1[2]}-${m1[3]}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY
  const m2 = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(s);
  if (m2) {
    const year = m2[3].length === 2 ? 2000 + parseInt(m2[3]) : parseInt(m2[3]);
    const d = new Date(year, parseInt(m2[2]) - 1, parseInt(m2[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function toIsoDateOnly(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  const tenantId = "cmibvcyed00007m0118rkgft8";
  const dataPath =
    process.env.DATA_PATH ||
    path.resolve("migrations/otica-crista/data/pessoa.xlsx");

  const runAt = new Date();
  const logsBase = path.resolve("migrations/otica-crista/logs");
  const logDir = path.join(logsBase, nowFolderName(runAt));
  ensureDir(logDir);

  const changes: ChangeRow[] = [];
  const errors: ErrorRow[] = [];

  // valida tenant existe
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    errors.push({
      type: "MISSING_TENANT",
      tenantId,
      details: "Tenant não existe",
    });
    fs.writeFileSync(path.join(logDir, "errors.csv"), toCsv(errors));
    fs.writeFileSync(
      path.join(logDir, "summary.json"),
      JSON.stringify({ ok: false, tenantId, error: "MISSING_TENANT" }, null, 2),
    );
    process.exit(1);
  }

  // lê xlsx
  let rows: any[] = [];
  try {
    const wb = xlsx.readFile(dataPath, { cellDates: true });
    const sheet = wb.Sheets["pessoa"];
    if (!sheet) throw new Error('Aba "pessoa" não encontrada');
    rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
  } catch (e: any) {
    errors.push({
      type: "XLSX_ERROR",
      tenantId,
      details: e?.message || String(e),
    });
    fs.writeFileSync(path.join(logDir, "errors.csv"), toCsv(errors));
    fs.writeFileSync(
      path.join(logDir, "summary.json"),
      JSON.stringify({ ok: false, tenantId, error: "XLSX_ERROR" }, null, 2),
    );
    process.exit(1);
  }

  // monta mapa cpf->bornDate, (se CPF repetido com datas diferentes, registra erro e ignora)
  const cpfToDate = new Map<string, Date>();
  const cpfConflicts = new Set<string>();

  for (const r of rows) {
    const pesId = r["pesId"];
    const pesNome = r["pesNome"];
    const cpfNorm = normalizeCpf(r["pesDoc"]);

    if (!cpfNorm) continue; // sem CPF, não dá pra cruzar
    if (cpfNorm === "__INVALID__") {
      errors.push({
        type: "INVALID_CPF",
        tenantId,
        pesId,
        pesNome,
        details: `pesDoc inválido: ${r["pesDoc"]}`,
      });
      continue;
    }

    const born = parseBornDate(r["pesDataNasc"]);
    if (!born) {
      errors.push({
        type: "INVALID_BORNDATE",
        tenantId,
        cpf: cpfNorm,
        pesId,
        pesNome,
        pesDataNasc: r["pesDataNasc"] ? String(r["pesDataNasc"]) : "",
        details: "Não foi possível interpretar pesDataNasc",
      });
      continue;
    }

    const prev = cpfToDate.get(cpfNorm);
    if (prev) {
      if (toIsoDateOnly(prev) !== toIsoDateOnly(born)) {
        cpfConflicts.add(cpfNorm);
      }
    } else {
      cpfToDate.set(cpfNorm, born);
    }
  }

  // remove conflitos do mapa e loga
  for (const cpf of cpfConflicts) {
    cpfToDate.delete(cpf);
    errors.push({
      type: "DB_ERROR",
      tenantId,
      cpf,
      details:
        "CPF duplicado no arquivo com datas diferentes (conflito); ignorado",
    });
  }

  // aplica no banco (COM PROGRESSO VISUAL)
  console.log(chalk.blue(`🔍 Processando ${cpfToDate.size} CPFs válidos...`));

  let scanned = 0;
  let updated = 0;
  const total = cpfToDate.size;

  for (const [cpf, newBorn] of cpfToDate.entries()) {
    scanned++;

    // Barra de progresso
    const pct = ((scanned / total) * 100).toFixed(1);
    process.stdout.write(
      `\r${chalk.green("✓")} ${chalk.yellow(scanned)}/${total} (${pct}%) | ` +
        chalk.greenBright(updated) +
        " atualiz. | " +
        chalk.redBright(errors.length) +
        " err",
    );

    try {
      const found = await prisma.client.findMany({
        where: { tenantId, cpf },
        select: { id: true, bornDate: true },
      });

      if (found.length === 0) {
        errors.push({ type: "CLIENT_NOT_FOUND", tenantId, cpf });
        continue;
      }

      if (found.length > 1) {
        errors.push({
          type: "MULTIPLE_CLIENTS_SAME_CPF",
          tenantId,
          cpf,
          details: `Qtd: ${found.length}`,
        });
        continue;
      }

      const client = found[0];
      const old = client.bornDate ? toIsoDateOnly(client.bornDate) : null;
      const next = toIsoDateOnly(newBorn);

      if (old === next) continue;

      await prisma.client.update({
        where: { id: client.id },
        data: { bornDate: newBorn },
      });

      updated++;
      changes.push({
        tenantId,
        clientId: client.id,
        cpf,
        oldBornDate: old,
        newBornDate: next,
        source: "pessoa.xlsx:pessoa",
      });
    } catch (e: any) {
      errors.push({
        type: "DB_ERROR",
        tenantId,
        cpf,
        details: e?.message || String(e),
      });
    }
  }
  console.log(); // quebra linha
  console.log(
    chalk.green(
      `✅ ${chalk.bold(updated)} clients atualizados | ${chalk.redBright(errors.length)} erros`,
    ),
  );

  // escreve logs
  fs.writeFileSync(path.join(logDir, "changes.csv"), toCsv(changes));
  fs.writeFileSync(path.join(logDir, "errors.csv"), toCsv(errors));
  fs.writeFileSync(
    path.join(logDir, "summary.json"),
    JSON.stringify(
      {
        ok: true,
        tenantId,
        dataPath,
        scannedCpfs: scanned,
        updatedClients: updated,
        changes: changes.length,
        errors: errors.length,
        ranAt: runAt.toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Done. logDir=${logDir}`);
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
