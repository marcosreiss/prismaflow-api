import { Prisma, PrismaClient } from "@prisma/client";

type RuntimeField = {
  name: string;
  kind: string;
  type: string;
  nativeType?: [string, string[]] | null;
};

type RuntimeModel = {
  name: string;
  fields: readonly RuntimeField[];
};

type ModelMetadata = {
  dateOnlyFields: Set<string>;
  relationFields: Map<string, string>;
};

const runtimeModels = Prisma.dmmf.datamodel.models as readonly RuntimeModel[];

const modelMetadata = new Map<string, ModelMetadata>(
  runtimeModels.map((model) => [
    model.name,
    {
      dateOnlyFields: new Set(
        model.fields
          .filter(
            (field) =>
              field.kind === "scalar" &&
              field.type === "DateTime" &&
              field.nativeType?.[0] === "Date",
          )
          .map((field) => field.name),
      ),
      relationFields: new Map(
        model.fields
          .filter((field) => field.kind === "object")
          .map((field) => [field.name, field.type]),
      ),
    },
  ]),
);

function formatDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

function transformModelPayload(modelName: string, payload: unknown): unknown {
  if (payload == null) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => transformModelPayload(modelName, item));
  }

  if (!isObjectRecord(payload)) {
    return payload;
  }

  const metadata = modelMetadata.get(modelName);

  if (!metadata) {
    return payload;
  }

  for (const [fieldName, value] of Object.entries(payload)) {
    if (value == null) {
      continue;
    }

    if (metadata.dateOnlyFields.has(fieldName) && value instanceof Date) {
      payload[fieldName] = formatDateOnly(value);
      continue;
    }

    const relatedModel = metadata.relationFields.get(fieldName);

    if (relatedModel) {
      payload[fieldName] = transformModelPayload(relatedModel, value);
    }
  }

  return payload;
}

export function formatDateOnlyFieldsForModel<T>(
  modelName: string,
  payload: T,
): T {
  return transformModelPayload(modelName, payload) as T;
}

export const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        const result = await query(args);

        if (!model) {
          return result;
        }

        return formatDateOnlyFieldsForModel(model, result);
      },
    },
  },
});

function getDatabaseTarget(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return "DATABASE_URL não definida";
  }

  try {
    const parsed = new URL(databaseUrl);
    const protocol = parsed.protocol.replace(":", "");
    const host = parsed.hostname || "host-desconhecido";
    const port = parsed.port ? `:${parsed.port}` : "";
    const databaseName = parsed.pathname.replace("/", "") || "db-desconhecido";

    return `${protocol}://${host}${port}/${databaseName}`;
  } catch {
    return "DATABASE_URL inválida";
  }
}

prisma
  .$connect()
  .then(() =>
    console.log(`🟢 Prisma conectado ao banco (${getDatabaseTarget()})!`),
  )
  .catch((err: unknown) => console.error("🔴 Erro ao conectar Prisma:", err));

export function withAuditData<T extends Record<string, any>>(
  userId: string | undefined,
  data: T,
  isUpdate = false,
): T {
  if (!userId) {
    return data;
  }

  if (isUpdate) {
    return { ...data, updatedById: userId };
  }

  return { ...data, createdById: userId, updatedById: userId };
}
