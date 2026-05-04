# Problemas resolvidos na refatoração — 02/05/2026 (módulo user)

## **user.dto.ts**

**Problema 1 — `CreateUserDto` permite `ADMIN` como role (falha de segurança)**

O uso de `@IsEnum(Role)` aceitava qualquer valor do enum, incluindo `ADMIN`. A validação ficava apenas no service, enquanto o role vinha diretamente do body do cliente.

**Problema 2 — validação inconsistente de `branchId`**

O campo utiliza `@IsString` (correto para CUID), porém havia import de `@IsUUID` não utilizado. Além de desnecessário, seria incorreto para esse tipo de identificador.

---

## **user.repository.ts**

**Problema 3 — `update` com tipagem `any`**

Uso de tipagem genérica em método público, abrindo espaço para inconsistências e erros silenciosos. O ideal é restringir com `Partial` dos campos permitidos, mesmo que o método ainda não esteja exposto nas rotas.

---

## **user.service.ts**

**Problema 4 — erros retornados como valor (inconsistência de padrão)**

O service retornava `ApiResponse.error(...)` em vez de lançar exceções (`AppError`), quebrando o fluxo padrão com middleware global e dificultando o tratamento centralizado.

**Problema 5 — hash de senha duplicado e acoplado ao bcrypt**

O service utilizava `bcrypt` diretamente, duplicando a configuração de salt. A responsabilidade deve ser centralizada em `PasswordUtils`, garantindo consistência e manutenção simplificada.

**Problema 6 — uso de `req.user!` sem verificação explícita**

A utilização de non-null assertion assume que o `authGuard` sempre foi aplicado. O service não deve depender implicitamente disso — a validação deve ser explícita.

**Problema 7 — retorno 400 para erro de autorização (`MANAGER` sem `branchId`)**

A ausência de `branchId` no contexto do usuário indica falha de autorização/configuração, não erro de input. O status correto é `403`.

---

## **user.controller.ts**

**Problema 8 — tratamento de status após padronização com exceções**

Com o service passando a lançar `AppError`, o controller não recebe mais erros como retorno. O fluxo fica mais consistente:

- `createUser` → sempre `201` em sucesso
- `listUsers` → `200` implícito

A estrutura atual já está correta, desde que o `catch` continue delegando para `next(err)`.

---

## **user.routes.ts**

**Problema 9 — ausência de controle de papel em `listUsers` (falha de segurança)**

A rota `GET /users` não possui `requireRoles`, deixando a restrição apenas no service. O ideal é aplicar validação também na camada de rota, impedindo acesso indevido antes mesmo da execução da lógica.
